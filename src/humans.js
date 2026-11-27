/* ================= LAYERED HUMANS (NPC wardrobe & faction appearance v1.0; docs/wardrobe/STATUS.md) =================
   One renderer for every human: the player, Wren, townsfolk, guards and human mobs (bandit, smuggler, drowned captain).
   SF.WARDROBE.resolve() decides what a person wears (real equipment when they have it, a disclosed cosmetic preset when they
   do not); SF.RIG draws it (procedural prototype art, NOT the painted production atlas). Behind a flag: the painted Saltmarsh
   Scout stays the default until the layered art is approved. Turn it on in the menu ("Human art") or with ?humans=layered.
   Performance: SVG is built and decoded off the draw call (a small time-budgeted queue), one strip per
   appearance × action × direction, kept in a bounded LRU; while a strip is pending the old sprite is drawn. */
const HUMANS = { on: false, mode: 'classic', scale: 1.12, cap: 96, strips: new Map(), queue: [], queued: new Set(), pumping: false, built: 0, evicted: 0, buildMs: 0, roster: null, errors: 0 };
/* modes: 'classic' (the old Scout sheets, default until the painted art is accepted), 'painted' (classic-humans v2.1 painted
   bodies through the layered compositor, src/compositor.js) and 'rig' (the procedural rig — animation-contract development
   and testing only, never a release look; reachable only with ?humans=rig). ?humans=layered is the v0.31 name for 'rig'. */
const HUMAN_MODES = { classic: 1, painted: 1, rig: 1 };
function humansSetMode(m) { HUMANS.mode = HUMAN_MODES[m] ? m : 'classic'; HUMANS.on = HUMANS.mode !== 'classic'; HUMANS.strips.clear(); HUMANS.queue.length = 0; HUMANS.queued.clear(); if (typeof ents !== 'undefined') for (const e of ents) e._wd = null; }
{ const q = new URLSearchParams(location.search).get('humans'); const m = q === 'layered' ? 'rig' : q || (SETTINGS.humans === 'layered' ? 'classic' : SETTINGS.humans); humansSetMode(m); }
function humansToggle() { humansSetMode(HUMANS.mode === 'painted' ? 'classic' : 'painted'); SETTINGS.humans = HUMANS.mode; saveSettings(); }
/* ---- painted art: the registry from the installed manifest, atlases decoded once into pixel arrays ---- */
const PAINTED = { reg: null, img: {}, ready: false, missingLog: new Map() };
(function paintedLoad() {
  const A = SF.HUMAN_ART_DATA, C = SF.HUMANART; if (!A || !C) return; PAINTED.reg = C.fromManifest(A); let n = 0; const want = Object.keys(A.src);
  for (const k of want) { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    PAINTED.img[k] = { data: g.getImageData(0, 0, im.width, im.height).data, width: im.width }; if (++n === want.length) { PAINTED.ready = true; humansPump(); try { if (!P && !document.querySelector('#cc').hidden) renderCC(); } catch (err) { } } }; im.src = A.src[k]; }
})();
const DIR_NAMES = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];
function paintedPlan(D, action, dir) { const P = SF.HUMANART.plan(PAINTED.reg, D, action, DIR_NAMES[dir]); for (const m of P.missing) PAINTED.missingLog.set(m, (PAINTED.missingLog.get(m) || 0) + 1); return P; }
const HUMAN_MOB = t => !!(SF.WARDROBE.MOB_ROLE[t]);
const isHumanEnt = e => e && (e.kind === 'player' || e.kind === 'ally' || e.kind === 'npc' || (e.kind === 'mon' && HUMAN_MOB(e.type)));
/* the player's own appearance identity: chosen once (seeded from the name) and kept in the save; never rerolled on load.
   Character creation v2 replaces this with the player's choice; until then the menu can switch the body. */
