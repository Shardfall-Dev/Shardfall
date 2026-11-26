<script>
/* ================= SOUND: Web Audio player for the Shardfall sound pack (src/audio.js) =================
   Generic engine only: it knows the manifest, takes, voices, buses, mute and the page lifecycle.
   What plays where is decided by the game (sound section of src/game.js) through window.SFXA.
   - Takes come from SFX_DATA (base64 WAV bytes embedded by tools/embed_audio.py, keyed by the exact
     manifest path) in the offline build. The web build has no SFX_DATA: it fetches the small AAC copy from
     SFX_WEB (assets/audio/web/<path>.m4a) the first time a take is needed, or the WAV master in
     assets/audio/<path> where the browser cannot decode AAC.
   - Music (MUSIC, the Saltmarsh soundtrack) is one looping track at a time on its own bus, chosen by the
     game per area through SFXA.music(id). A track is downloaded only when an area first asks for it, and
     only the playing track stays decoded (a decoded minute of stereo is about 20 MB of memory).
   - Each take is decoded once, lazily, and cached; every playback gets its own BufferSource and nodes.
   - Never blocks the game: a sound whose take decodes too late for its moment is dropped. */
(function () {
'use strict';
const MAN = typeof SFX_MANIFEST !== 'undefined' ? SFX_MANIFEST : { events: {}, peak: {}, dur: {} };
const DATA = typeof SFX_DATA !== 'undefined' ? SFX_DATA : {};
const BASE = 'assets/audio/';
const WEB = typeof SFX_WEB !== 'undefined' ? SFX_WEB : null;
const MUS = typeof MUSIC !== 'undefined' ? MUSIC : {};
const AAC = (() => { try { return !!document.createElement('audio').canPlayType('audio/mp4; codecs="mp4a.40.2"'); } catch (e) { return false; } })();
const MASTER = .70, MAX_VOICES = 14;
const LARGE = { 'combat.blast': 1, 'boss.bell': 1, 'magic.storm': 1, 'world.beacon': 1, 'world.bell': 1 };
/* priority: UI 5 · danger/strike/door 3 · actions 2 · footsteps 1 · ambience 0 (distance lowers it further) */
const prioOf = ev => /^(ui|quest|skill|player)\./.test(ev) ? 5 : /^(hit|block|parry|combat|door|chest|gate|boss)\.|\.(alert|attack|death)$/.test(ev) ? 3 : /^step\./.test(ev) ? 1 : /^world\./.test(ev) ? 0 : 2;

let ctx = null, master = null, sfxBus = null, ambBus = null, musicBus = null, muted = false, warmed = false;
const bufs = new Map();          // path -> AudioBuffer once decoded, Promise while decoding
const voices = new Set();        // live voices: { src, prio, amb, end }
const pending = new Set();       // requests not yet audible: { valid, cancel }
const lastTake = new Map();      // emitter|event -> path of the previous take
const unlockFns = [];

/* audio-only randomness: never touches combat, loot or world RNG */
let seed = (Date.now() ^ Math.floor((typeof performance !== 'undefined' ? performance.now() : 0) * 1000)) >>> 0;
function rand() { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }

function create() {
  if (ctx) return ctx; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  try { ctx = new AC(); } catch (e) { return null; }
  master = ctx.createGain(); master.gain.value = muted ? 0 : MASTER; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master); ambBus = ctx.createGain(); ambBus.connect(master);
  musicBus = ctx.createGain(); musicBus.connect(master);   // the soundtrack, if one is added, runs here on its own
  return ctx;
}
/* unlock or resume from a trusted gesture anywhere on the page, including HUD taps and keys */
function ensure() {
  if (!create()) return;
  if (ctx.state !== 'running' && !document.hidden) { const p = ctx.resume && ctx.resume(); if (p && p.then) p.then(onRunning, () => { }); else onRunning(); }
  else onRunning();
}
function onRunning() {
  if (!ctx || ctx.state !== 'running') return;
  if (!warmed) { warmed = true; for (const f of unlockFns) { try { f(ctx); } catch (e) { console.error(e); } } }
  musicApply(); prefetchTakes();
}
for (const t of ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'keydown', 'click']) document.addEventListener(t, ensure, true);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelPending(); stopCat('amb'); if (ctx && ctx.state === 'running' && ctx.suspend) ctx.suspend().catch(() => { }); }
  else if (ctx && ctx.state !== 'running' && ctx.resume) ctx.resume().catch(() => { });   // iOS may refuse until the next gesture; ensure() retries then
});

