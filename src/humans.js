/* ================= LAYERED HUMANS (NPC wardrobe & faction appearance v1.0; docs/wardrobe/STATUS.md) =================
   One renderer for every human: the player, Wren, townsfolk, guards and human mobs (bandit, smuggler, drowned captain).
   SF.WARDROBE.resolve() decides what a person wears (real equipment when they have it, a disclosed cosmetic preset when they
   do not); SF.RIG draws it (procedural prototype art, NOT the painted production atlas). Behind a flag: the painted Saltmarsh
   Scout stays the default until the layered art is approved. Turn it on in the menu ("Human art") or with ?humans=layered.
   Performance: SVG is built and decoded off the draw call (a small time-budgeted queue), one strip per
   appearance × action × direction, kept in a bounded LRU; while a strip is pending the old sprite is drawn. */
const HUMANS = { on: false, scale: 1.12, cap: 96, strips: new Map(), queue: [], queued: new Set(), pumping: false, built: 0, evicted: 0, buildMs: 0, roster: null, errors: 0 };
{ const q = new URLSearchParams(location.search).get('humans'); HUMANS.on = q ? q === 'layered' : SETTINGS.humans === 'layered'; }
function humansToggle() { HUMANS.on = !HUMANS.on; SETTINGS.humans = HUMANS.on ? 'layered' : 'classic'; saveSettings(); }
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
function humanStrip(D, action, dir, needNow) {
  const k = D.key + '#' + action + '#' + dir; const s = HUMANS.strips.get(k);
  if (s) { HUMANS.strips.delete(k); HUMANS.strips.set(k, s); return s; }   // LRU touch
  if (!HUMANS.queued.has(k)) { HUMANS.queued.add(k); HUMANS.queue.push({ k, D, action, dir }); humansPump(); }
  return null;
}
function humansPump() {
  if (HUMANS.pumping) return; HUMANS.pumping = true;
  setTimeout(async () => {
    const t0 = performance.now(), R = SF.RIG, S = HUMANS.scale;
    while (HUMANS.queue.length && performance.now() - t0 < 6) {
      const j = HUMANS.queue.shift(); const n = R.ANIMATIONS[j.action] || 1, cw = R.CELL.width, ch = R.CELL.height; let body = '';
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
    HUMANS.buildMs += performance.now() - t0; HUMANS.pumping = false; if (HUMANS.queue.length) humansPump();
  }, 0);
}
function humanBlit(g, s, f, x, y) { const S = HUMANS.scale, R = SF.RIG.CELL; f = Number.isFinite(f) ? f : 0; g.imageSmoothingEnabled = false; g.drawImage(s, Math.min(f, s.n - 1) * s.cw, 0, s.cw, s.height, Math.round(x - R.anchorX * S), Math.round(y - R.anchorY * S), s.cw, s.height); }
/* draw a living human; false → the caller draws the old sprite (flag off, ghost, or the strip is still being built) */
function drawHuman(g, e, x, y) {
  if (!HUMANS.on || !isHumanEnt(e) || e.ghost || (e === P && P.ghost)) return false;
  const D = humanDesc(e); if (!D) return false;
  const [ac, f] = humanAnim(e, D), dir = e.sect || 0;
  let s = humanStrip(D, ac, dir);
  if (!s && ac !== 'idle') { s = humanStrip(D, 'idle', dir); if (s) { humanBlit(g, s, 0, x, y); return true; } }
  if (!s) return false;
  let ox = 0, oy = 0; if (e.lunge) { const k = Math.sin(e.lunge * Math.PI) * 4, a = SECT_ANG[dir] * Math.PI / 180; ox = Math.cos(a) * k; oy = Math.sin(a) * k * .5; }
  humanBlit(g, s, f, x + ox, y + oy); return true;
}
/* corpses keep the last resolved appearance (a snapshot taken at death; loot is untouched and decides nothing here) */
function humanSnap(e) { if (!isHumanEnt(e)) return null; try { return humanDesc(e); } catch (err) { return null; } }
function drawHumanCorpse(g, c, x, y) {
  if (!HUMANS.on || !c.wd) return false; const fresh = GT - (c.t0 || 0) < .6;
  const s = humanStrip(c.wd, fresh ? 'death' : 'corpse', c.sect || 0); if (!s) return false;
  humanBlit(g, s, fresh ? Math.floor((GT - (c.t0 || 0)) / .075) : 0, x, y);
  if (c.cont && c.cont.items && c.cont.items.length) { const tw = (Math.sin(GT * 5 + c.x) + 1) / 2; g.fillStyle = `rgba(255,224,120,${.4 + .6 * tw})`; g.fillRect(Math.round(x + 9), Math.round(y - 12), 2, 2); }
  return true;
}
/* the paper doll draws the same descriptor as the world (front view, crisp SVG) */
function humanDollSrc() { if (!HUMANS.on || !P || P.ghost) return null; try { const D = humanDesc(P), o = SF.RIG.fromDescriptor(D, { SF, direction: 'S', action: (D.weapon && D.weapon.id !== 'unarmed') ? 'ready' : 'idle', frame: 0 }); return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SF.RIG.frameSVG(o)); } catch (err) { return null; } }
/* developer inspector: what a person wears and whether it is real equipment */
function humanInspect(e) {
  if (!isHumanEnt(e)) return {}; const D = humanDesc(e); if (!D) return {};
  return { wardrobe: D.role + (D.region ? ' · ' + D.region : '') + (D.rank ? ' · ' + D.rank : '') + ' · ' + D.state + (D.fallback ? ' · FALLBACK' : ''),
    outfit: D.source === 'equip' ? 'real equipment (what is worn)' : 'cosmetic preset — not equipment, not loot',
    look: [D.body, D.skin, D.hair, D.style, D.beard].join(' / '), missingArt: D.missing.length ? D.missing.join(', ') : 'none' };
}
/* QA lineup for screenshots and art review: every guard rank of every region, every civilian role, every human mob variant */
function humansLineup(opts) {
  const o = opts || {}, W = SF.WARDROBE, out = [];
  for (const reg in W.REGIONS) W.RANKS.forEach((rk, i) => { const a = { kind: 'npc', actorId: 'npc:lineup-' + reg + '-' + rk, role: 'guard', town: reg === 'saltmarsh' ? 'quay' : reg }; const sv = W.ACTOR_RANK[a.actorId]; W.ACTOR_RANK[a.actorId] = rk; out.push([reg + ' ' + rk, W.resolve(a, { rosterIndex: 0, night: o.night, watch: o.night })]); if (sv === undefined) delete W.ACTOR_RANK[a.actorId]; });
  for (const r in W.ROLES) if (!W.ROLES[r].realEquip) for (const b of ['male', 'female']) { const id = 'npc:lineup-' + r + '-' + b; W.ACTOR_ROLE[id] = r; W.ACTOR_BODY[id] = b; out.push([r + ' (' + b[0] + ')', W.resolve({ kind: 'npc', actorId: id, role: 'resident', name: r, life: { prof: 'x', doing: o.off ? 'social' : 'work' } }, {})]); delete W.ACTOR_ROLE[id]; delete W.ACTOR_BODY[id]; }
  for (const t in W.MOB_ROLE) for (let i = 0; i < W.HOSTILE[W.MOB_ROLE[t]].variants.length; i++) { let k = 0, id; do id = 'mon:' + t + ':' + (k++); while (W.hash32(id + '#v' + W.SEED_REV) % W.HOSTILE[W.MOB_ROLE[t]].variants.length !== i); out.push([t + ' v' + i, W.resolve({ kind: 'mon', type: t, actorId: id }, {})]); }
  return out;
}