function humansEnsureLook(p) { if (!p.look) p.look = {}; if (p.look.body) return; const id = SF.WARDROBE.identityFor('player:' + (p.name || 'p1')); Object.assign(p.look, id, { wv: SF.WARDROBE.SEED_REV }); }
function humansRoster() {   // guard rank by placement order within a region: stable across loads because population is deterministic
  if (HUMANS.roster) return HUMANS.roster; const R = new Map(), n = {};
  for (const e of ents) if (e.kind === 'npc' && (e.role === 'guard' || e.role === 'quaywarden')) { const reg = SF.WARDROBE.regionOf(e, zoneAt(Math.floor(e.x), Math.floor(e.y))) || '-'; if (e.role === 'quaywarden') continue; R.set(e, n[reg] = (n[reg] ?? -1) + 1); }
  return HUMANS.roster = R;
}
function humanCtx(e) { const L = e.life; return { zone: zoneAt(Math.floor(e.home ? e.home.x : e.x), Math.floor(e.home ? e.home.y : e.y)), rosterIndex: humansRoster().get(e) || 0, night: typeof lifeNight === 'function' && lifeNight(), watch: !!(L && L.goal && L.goal.act === 'watch') }; }
/* inputs that can change a person's look; the descriptor is rebuilt only when these change (never per frame) */
function humanInSig(e, c) {
  let s = (e.kind === 'player' ? JSON.stringify(e.look) : '') + '|' + SF.WARDROBE.outfitState(e, c) + '|' + (c.night && c.watch ? 'w' : '');
  if (e.equip) for (const k in e.equip) { const it = e.equip[k]; if (it) s += k + it.id + (it.material || '') + (it.sec || '') + (it.cond === 0 ? 'x' : ''); }
  return s;
}
function humanDesc(e) {
  // townsfolk re-check twice a second (their activity changes slowly); anyone with equipment re-checks every call so a
  // successful equip/unequip shows on the next frame (the signature is cheap; the descriptor is rebuilt only if it changed)
  if (!e.equip && e._wdT !== undefined && GT - e._wdT < .5 && e._wd) return e._wd;
  if (e.kind === 'player') humansEnsureLook(e);
  const c = humanCtx(e), sig = humanInSig(e, c); e._wdT = GT;
  if (e._wd && e._wdSig === sig) return e._wd;
  e._wdSig = sig; e._wd = SF.WARDROBE.resolve(e, c); return e._wd;
}
/* animation state from the simulation (visual only; never feeds back into combat or movement) */
function humanAnim(e, D) {
  const R = SF.RIG, mv = e.speed > .3, wpn = D.weapon ? D.weapon.id : 'unarmed', atk = R.attackForWeapon(wpn) || 'unarmed';
  const ph = typeof e.id === 'number' ? e.id * .37 : 0, cyc = (n, fps) => Math.floor(GT * fps + ph) % n;   // per-person phase so crowds do not step in unison
  if (e === P) {
    if (P.once && P.once.tc > P.once.t0) { const p = cl((GT - P.once.t0) / Math.max(.05, (P.once.tc - P.once.t0) * 1.6), 0, .999); return [atk, Math.floor(p * 8)]; }
    if (P.prep && GT >= P.prep.t0) return ['cast1h', Math.min(5, Math.floor(6 * (GT - P.prep.t0) / Math.max(.05, P.prep.t1 - P.prep.t0)))];
    if (mv) return [P.sprintOn || P.speed > 5.5 ? 'run' : 'walk', cyc(8, 12 * cl(P.speed / 5, .7, 1.4))];
    return [(P.drawn || P.drawing) && wpn !== 'unarmed' ? 'ready' : 'idle', cyc(4, 3)];
  }
  if (e.kind === 'mon') {
    if (e.state === 'tele') { const d = MON[e.type], p = cl((GT - (e.st || GT)) / (d.tele || .4), 0, .999); return [atk, Math.floor(p * 4)]; }
    if (e.state === 'strike' || (e.state === 'rec' && GT - (e.st || 0) < .25)) return [atk, 4 + Math.min(3, Math.floor((GT - (e.st || GT)) / .07))];
    if (e.hitT && GT - e.hitT < .16) return ['hit', Math.min(3, Math.floor((GT - e.hitT) / .04))];
    if (mv) return [e.speed > 4.6 ? 'run' : 'walk', cyc(8, 10)];
    return [e.target ? 'ready' : 'idle', cyc(4, 3)];
  }
  if (mv) return ['walk', cyc(8, 10 * cl(e.speed / 3.5, .7, 1.3))];
  if (D.act && D.state === 'work' && (!e.life || e.life.doing === 'gather' || e.life.doing === 'work')) return [D.act, cyc(8, 8)];
  return ['idle', cyc(4, 3)];
}
/* ---- strips: one appearance × action × direction, n frames side by side, rendered at HUMANS.scale ---- */
function humanStrip(D, action, dir, ghost) {
  if (HUMANS.mode === 'painted') return paintedStrip(D, action, dir, ghost);
  const k = D.key + '#' + action + '#' + dir; const s = HUMANS.strips.get(k);
  if (s) { HUMANS.strips.delete(k); HUMANS.strips.set(k, s); return s; }   // LRU touch
  if (!HUMANS.queued.has(k)) { HUMANS.queued.add(k); HUMANS.queue.push({ k, D, action, dir }); humansPump(); }
  return null;
}
/* painted: the plan decides the drawn action and layers; strips are keyed by the plan (so 'walk N' and 'idle N' share one strip) */
function paintedStrip(D, action, dir, ghost) {
  if (!PAINTED.reg) return null; const P = paintedPlan(D, action, dir); if (!P.drawn) return null;
  const k = 'P|' + P.key + (ghost ? '|ghost' : ''); const s = HUMANS.strips.get(k);
  if (s) { HUMANS.strips.delete(k); HUMANS.strips.set(k, s); s.plan = P; return s; }
  if (!HUMANS.queued.has(k)) { HUMANS.queued.add(k); HUMANS.queue.push({ k, P, ghost, painted: true }); humansPump(); }
  return null;
}
function paintedBuild(j) {
  const C = SF.HUMANART, W = C.CANVAS.width, H = C.CANVAS.height, n = j.P.frames, c = document.createElement('canvas'); c.width = W * n; c.height = H; const g = c.getContext('2d');
  for (let f = 0; f < n; f++) { const px = C.composeFrame(j.P, f, PAINTED.img, PAINTED.img);
    if (j.ghost) for (let i = 0; i < px.length; i += 4) { if (!px[i + 3]) continue; const l = (px[i] + px[i + 1] + px[i + 2]) / 3; px[i] = l * .7 + 60; px[i + 1] = l * .8 + 80; px[i + 2] = l + 110; px[i + 3] = 150; }
    g.putImageData(new ImageData(px, W, H), f * W, 0); }
  c.n = n; c.cw = W; c.painted = true; c.plan = j.P; return c;
}
function humansPump() {
  if (HUMANS.pumping) return; HUMANS.pumping = true;
  setTimeout(async () => {
    const t0 = performance.now(), R = SF.RIG, S = HUMANS.scale;
    while (HUMANS.queue.length && performance.now() - t0 < 6) {
      const j = HUMANS.queue.shift();
      if (j.painted) { if (!PAINTED.ready) { HUMANS.queue.unshift(j); break; } try { HUMANS.strips.set(j.k, paintedBuild(j)); HUMANS.built++; } catch (err) { HUMANS.errors++; console.error(err); } HUMANS.queued.delete(j.k);
        while (HUMANS.strips.size > HUMANS.cap) { HUMANS.strips.delete(HUMANS.strips.keys().next().value); HUMANS.evicted++; } continue; }
      const n = R.ANIMATIONS[j.action] || 1, cw = R.CELL.width, ch = R.CELL.height; let body = '';
      try {
        const o = R.fromDescriptor(j.D, { SF, direction: R.DIRECTIONS[j.dir], action: j.action });
        for (let f = 0; f < n; f++) { const svg = R.frameSVG(Object.assign(o, { frame: f })); body += '<g transform="translate(' + f * cw + ' 0)">' + svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>')) + '</g>'; }
        const W = Math.round(n * cw * S), H = Math.round(ch * S);
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + n * cw + ' ' + ch + '" shape-rendering="crispEdges">' + body + '</svg>';
        const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        im.decode().then(() => { const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(im, 0, 0); c.n = n; c.cw = W / n;
          HUMANS.strips.set(j.k, c); HUMANS.queued.delete(j.k); HUMANS.built++;
          while (HUMANS.strips.size > HUMANS.cap) { HUMANS.strips.delete(HUMANS.strips.keys().next().value); HUMANS.evicted++; } })
          .catch(() => { HUMANS.errors++; HUMANS.queued.delete(j.k); });
      } catch (err) { HUMANS.errors++; HUMANS.queued.delete(j.k); console.error(err); }
    }
    HUMANS.buildMs += performance.now() - t0; HUMANS.pumping = false; if (HUMANS.queue.length && (PAINTED.ready || !HUMANS.queue[0].painted)) humansPump();
  }, 0);
}
function humanBlit(g, s, f, x, y) { f = Number.isFinite(f) ? f : 0;
  if (s.painted) { const C = SF.HUMANART.CANVAS; g.imageSmoothingEnabled = false; g.drawImage(s, Math.min(f, s.n - 1) * s.cw, 0, s.cw, s.height, Math.round(x - C.anchorX), Math.round(y - C.anchorY), s.cw, s.height); return; }
  const S = HUMANS.scale, R = SF.RIG.CELL; g.imageSmoothingEnabled = false; g.drawImage(s, Math.min(f, s.n - 1) * s.cw, 0, s.cw, s.height, Math.round(x - R.anchorX * S), Math.round(y - R.anchorY * S), s.cw, s.height); }
/* draw a living human; false → the caller draws the old sprite (flag off, ghost, or the strip is still being built) */
function drawHuman(g, e, x, y) {
  const ghost = !!(e.ghost || (e === P && P.ghost));
  if (!HUMANS.on || !isHumanEnt(e) || (ghost && HUMANS.mode !== 'painted')) return false;
  const D = humanDesc(e); if (!D) return false;
  let [ac, f] = humanAnim(e, D); const dir = e.sect || 0;
  if (ghost) ac = e.speed > .3 ? 'walk' : 'idle';
  if (HUMANS.mode === 'painted') {
    const s = humanStrip(D, ac, dir, ghost); if (!s) return false; const P = s.plan;
    let ox = 0, oy = 0; if (P.fallback && P.fallback.via === 'bob' && e.speed > .3) oy = -(Math.floor(GT * 8) % 2);   // the classic step bob while walking art is missing
    if (e.lunge) { const k = Math.sin(e.lunge * Math.PI) * 4, a = SECT_ANG[dir] * Math.PI / 180; ox += Math.cos(a) * k; oy += Math.sin(a) * k * .5; }
    const fr = P.frames > 1 ? (P.drawn === ac || (ac === 'cast1h' && P.drawn === 'cast') ? f : Math.floor(GT * 10) % P.frames) % P.frames : 0;
    humanBlit(g, s, fr, x + ox, y + oy); return true;
  }
  let s = humanStrip(D, ac, dir);
  if (!s && ac !== 'idle') { s = humanStrip(D, 'idle', dir); if (s) { humanBlit(g, s, 0, x, y); return true; } }
  if (!s) return false;
  let ox = 0, oy = 0; if (e.lunge) { const k = Math.sin(e.lunge * Math.PI) * 4, a = SECT_ANG[dir] * Math.PI / 180; ox = Math.cos(a) * k; oy = Math.sin(a) * k * .5; }
  humanBlit(g, s, f, x + ox, y + oy); return true;
}
/* corpses keep the last resolved appearance (a snapshot taken at death; loot is untouched and decides nothing here) */
function humanSnap(e) { if (!isHumanEnt(e)) return null; try { return humanDesc(e); } catch (err) { return null; } }
function drawHumanCorpse(g, c, x, y) {
  if (!HUMANS.on || !c.wd || HUMANS.mode === 'painted') return false;   // painted death/corpse art does not exist yet: the previous corpse drawing stays
  const fresh = GT - (c.t0 || 0) < .6;
  const s = humanStrip(c.wd, fresh ? 'death' : 'corpse', c.sect || 0); if (!s) return false;
  humanBlit(g, s, fresh ? Math.floor((GT - (c.t0 || 0)) / .075) : 0, x, y);
  if (c.cont && c.cont.items && c.cont.items.length) { const tw = (Math.sin(GT * 5 + c.x) + 1) / 2; g.fillStyle = `rgba(255,224,120,${.4 + .6 * tw})`; g.fillRect(Math.round(x + 9), Math.round(y - 12), 2, 2); }
  return true;
}
/* the paper doll draws the same descriptor as the world (front view, crisp SVG) */
/* the paper doll and the character creator read the same descriptor as the world. Painted mode: no portrait-specific paperdoll
   art exists yet (docs/handoffs/paperdoll-v1.md), so the doll shows the painted front-facing frame at an exact 2× — interim. */
function humanFigureURL(D, dir, ghost) {
  if (HUMANS.mode === 'painted') { if (!PAINTED.ready) return null; const C = SF.HUMANART, P = SF.HUMANART.plan(PAINTED.reg, D, 'idle', dir || 'S'); if (!P.drawn) return null;
    const px = C.composeFrame(P, 0, PAINTED.img, PAINTED.img), c = document.createElement('canvas'); c.width = C.CANVAS.width; c.height = C.CANVAS.height; c.getContext('2d').putImageData(new ImageData(px, c.width, c.height), 0, 0); return c.toDataURL(); }
  const o = SF.RIG.fromDescriptor(D, { SF, direction: dir || 'S', action: (D.weapon && D.weapon.id !== 'unarmed') ? 'ready' : 'idle', frame: 0 }); return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SF.RIG.frameSVG(o));
}
function humanDollSrc() { if (!HUMANS.on || !P || P.ghost) return null; try { return humanFigureURL(humanDesc(P), 'S'); } catch (err) { return null; } }
function humanDollClass() { return HUMANS.mode === 'painted' ? 'doll painted' : 'doll rig'; }
/* developer inspector: what a person wears and whether it is real equipment */
function humanInspect(e) {
  if (!isHumanEnt(e)) return {}; const D = humanDesc(e); if (!D) return {};
  return { wardrobe: D.role + (D.region ? ' · ' + D.region : '') + (D.rank ? ' · ' + D.rank : '') + ' · ' + D.state + (D.fallback ? ' · FALLBACK' : ''),
    outfit: D.source === 'equip' ? 'real equipment (what is worn)' : 'cosmetic preset — not equipment, not loot',
    look: [D.body, D.skin, D.hair, D.style, D.beard].join(' / '), missingArt: (HUMANS.mode === 'painted' && PAINTED.reg ? paintedPlan(D, 'idle', e.sect || 0).missing : D.missing).join(', ') || 'none' };
}
/* QA lineup for screenshots and art review: every guard rank of every region, every civilian role, every human mob variant */
function humansLineup(opts) {
  const o = opts || {}, W = SF.WARDROBE, out = [];
  for (const reg in W.REGIONS) W.RANKS.forEach((rk, i) => { const a = { kind: 'npc', actorId: 'npc:lineup-' + reg + '-' + rk, role: 'guard', town: reg === 'saltmarsh' ? 'quay' : reg }; const sv = W.ACTOR_RANK[a.actorId]; W.ACTOR_RANK[a.actorId] = rk; out.push([reg + ' ' + rk, W.resolve(a, { rosterIndex: 0, night: o.night, watch: o.night })]); if (sv === undefined) delete W.ACTOR_RANK[a.actorId]; });
  for (const r in W.ROLES) if (!W.ROLES[r].realEquip) for (const b of ['male', 'female']) { const id = 'npc:lineup-' + r + '-' + b; W.ACTOR_ROLE[id] = r; W.ACTOR_BODY[id] = b; out.push([r + ' (' + b[0] + ')', W.resolve({ kind: 'npc', actorId: id, role: 'resident', name: r, life: { prof: 'x', doing: o.off ? 'social' : 'work' } }, {})]); delete W.ACTOR_ROLE[id]; delete W.ACTOR_BODY[id]; }
  for (const t in W.MOB_ROLE) for (let i = 0; i < W.HOSTILE[W.MOB_ROLE[t]].variants.length; i++) { let k = 0, id; do id = 'mon:' + t + ':' + (k++); while (W.hash32(id + '#v' + W.SEED_REV) % W.HOSTILE[W.MOB_ROLE[t]].variants.length !== i); out.push([t + ' v' + i, W.resolve({ kind: 'mon', type: t, actorId: id }, {})]); }
  return out;
}
/* ---- character creation: body type now; every other appearance option appears here as soon as its layer art is registered ---- */
function humansCreatorLook(cc, name) {   // what a new character saves: the chosen body plus a stable seeded identity for the options without art yet
  const W = SF.WARDROBE, body = cc.body === 'female' || cc.body === 'male' ? cc.body : W.identityFor('player:' + name).body;
  return Object.assign({ cloak: cc.cloak || null }, W.identityFor('player:' + name, { body }), { body, wv: W.SEED_REV });
}
function humansCreatorHtml(cc) { try { return humansCreatorHtml1(cc); } catch (err) { return ''; } }   // the creator first renders before this file has run
function humansCreatorHtml1(cc) {
  if (HUMANS.mode !== 'painted' || !PAINTED.reg) return '';
  const C = SF.HUMANART, av = C.availability(PAINTED.reg), body = cc.body === 'female' ? 'female' : 'male', dir = DIR_NAMES[cc.hdir || 0];
  const D = { body, pieces: {}, overlays: [], style: 'short', beard: 'none' }, src = humanFigureURL(D, dir);
  const off = [['Hairstyle', av.hairStyles.length], ['Hair colour', av.hairStyles.length], ['Beard', av.beards.length], ['Skin tone', av.skinTint], ['Clothing colours', av.clothTint]].filter(x => !x[1]).map(x => x[0]);
  return `<label>Body</label><div class="chips">${av.bodies.map(b => `<button class="btn sm ${b === body ? 'ac' : ''}" data-c="hbody" data-v="${b}">${b === 'male' ? 'Male' : 'Female'}</button>`).join('')}<button class="btn sm" data-c="hrot" aria-label="turn the preview">↻ ${dir}</button></div>
  ${src ? `<div class="ccpaint" style="background-image:url(&quot;${src}&quot;)"></div>` : ''}${off.length ? `<p class="note">${off.join(', ')}: coming with the layered character art (the painted bodies have hair and clothes painted in).</p>` : ''}`;
}