function b64bytes(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
/* web build: after the first gesture, quietly download every small take (about 2 MB in all) a few at a time,
   so a sound heard for the first time is ready for its moment; decoding still waits until it is played */
const takeBytes = new Map();     // web path -> Promise of bytes
function webBytes(url) { let p = takeBytes.get(url); if (!p) { p = fetchBytes(url); takeBytes.set(url, p); p.catch(() => takeBytes.delete(url)); } return p; }
let prefetched = false;
function prefetchTakes() {
  if (prefetched || !WEB || !AAC || typeof fetch === 'undefined') return; prefetched = true;
  const q = Object.keys(MAN.dur || {}).map(rel => WEB + rel.replace(/\.wav$/, '.m4a'));
  const next = () => { const u = q.shift(); if (u) webBytes(u).then(next, next); };
  setTimeout(() => { for (let i = 0; i < 4; i++) next(); }, 1500);
}
async function fetchBytes(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer(); }
function decodeBytes(ab) { return new Promise((ok, no) => { const p = ctx.decodeAudioData(ab, ok, no); if (p && p.then) p.then(ok, no); }); }
function load(rel) {
  const have = bufs.get(rel); if (have) return have;
  const p = (async () => {
    let b = null;
    if (DATA[rel]) b = await decodeBytes(b64bytes(DATA[rel]));
    else {
      if (WEB && AAC) try { b = await decodeBytes((await webBytes(WEB + rel.replace(/\.wav$/, '.m4a'))).slice(0)); } catch (e) { b = null; }
      if (!b) b = await decodeBytes(await fetchBytes(BASE + rel));
    }
    bufs.set(rel, b); return b;
  })();
  bufs.set(rel, p); p.catch(e => { bufs.delete(rel); console.warn('sound', rel, e); });
  return p;
}
function takeFor(ev, key) {
  const files = MAN.events[ev].files, k = (key || '') + '|' + ev, prev = lastTake.get(k);
  let f = files[Math.floor(rand() * files.length)];
  if (files.length > 1 && f === prev) f = files[(files.indexOf(f) + 1 + Math.floor(rand() * (files.length - 1))) % files.length];
  lastTake.set(k, f); return f;
}
function voiceCount() { const now = ctx.currentTime; for (const v of voices) if (v.end < now) voices.delete(v); let n = voices.size; for (const r of pending) if (!r.src) n++; return n; }
function makeRoom(prio) {
  if (voiceCount() < MAX_VOICES) return true;
  let low = null; for (const v of voices) if (!low || v.prio < low.prio) low = v;
  if (!low || low.prio >= prio) return false;
  try { low.src.stop(); } catch (e) { } voices.delete(low); return true;
}

/* ---- music: one looping track, crossfaded; only the current one decoded ---- */
const MUSIC_VOL = .38, FADE = 2.2;
let musicOn = true, musicWant = null, musicCur = null, musicLoading = null, musicTok = 0;
const musicBytes = new Map();    // id -> Promise of the compressed bytes (small; kept so a return visit needs no download)
function musicFetch(id) {
  let p = musicBytes.get(id); if (p) return p;
  const t = MUS[id];
  p = (async () => { if (AAC) try { return { ab: await fetchBytes(t.web), web: true }; } catch (e) { } return { ab: await fetchBytes(t.mp3), web: false }; })();
  musicBytes.set(id, p); p.catch(e => { musicBytes.delete(id); console.warn('music', id, e); });
  return p;
}
async function musicDecode(id) {
  const got = await musicFetch(id);
  try { return await decodeBytes(got.ab.slice(0)); }                       // slice: decoding detaches the bytes
  catch (e) { if (!got.web) throw e; musicBytes.set(id, Promise.resolve({ ab: await fetchBytes(MUS[id].mp3), web: false })); return decodeBytes((await musicBytes.get(id)).ab.slice(0)); }
}
function musicFadeOut(cur) {
  if (!cur) return; const t = ctx.currentTime;
  cur.g.gain.cancelScheduledValues(t); cur.g.gain.setValueAtTime(cur.g.gain.value, t); cur.g.gain.linearRampToValueAtTime(0, t + FADE);
  try { cur.src.stop(t + FADE + .05); } catch (e) { }
}
function musicApply() {
  if (!ctx || ctx.state !== 'running') return;
  const id = musicOn && MUS[musicWant] ? musicWant : null;
  if ((musicCur ? musicCur.id : musicLoading) === id) return;
  const tok = ++musicTok; musicFadeOut(musicCur); musicCur = null; musicLoading = id;
  if (!id) return;
  musicDecode(id).then(buf => {
    if (tok !== musicTok || !ctx) return;
    musicLoading = null;
    const src = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime;
    src.buffer = buf; src.loop = true; src.loopStart = 0; src.loopEnd = Math.min(MUS[id].loopEnd || buf.duration, buf.duration);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(MUSIC_VOL, t + FADE); src.connect(g); g.connect(musicBus); src.start(t);
    musicCur = { id, src, g };
  }, e => { if (tok === musicTok) musicLoading = null; console.warn('music', id, e); });
}

/* where(): set by the game. Given a world point (and its emitter, if any) it returns null when the sound must
   not be heard (out of range, hidden, behind walls, another level) or { d: world distance, pan: -1..1 }. */
const API = {
  where: null,
  get ctx() { return ctx; }, get muted() { return muted; }, get musicBus() { return musicBus; }, rand, ensure,
  has: ev => !!MAN.events[ev], version: MAN.releaseVersion,
  onUnlock(f) { unlockFns.push(f); if (warmed) f(ctx); },
  warm(evs) { if (!ctx) return; for (const ev of evs) if (MAN.events[ev]) load(takeFor(ev, 'warm')); },
  /* play(ev, o): o.pos {x,y} world point (omit for UI and the player's own centred sounds) · o.ent emitter
     o.range culling distance (default 18, large impacts 28) · o.gain extra gain · o.prio · o.key emitter key
     o.peakIn seconds until the take's loudest moment should land (swings) · o.delay seconds · o.valid() keeps a
     not-yet-audible sound alive · o.late seconds a late decode may slip (default .15) · o.amb ambience bus */
  play(ev, o) {
    o = o || {}; const E = MAN.events[ev];
    if (!E || muted || !ctx || ctx.state !== 'running' || document.hidden) return null;
    let gain = E.gain * (o.gain === undefined ? 1 : o.gain), pan = 0, prio = o.prio === undefined ? prioOf(ev) : o.prio;
    if (o.pos) {
      const range = o.range || (LARGE[ev] ? 28 : 18), w = API.where && API.where(o.pos, o.ent);
      if (!w || w.d > range) return null;
      const near = 2.5; if (w.d > near) gain *= Math.pow(1 - (w.d - near) / (range - near), 1.6);
      pan = w.pan || 0; prio -= w.d / range;
    }
    if (gain < .004 || !makeRoom(prio)) return null;
    const rel = takeFor(ev, o.key), now = ctx.currentTime;
    let when = now + (o.delay || 0); if (o.peakIn !== undefined) when = Math.max(now, now + o.peakIn - (MAN.peak[rel] || 0));
    const late = o.late === undefined ? .15 : o.late;
    const req = { valid: o.valid, src: null, dead: false, cancel() { this.dead = true; pending.delete(this); if (this.src) try { this.src.stop(); } catch (e) { } } };
    pending.add(req);
    const start = buf => {
      if (req.dead || !ctx || muted) return pending.delete(req);
      const t = ctx.currentTime; if (t > when + late) return pending.delete(req);   // decoded after its moment: obsolete
      const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = buf; g.gain.value = gain; src.connect(g);
      if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(o.amb ? ambBus : sfxBus); } else g.connect(o.amb ? ambBus : sfxBus);
      const at = Math.max(t, when), v = { src, prio, amb: !!o.amb, end: at + buf.duration + .05 }; req.src = src; req.at = at;
      src.onended = () => { voices.delete(v); pending.delete(req); };
      voices.add(v); src.start(at); if (at <= t + .02) pending.delete(req); else req.voice = v;
    };
    const b = bufs.get(rel); if (b && !b.then) start(b); else load(rel).then(start, () => pending.delete(req));
    return req;
  },
  /* per frame: a scheduled sound whose action was cancelled before it became audible is dropped */
  tick() { if (!ctx) return; const t = ctx.currentTime; for (const r of [...pending]) { if (r.at !== undefined && r.at <= t) { pending.delete(r); continue; } if (r.valid && !r.valid()) { r.cancel(); if (r.voice) voices.delete(r.voice); } } },
  cancelPending, stopCat,
  /* music(id): the track this area wants (a MUSIC id, or null for silence); safe to call every frame */
  music(id) { if (id === musicWant) return; musicWant = id; musicApply(); },
  get musicOn() { return musicOn; }, set musicOn(v) { musicOn = !!v; musicApply(); },
  get musicNow() { return musicCur ? musicCur.id : null; },
  setMuted(m) {
    muted = !!m; if (!ctx) return; const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t);
    if (muted) { master.gain.setTargetAtTime(0, t, .015); cancelPending(); setTimeout(() => { if (muted) stopCat('all'); }, 120); }
    else master.gain.setTargetAtTime(MASTER, t, .02);
  },
  get stats() { return { voices: voices.size, pending: pending.size, decoded: [...bufs.values()].filter(b => !b.then).length, state: ctx ? ctx.state : 'none' }; }
};
function cancelPending() { for (const r of [...pending]) { r.cancel(); if (r.voice) voices.delete(r.voice); } pending.clear(); }
function stopCat(cat) { for (const v of [...voices]) if (cat === 'all' || (cat === 'amb') === v.amb) { try { v.src.stop(); } catch (e) { } voices.delete(v); } }
window.SFXA = API;
})();
</script>
