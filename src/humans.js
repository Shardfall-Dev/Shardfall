
/* ================= HUMANS v2 (v0.30): one renderer for every human — player, hireling, townsfolk, guards, merchants, trainers,
   travellers, bandits, smugglers and the drowned captain. docs/humans/STATUS.md.
   Visual only. It reads simulation facts (movement, swings, telegraphs, casts, tasks, hits, deaths) and never writes gameplay state:
   the only fields it sets on entities start with _h (look caches and animation phase) and are never saved.
   Behind a feature flag until the painted atlases pass visual review: ?humans=v2 (or the Menu / creator toggle) turns it on,
   ?humans=old turns it off. With the flag off the game draws exactly as v0.29.2.
   Sprites: the procedural rig (src/human-rig.js) builds one strip per figure × action × direction, rasterised once at native size,
   trimmed and kept in a bounded LRU cache; nothing is rasterised in the draw call itself, the build queue runs a few strips per frame. ---- */
const LOOK = SF.LOOK;
const HUM = { cache: new Map(), px: 0, maxPx: 7e6, queue: [], inflight: 0, tick: 0, K: 1.1, built: 0, evicted: 0, fallbacks: 0, buildMs: 0, maxBuildMs: 0, perFrame: 3, maxInflight: 6 };
let HUM_FLAG = null;
function humOn() {
  if (HUM_FLAG === null) { const q = /[?&]humans=([a-z0-9]+)/i.exec(location.search || ''); HUM_FLAG = q ? /^(v2|on|1|new)$/i.test(q[1]) : !!(typeof SETTINGS !== 'undefined' && SETTINGS.humansV2); }
  return HUM_FLAG;
}
function humSetFlag(on) { HUM_FLAG = !!on; if (typeof SETTINGS !== 'undefined') { SETTINGS.humansV2 = !!on; saveSettings(); } }
/* which entities the human renderer draws: every human; creatures keep their own art */
function humIsHuman(e) { return e.kind === 'player' || e.kind === 'npc' || e.kind === 'ally' || (e.kind === 'mon' && LOOK.isHumanMon(e.type)); }
/* the persistent appearance of an NPC or human creature: from a seed fixed at world population (name + role + ordinal),
   so it is the same after leaving the area and after every reload; never stored, never rerolled */
function humAssignSeeds() {
  const seen = {}; for (const e of ents) if (e.kind === 'npc' && !e._hseed) { const k = e.name + '|' + e.role; seen[k] = (seen[k] || 0) + 1; e._hseed = k + '#' + seen[k]; }
}
function humBaseLook(e) {
  if (e._hlook) return e._hlook;
  if (e.kind === 'npc') e._hlook = LOOK.npcLook({ seed: e._hseed || (e.name + '|' + e.role), name: e.name, role: e.role, prof: e.life && e.life.prof, town: e.town || (e.life && e.life.town) || humTownOf(e), kind: 'npc' });
  else if (e.kind === 'ally') e._hlook = LOOK.npcLook({ seed: 'ally:' + (e.aid || e.name), name: e.name, role: 'sellsword', kind: 'npc' });
  else if (e.kind === 'mon') e._hlook = LOOK.npcLook({ seed: 'mon:' + e.type + ':' + (e.actorId || e.aid || e.id), name: MON[e.type] && MON[e.type].n, kind: 'mon', type: e.type });
  return e._hlook;
}
function humTownOf(e) { const n = String(e.name || '').toLowerCase(); for (const t of ['vespar', 'mynoc', 'skara', 'moonglen', 'college', 'quay']) if (n.includes(t)) return t; return null; }
/* the render figure for an entity, recomputed only when its look or visible equipment changes */
function humFigure(e) {
  let sig;
  if (e === P) { const app = SF.EQ.appearance(P); sig = JSON.stringify(P.look) + '|' + app.map(a => a.asset + a.tint).join(',') + '|' + (P.equip.weapon ? P.equip.weapon.id : '') + '|' + !!P.ghost; }
  else if (e.kind === 'ally') { const app = SF.EQ.appearance(e); sig = app.map(a => a.asset + a.tint).join(',') + '|' + (e.equip && e.equip.weapon ? e.equip.weapon.id : '') + '|' + !!e.ghost; }
  else sig = 'npc';
  if (e._hfig && e._hsig === sig) return e._hfig;
  let f;
  if (e === P) { P.look = LOOK.normalize(P.look, P.name); f = LOOK.figure(P.look, P, { seed: P.name, ghost: P.ghost }); if (!P.equip.weapon) f.weapon = null; }
  else if (e.kind === 'ally') { f = LOOK.figure(humBaseLook(e), e, { ghost: e.ghost }); }
  else f = LOOK.figure(humBaseLook(e), null);
  f.key = LOOK.figKey(f); e._hfig = f; e._hsig = sig; return f;
}
/* ---- animation state: simulation facts → LOOK.state (priority death > hit/interrupt > attack/cast/tool > ready > move > idle) ---- */
const HUM_SWING_LEAD = .12, HUM_REC = .38;
function humAnim(e, f) {
  const s = { now: GT, moving: e.speed > .3, running: false, hitAt: e.lastHit ?? e.hitT ?? null };
  const walk = SF.WALK * MOVE_SCALE; s.running = s.moving && e.speed > walk * 1.2;
  const wid = e === P ? wDef().id : e.kind === 'ally' ? (e.equip && e.equip.weapon ? e.equip.weapon.id : 'unarmed') : (humBaseLook(e).weapon || 'unarmed');
  const wa = LOOK.weaponAnim(wid) || LOOK.weaponAnim('unarmed');
  if (e._hswing != null && GT - e._hswing < HUM_SWING_LEAD + HUM_REC) s.attack = { family: wa.family, t0: e._hswing, tc: e._hswing + HUM_SWING_LEAD, rec: HUM_REC };
  if (e._hblock != null && GT - e._hblock < .4) s.blocking = true;
  if (e === P) {
    s.interruptAt = Math.max(P._hbreak ?? -99, P._htaskbreak ?? -99); if (s.interruptAt < 0) s.interruptAt = null;
    const gesture = sp => LOOK.castGesture(sp, f.weapon);
    if (P.prep && GT >= P.prep.t0) s.cast = { gesture: gesture(P.prep.sp), phase: 'prep', t0: P.prep.t0, t1: P.prep.t1 };
    else if (P.held) s.cast = { gesture: gesture(P.held.sp), phase: 'hold' };
    else if (P.once && P.once.clip === 'CastRelease' && GT - P.once.t0 < .45) s.cast = { gesture: gesture(P._hlastSpell), phase: 'release', t0: P.once.t0 };
    if (P.prep) P._hlastSpell = P.prep.sp; else if (P.held) P._hlastSpell = P.held.sp;
    if (P.task && P.task.kind === 'gather' && P.task.node) s.tool = LOOK.toolAnim(P.task.node.skill);
    else if (P.task && P.task.kind === 'skin') s.tool = { family: 'craft', geom: null };
    else if (P.batch) { const r = SF.RECIPE[P.batch.rid]; s.tool = LOOK.craftAnim(r && (r.station + ' ' + (r.cat || ''))); }
    else if (P.bandage) s.tool = { family: 'bandage', geom: null };
    s.ready = !!(P.drawn || P.drawing || P.armed);
  } else if (e.kind === 'ally') { s.ready = !!e.foe; }
  else if (e.kind === 'mon') {
    const d = MON[e.type] || {}, tele = (e.mode === 'r2' && d.ranged2 ? d.ranged2.tele : d.tele) || .5;
    if (e.state === 'tele') s.attack = { family: wa.family, t0: e.st, tc: e.st + tele, rec: HUM_REC };
    else if (e.state === 'strike') s.attack = { family: wa.family, t0: GT - .01, tc: GT, rec: HUM_REC };
    else if (e.state === 'rec' && GT - (e.st || 0) < HUM_REC) s.attack = { family: wa.family, t0: e.st - .2, tc: e.st, rec: HUM_REC };
    s.ready = !!e.target; s.hitAt = e.hitT ?? null;
  } else if (e.life && !s.moving) {
    const L = e.life, prof = L.prof;
    if (L.doing === 'gather') s.tool = prof === 'miner' ? LOOK.toolAnim('mining') : prof === 'woodcutter' ? LOOK.toolAnim('lumberjacking') : prof === 'fisher' ? LOOK.toolAnim('fishing') : null;
    else if (L.doing === 'work' && (prof === 'smith' || e.role === 'smith' || e.role === 'qsmith')) s.tool = LOOK.craftAnim('smith');
  }
  const st = LOOK.state(s); st.tool = s.tool || null; return st;
}
/* ---- strip cache ---- */
function humStrip(f, action, dir, tool) {
  const key = f.key + '|' + action + '|' + dir + '|' + (tool || ''); let s = HUM.cache.get(key);
  if (s) { s.used = HUM.tick; return s.ready ? s : null; }
  s = { ready: false, used: HUM.tick, px: 0 }; HUM.cache.set(key, s); HUM.queue.push({ key, f, action, dir, tool }); return null;
}
function humBuild(job) {
  const s = HUM.cache.get(job.key); if (!s) return; const t0 = performance.now();
  const f = job.tool !== undefined && job.tool !== '' ? Object.assign({}, job.f, { weapon: job.tool === 'none' ? null : job.tool }) : job.f;
  const svg = SFRIG.stripSVG(f, job.action, job.dir, HUM.K), im = new Image(); HUM.inflight++;
  im.onload = () => { HUM.inflight--; try { humPack(s, im, job, f); } catch (err) { console.warn('human strip failed', err); HUM.cache.delete(job.key); } HUM.buildMs += performance.now() - t0; };
  im.onerror = () => { HUM.inflight--; HUM.cache.delete(job.key); };
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
/* draw the strip once, trim every frame to its pixels, pack them side by side; ghosts get the pale blue wash */
function humPack(s, im, job, f) {
  const C = SFRIG.CELL, K = HUM.K, n = SFRIG.ANIMATIONS[job.action] || 1, cw = Math.ceil(C.width * K), ch = Math.ceil(C.height * K);
  const tmp = document.createElement('canvas'); tmp.width = Math.ceil(n * C.width * K); tmp.height = ch; const tg = tmp.getContext('2d'); tg.drawImage(im, 0, 0, tmp.width, tmp.height);
  const d = tg.getImageData(0, 0, tmp.width, tmp.height), a = d.data, W = tmp.width;
  for (let i = 0; i < a.length; i += 4) { if (a[i + 3] < 48) { a[i + 3] = 0; continue; } if (f.ghost) { const l = (a[i] + a[i + 1] + a[i + 2]) / 3; a[i] = l * .7 + 60; a[i + 1] = l * .8 + 80; a[i + 2] = l + 110; a[i + 3] = Math.min(a[i + 3], 150); } }
  tg.putImageData(d, 0, 0);
  const rects = []; let total = 0, H = 1;
  for (let k = 0; k < n; k++) {
    const X0 = Math.floor(k * C.width * K); let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw && X0 + x < W; x++) if (a[(y * W + X0 + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; }
    const r = { sx: total, w: x1 - x0 + 1, h: y1 - y0 + 1, srcX: X0 + x0, srcY: y0, ox: x0 - C.anchorX * K, oy: y0 - C.anchorY * K }; rects.push(r); total += r.w; H = Math.max(H, r.h);
  }
  const out = document.createElement('canvas'); out.width = Math.max(1, total); out.height = H; const og = out.getContext('2d');
  for (const r of rects) og.drawImage(tmp, r.srcX, r.srcY, r.w, r.h, r.sx, 0, r.w, r.h);
  s.canvas = out; s.rects = rects; s.px = out.width * out.height; s.ready = true; HUM.px += s.px; HUM.built++; humEvict();
}
function humEvict() {
  if (HUM.px <= HUM.maxPx) return; const list = [...HUM.cache.entries()].filter(([, s]) => s.ready && s.used < HUM.tick).sort((a, b) => a[1].used - b[1].used);
  for (const [k, s] of list) { if (HUM.px <= HUM.maxPx * .8) break; HUM.cache.delete(k); HUM.px -= s.px; HUM.evicted++; }
}
/* the build queue: a few strips per frame, never inside the draw call */
function humPump() {
  HUM.tick++; let started = 0;
  while (HUM.queue.length && HUM.inflight < HUM.maxInflight && started < HUM.perFrame) { const job = HUM.queue.shift(); const t = performance.now(); humBuild(job); HUM.maxBuildMs = Math.max(HUM.maxBuildMs, performance.now() - t); started++; }
}
/* ---- drawing ---- */
function humPhase(e, action) {
  const now = GT, dt = Math.max(0, Math.min(.25, now - (e._hgt ?? now))); e._hgt = now;
  let rate = 1; if (action === 'walk') rate = cl(e.speed / (SF.WALK * MOVE_SCALE), .6, 1.6); else if (action === 'run') rate = cl(e.speed / (SF.SPRINT * MOVE_SCALE), .7, 1.4);
  e._hph = (e._hph || ((e.id || 0) % 7) * .13) + dt * rate; return e._hph;
}
function drawHuman(g, e, x, y) {
  if (!humOn() || typeof SFRIG === 'undefined') return false;
  const f = humFigure(e), st = humAnim(e, f), dir = e.sect || 0, ph = humPhase(e, st.action);
  const tool = st.tool ? (st.tool.geom || 'none') : (st.action === 'bandage' || st.action === 'craft' ? 'none' : '');
  const frame = SFRIG.frameAt(st.action, st.t, ph);
  let s = humStrip(f, st.action, dir, tool);
  if (!s) {   // not built yet: the same figure's idle in this direction, then any direction, then the old sprite (first frames only)
    HUM.fallbacks++; s = humStrip(f, 'idle', dir, '');
    for (let k = 1; !s && k < 8; k++) { const c = HUM.cache.get(f.key + '|idle|' + ((dir + k) % 8) + '|'); if (c && c.ready) s = c; }
    if (!s) { for (let k = 0; k < 8; k++) humStrip(f, 'idle', k, ''); return false; }
    const r = s.rects[0]; g.imageSmoothingEnabled = false; g.drawImage(s.canvas, r.sx, 0, r.w, r.h, Math.round(x + r.ox), Math.round(y + r.oy), r.w, r.h); return true;
  }
  const r = s.rects[Math.min(frame, s.rects.length - 1)];
  g.imageSmoothingEnabled = false; g.drawImage(s.canvas, r.sx, 0, r.w, r.h, Math.round(x + r.ox), Math.round(y + r.oy), r.w, r.h);
  if (e.rooted > GT) { g.fillStyle = 'rgba(120,90,50,.6)'; g.fillRect(x - 12, y - 4, 24, 4); }
  return true;
}
/* corpses of humans: the death fall from the corpse's creation time, then the body, in the appearance the person died in.
   Corpse visuals never touch the container or the loot. */
function humCorpseFigure(e) {
  if (e._hfig) return e._hfig;
  if (e.hfig) return (e._hfig = e.hfig);
  if (e.mine && P) { const f = LOOK.figure(LOOK.normalize(P.look, P.name), null, { seed: P.name }); f.key = LOOK.figKey(f); return (e._hfig = f); }
  if (e.allyBody) { const a = ents.find(o => o.aid === e.allyBody); if (a) { const f = LOOK.figure(humBaseLook(a), null); f.weapon = null; f.key = LOOK.figKey(f); return (e._hfig = f); } }
  return null;
}
function humSnapshot(e) { if (!humIsHuman(e)) return null; const f = Object.assign({}, humFigure(e), { ghost: false }); f.key = LOOK.figKey(f); return f; }
function drawHumanCorpse(g, e) {
  if (!humOn() || typeof SFRIG === 'undefined') return false;
  if (e.mon && !LOOK.isHumanMon(e.mon)) return false; if (!e.mon && !e.mine && !e.allyBody) return false;
  const f = humCorpseFigure(e); if (!f) return false;
  const x = SX(e.x, e.y), y = SY(e.x, e.y), dt = e.t0 != null ? GT - e.t0 : 99, action = dt < .7 ? 'death' : 'corpse';
  let s = humStrip(f, action, e.sect || 0, 'none'); if (!s && action === 'death') s = humStrip(f, 'corpse', e.sect || 0, 'none'); if (!s) return false;
  const r = s.rects[action === 'death' && s.rects.length > 1 ? SFRIG.frameAt('death', dt / .7) : 0] || s.rects[0];
  g.fillStyle = 'rgba(110,10,10,.35)'; g.beginPath(); g.ellipse(x + 2, y + 1, 15, 6, 0, 0, 7); g.fill();
  g.imageSmoothingEnabled = false; g.drawImage(s.canvas, r.sx, 0, r.w, r.h, Math.round(x + r.ox), Math.round(y + r.oy), r.w, r.h);
  if (e.cont && e.cont.items.length) { const tw = (Math.sin(GT * 5 + e.x) + 1) / 2; g.fillStyle = `rgba(255,224,120,${.4 + .6 * tw})`; g.fillRect(Math.round(x + 9), Math.round(y - 12), 2, 2); }
  return true;
}
/* ---- character creation preview and paper doll: the same rig and the same figure as the world ---- */
const HUM_DOLL = new Map();
/* previews show the middle of the cell (the body and most weapon swings), not the margin kept for fallen bodies */
function humFrameURL(f, o) { const C = SFRIG.CELL, s = SFRIG.frameSVG(f, o).replace('viewBox="0 0 ' + C.width + ' ' + C.height + '"', 'viewBox="' + (C.anchorX - 56) + ' ' + (C.anchorY - 104) + ' 112 112"'); return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); }
function humDollSrc(ch) { const f = humFigure(ch); const k = f.key; let u = HUM_DOLL.get(k); if (!u) { if (HUM_DOLL.size > 24) HUM_DOLL.clear(); u = humFrameURL(f, { action: 'idle', frame: 0, direction: 0 }); HUM_DOLL.set(k, u); } return u; }
const CCP = { dir: 0, act: 'idle', f: 0, timer: null };
const CC_ACTS = [['idle', 'Idle'], ['walk', 'Walk'], ['run', 'Run'], ['ready', 'Ready'], ['slash1h', 'Attack'], ['cast1h', 'Cast'], ['cast2h', 'Cast (two hands)']];
function ccPreviewFig(look) { const f = LOOK.figure(look, null, { seed: 'preview' }); if (look.cloak) f.cloak = look.cloak; if (CCP.act === 'slash1h' || CCP.act === 'ready') f.weapon = 'sword'; return f; }
function ccPreviewTick() {
  const img = document.getElementById('ccprev'); if (!img || document.getElementById('cc').hidden) { clearInterval(CCP.timer); CCP.timer = null; return; }
  const n = SFRIG.ANIMATIONS[CCP.act] || 1; CCP.f = (CCP.f + 1) % n; img.src = humFrameURL(ccPreviewFig(CC.look), { action: CCP.act, frame: CCP.f, direction: CCP.dir });
}
function ccPreviewStart() { if (!CCP.timer) CCP.timer = setInterval(ccPreviewTick, 125); ccPreviewTick(); }
function ccAppearanceHtml() {
  const L = CC.look, sw = (k, obj, names) => Object.keys(obj).map(id => `<button style="background:${obj[id]}" class="${L[k] === id ? 'on' : ''}" data-c="lk" data-k="${k}" data-v="${id}" aria-label="${esc(names[id])}" title="${esc(names[id])}"></button>`).join('');
  const chips = (k, list, names, dis) => list.map(id => `<button class="btn sm ${L[k] === id ? 'ac' : ''}" data-c="lk" data-k="${k}" data-v="${id}"${dis ? ' disabled' : ''}>${esc(names[id])}</button>`).join('');
  return `<label>Appearance <span class="note">(cosmetic only)</span></label>
  <div class="ccprev"><button class="btn sm" data-c="rot" data-d="1" aria-label="Turn left">◀</button><img id="ccprev" alt="Character preview" width="112" height="112"><button class="btn sm" data-c="rot" data-d="-1" aria-label="Turn right">▶</button></div>
  <div class="chips">${CC_ACTS.map(([a, n]) => `<button class="btn sm ${CCP.act === a ? 'ac' : ''}" data-c="pact" data-v="${a}">${n}</button>`).join('')}</div>
  <div class="chips">${['male', 'female'].map(b => `<button class="btn sm ${L.body === b ? 'ac' : ''}" data-c="lk" data-k="body" data-v="${b}">${b === 'male' ? 'Male' : 'Female'}</button>`).join('')}<button class="btn sm" data-c="rnd">Randomize</button></div>
  <label>Skin</label><div class="sw">${sw('skin', LOOK.SKIN, LOOK.NAMES.skin)}</div>
  <label>Hair</label><div class="chips">${chips('hair', LOOK.HAIRSTYLES, LOOK.NAMES.hairStyle)}</div>
  <label>Hair colour</label><div class="sw">${sw('hairColor', LOOK.HAIR, LOOK.NAMES.hair)}</div>
  <label>Facial hair</label><div class="chips">${chips('beard', LOOK.BEARDS, LOOK.NAMES.beard, L.body === 'female')}</div>
  <label>Clothing colour</label><div class="sw">${sw('cloth', LOOK.CLOTH, LOOK.NAMES.cloth)}</div>`;
}
function ccLookAction(b) {
  const c = b.dataset.c; if (!CC.look) CC.look = LOOK.random('cc:' + Date.now());
  if (c === 'lk') { const k = b.dataset.k, v = b.dataset.v; CC.look[k] = v; if (k === 'body' && v === 'female') CC.look.beard = 'none'; return true; }
  if (c === 'rnd') { CC.lookN = (CC.lookN || 0) + 1; CC.look = LOOK.random('cc:' + Date.now() + ':' + CC.lookN); return true; }
  if (c === 'rot') { CCP.dir = (CCP.dir + (+b.dataset.d) + 8) % 8; ccPreviewTick(); return 'keep'; }
  if (c === 'pact') { CCP.act = b.dataset.v; CCP.f = 0; return true; }
  if (c === 'hflag') { humSetFlag(!humOn()); return true; }
  return false;
}
/* developer / test access */
const HUMANS_API = { on: humOn, set: humSetFlag, stats: () => ({ on: humOn(), strips: HUM.cache.size, ready: [...HUM.cache.values()].filter(s => s.ready).length, px: HUM.px, maxPx: HUM.maxPx, queue: HUM.queue.length, inflight: HUM.inflight, built: HUM.built, evicted: HUM.evicted, fallbacks: HUM.fallbacks, buildMs: Math.round(HUM.buildMs), maxBuildMs: Math.round(HUM.maxBuildMs * 10) / 10 }),
  figure: e => humFigure(e), anim: e => humAnim(e, humFigure(e)), isHuman: humIsHuman, baseLook: humBaseLook, LOOK, RIG: () => SFRIG, cache: HUM };
