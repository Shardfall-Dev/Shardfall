/* ================= LIVING WORLD runtime (Phase 2): fixed step, world clock, light, navigation, developer panel =================
   Game-side half of the Living World work; the pure parts live in src/world.js (SIM). Progress: docs/WORLD_SIMULATION_PROGRESS.md.
   This file sits inside the game block before src/game.js: everything here runs at boot or later, never at load. */

/* ---------- fixed simulation step: the loop runs update() in 50 ms steps; the renderer interpolates between the last two ---------- */
const STEPPER = SIM.newStepper({ step: .05, maxSteps: 5 });
let SIMPAUSE = false, ALPHA = 0;
function simStep(dt) { for (const e of ents) { e._px = e.x; e._py = e.y; } update(dt); }
/* draw the world as it was (1 − alpha) of a step ago: positions blend between the last two steps and the render clock
   trails the simulation by the same amount, so nothing on screen is ever ahead of the simulation */
function renderInterp() {
  const a = ALPHA, saved = []; const gt = GT;
  for (const e of ents) if (e._px !== undefined && !e.gone) { const dx = e.x - e._px, dy = e.y - e._py; if ((dx || dy) && dx * dx + dy * dy < 9) { saved.push(e, e.x, e.y); e.x = e._px + dx * a; e.y = e._py + dy * a; } }
  GT = gt - (1 - a) * STEPPER.step * (SIMPAUSE ? 0 : 1);
  try { render(); } finally { GT = gt; for (let i = 0; i < saved.length; i += 3) { saved[i].x = saved[i + 1]; saved[i].y = saved[i + 2]; } }
}

/* ---------- world clock (§5) ---------- */
const PERIOD_GLYPH = { deepnight: '☾', dawn: '◐', day: '☀', sunset: '◐', night: '☾' };
const PERIOD_NAME = { deepnight: 'Deep night', dawn: 'Dawn', day: 'Daylight', sunset: 'Sunset', night: 'Night' };
function clockText() { const h = hourOfDay(), p = SIM.periodOf(h); return PERIOD_GLYPH[p] + ' ' + SIM.fmtHour(h); }

/* ---------- light (§6): outdoor light by hour, dungeons on their own, Night Sight brightens without turning night to day ---------- */
function lightNow() {
  if (P && levelAt(Math.floor(P.x), Math.floor(P.y))) return { dark: nightSight() ? .3 : .8, col: [6, 8, 24], dungeon: true };
  const l = SIM.lightAt(hourOfDay()); if (nightSight()) l.dark *= .35; return l;
}
const GLOW = { fire: '255,170,80', lamp: '255,205,120', magic: '170,140,255', wisp: '255,140,60', window: '255,190,110' };
/* every light in view this frame: placed lamps, forges and fires (LIGHTS), lit doorways after dusk, glowing creatures, fire in flight, blasts */
function frameLights(dark, inDun) {
  const out = []; for (const l of LIGHTS) out.push([l.x + .5, l.y + .5, l.r, l.kind || 'lamp']);
  if (!inDun && dark > .25) for (const d of DOORS) out.push([d.x + .5, d.y + .3, 2.4, 'window']);
  for (const e of ents) if (!e.gone && e.type === 'wisp') out.push([e.x, e.y, 3, 'wisp']);
  for (const f of EFX) if (f.k === 'proj' && f.col && GT >= f.t0) { const k = Math.min(1, (GT - f.t0) / Math.max(.01, f.t1 - f.t0)); out.push([f.x + (f.tx - f.x) * k, f.y + (f.ty - f.y) * k, 2.2, f.col === '#e8dcc0' ? null : /^#ff[89a-f]/.test(f.col) ? 'fire' : 'magic']); }
  for (const f of FX) if (f.k === 'boom') out.push([f.x, f.y, 3, 'fire']);
  return out.filter(l => l[3]);
}
/* light shapes are drawn once per size and colour and reused every frame (a gradient per light per frame is slow on phones) */
const LSPR = new Map();
function lightSprite(kind, RR) {
  const k = kind + ':' + RR; let c = LSPR.get(k); if (c) return c; c = document.createElement('canvas'); c.width = c.height = RR * 2; const g = c.getContext('2d'), gr = g.createRadialGradient(RR, RR, kind === 'hole' ? RR * .15 : 0, RR, RR, RR);
  if (kind === 'hole') { gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.6, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); } else { gr.addColorStop(0, `rgba(${GLOW[kind]},1)`); gr.addColorStop(1, `rgba(${GLOW[kind]},0)`); }
  g.fillStyle = gr; g.fillRect(0, 0, RR * 2, RR * 2); LSPR.set(k, c); return c;
}
function drawLight(LW, LH, camX, camY) {
  const L = lightNow(); if (L.dark <= .02) return; const inDun = !!L.dungeon, dk = L.dark, c = L.col;
  lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, LW, LH); lctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${dk})`; lctx.fillRect(0, 0, LW, LH); lctx.globalCompositeOperation = 'destination-out';
  const lights = frameLights(dk, inDun), vis = [];
  const hole = (wx, wy, r) => { const X = SX(wx, wy) - camX, Y = SY(wx, wy) - 24 - camY, RR = Math.round(r * HW * 1.25); if (X < -RR || Y < -RR || X > LW + RR || Y > LH + RR) return false; lctx.drawImage(lightSprite('hole', RR), Math.round(X - RR), Math.round(Y - RR)); return true; };
  hole(P.x, P.y, nightSight() ? 8 : 4.5); for (const l of lights) if (hole(l[0], l[1], l[2])) vis.push(l);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lc, 0, 0);
  const k = Math.min(1, dk / .62) * .32; if (k < .02) return;                     // a warm glow around fires and lamps, stronger the darker it is
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = k; for (const [wx, wy, r, kind] of vis) { const X = SX(wx, wy) - camX, Y = SY(wx, wy) - 24 - camY, RR = Math.round(r * HW * .9); ctx.drawImage(lightSprite(kind, RR), Math.round(X - RR), Math.round(Y - RR)); }
  ctx.restore();
}

/* ---------- navigation (§14): walkable tiles, A* in budgeted slices, a travel graph for long journeys ---------- */
const NAV = { walk: null, graph: null, jobs: [], cache: SIM.newLRU(256), epoch: 0, budget: 3000, spent: 0, searches: 0, failed: 0, hits: 0 };
const NAV_R = .26;   // the same body radius canStand uses
function staticCol(x, y, r) { const a = ECOL.get(Math.floor(y) * W + Math.floor(x)); if (a) for (const c of a) if (x + r > c[0] && x - r < c[2] && y + r > c[1] && y - r < c[3]) return true; return false; }
/* can an actor stand at this tile's centre, ignoring doors (they change) — cached per tile */
function navStatic(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return false; if (!NAV.walk) NAV.walk = new Uint8Array(W * H); const k = y * W + x, v = NAV.walk[k]; if (v) return v === 1;
  const t = tAt(x, y), cx = x + .5, cy = y + .5; let ok = !(t === T.WA || (BLK[t] && !SOFT[t])) && !(levelAt(x, y) && VOID[k]) && !staticCol(cx, cy, NAV_R);
  if (ok) for (const [ox, oy] of [[-NAV_R, -NAV_R], [NAV_R, -NAV_R], [-NAV_R, NAV_R], [NAV_R, NAV_R]]) { const tt = tAt(Math.floor(cx + ox), Math.floor(cy + oy)); if (BLK[tt] && !SOFT[tt]) { ok = false; break; } }
  NAV.walk[k] = ok ? 1 : 2; return ok;
}
/* can a body move straight from one point to another? Swept against the colliders, which lie on tile edges (walls are
   0.15 m strips), against hard tiles, and against closed doors unless this actor opens doors */
function closedDoorAt(x, y, r) { const ds = DOORK.get(Math.floor(y) * W + Math.floor(x)); if (ds) for (const d of ds) { const c = d.col; if (!d.open && x + r > c[0] && x - r < c[2] && y + r > c[1] && y - r < c[3]) return d; } return null; }
function segFree(ax, ay, bx, by, doors) {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 6));
  for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n; if (staticCol(x, y, NAV_R)) return false; if (!doors && closedDoorAt(x, y, NAV_R)) return false;
    for (const [ox, oy] of [[-NAV_R, -NAV_R], [NAV_R, -NAV_R], [-NAV_R, NAV_R], [NAV_R, NAV_R]]) { const t = tAt(Math.floor(x + ox), Math.floor(y + oy)); if (t === T.WA || (BLK[t] && !SOFT[t])) return false; } }
  return true;
}
const NDIR = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
/* the static part of a tile-to-tile step, cached (two bits per direction: known, free); doors are checked live */
function navCanStep(o) { return (x, y, nx, ny) => {
  if (!NAV.edge) { NAV.edge = new Uint8Array(W * H); NAV.edgeOk = new Uint8Array(W * H); }
  const k = y * W + x, bit = 1 << NDIR.findIndex(([dx, dy]) => dx === nx - x && dy === ny - y);
  if (!(NAV.edge[k] & bit)) { NAV.edge[k] |= bit; if (segFree(x + .5, y + .5, nx + .5, ny + .5, true)) NAV.edgeOk[k] |= bit; }
  if (!(NAV.edgeOk[k] & bit)) return false;
  if (!o.doors && (DOORK.has(k) || DOORK.has(ny * W + nx)) && !segFree(x + .5, y + .5, nx + .5, ny + .5, false)) return false;
  return true; }; }
function doorOn(x, y) { const ds = DOORK.get(y * W + x); if (ds) for (const d of ds) { const c = d.col, cx = x + .5, cy = y + .5; if (cx + NAV_R > c[0] && cx - NAV_R < c[2] && cy + NAV_R > c[1] && cy - NAV_R < c[3]) return d; } return null; }
/* species and role rules: who may open doors, who keeps out of protected towns */
function navPass(o) { return (x, y) => { if (!navStatic(x, y)) return false; if (o.avoidProt && protAt(x, y)) return false; return true; }; }   // doors are judged per step (navCanStep)
const navCost = (x, y) => { const t = tAt(x, y); return t === T.RD || t === T.BR || t === T.SBR ? .7 : 1; };
/* a smoothed leg must be free all the way (swept), and must not pass over tiles the search would refuse (protected towns for creatures) */
function navClear(pass, o) { return (ax, ay, bx, by) => { const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 3); for (let i = 1; i < n; i++) if (!pass(Math.floor(ax + .5 + (bx - ax) * i / n), Math.floor(ay + .5 + (by - ay) * i / n))) return false; return segFree(ax + .5, ay + .5, bx + .5, by + .5, o.doors); }; }
const navFlags = o => (o.doors ? 'd' : '') + (o.avoidProt ? 'p' : '');
/* ask for a path; the answer arrives in a later step (or at once from the cache) */
/* the nearest standable tile to (x, y) within r, or (x, y) itself: a path starts and ends on open ground */
function navSnap(x, y, r) { if (navStatic(x, y)) return [x, y]; for (let k = 1; k <= (r || 3); k++) for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === k && navStatic(x + dx, y + dy)) return [x + dx, y + dy]; return [x, y]; }
function navRequest(sx, sy, gx, gy, o, fresh) {
  [sx, sy] = navSnap(sx, sy); [gx, gy] = navSnap(gx, gy);
  const key = sx + ',' + sy + '>' + gx + ',' + gy + '|' + navFlags(o) + '|' + NAV.epoch, hit = !fresh && NAV.cache.get(key);
  const job = { key, status: 'running', path: null, reason: null };
  if (hit) { NAV.hits++; job.status = 'found'; job.path = hit; return job; }
  const pad = 40, b = [Math.max(0, Math.min(sx, gx) - pad), Math.max(0, Math.min(sy, gy) - pad), Math.min(W - 1, Math.max(sx, gx) + pad), Math.min(H - 1, Math.max(sy, gy) + pad)];
  const pass = navPass(o); job.o = o; job.search = SIM.newSearch({ sx, sy, gx, gy, passable: pass, canStep: navCanStep(o), cost: navCost, minCost: .7, maxNodes: o.maxNodes || 30000, goalR: o.goalR || 1.5, bounds: b }); job.pass = pass;
  NAV.jobs.push(job); NAV.searches++; return job;
}
/* run queued searches within this step's budget, oldest first (§14: stagger and limit expensive searches) */
function navTick() {
  let left = NAV.budget; NAV.spent = 0;
  while (left > 0 && NAV.jobs.length) {
    const j = NAV.jobs[0], before = j.search.expanded, st = j.search.step(left); const used = j.search.expanded - before; left -= Math.max(1, used); NAV.spent += used;
    if (st === 'running') continue;
    NAV.jobs.shift(); j.status = st;
    if (st === 'found') { j.path = SIM.smoothPath(j.search.path, navClear(j.pass, j.o)); NAV.cache.set(j.key, j.path); } else { j.reason = j.search.reason; NAV.failed++; }
    j.search = null;
  }
}

/* the travel graph: road points (merged where roads meet), towns, landmarks, piers, moongates and dungeon stairs */
function buildNavGraph() {
  const G = SIM.newNavGraph(); let n = 0; const pts = [];
  const snap = (x, y) => { if (navStatic(Math.floor(x), Math.floor(y))) return [x, y]; for (let r = 1; r <= 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && navStatic(Math.floor(x) + dx, Math.floor(y) + dy)) return [Math.floor(x) + dx + .5, Math.floor(y) + dy + .5]; return [x, y]; };
  const node = (x, y, o) => { [x, y] = snap(x, y);   // a named place in the water (a ford, a strand) is reached at its nearest dry tile
 for (const p of pts) if (Math.hypot(p.x - x, p.y - y) < 3.5 && !o.keep) { if (o.name && !G.node(p.id).name) Object.assign(G.node(p.id), { name: o.name, kind: o.kind }); return p.id; } const id = (o.kind || 'pt') + ':' + (n++); G.addNode(id, Object.assign({ x, y }, o)); pts.push({ id, x, y }); return id; };
  const road = (poly, name) => { let prev = null; for (let i = 0; i < poly.length; i++) { const [x, y] = poly[i]; if (prev) { const p = G.node(prev), d = Math.hypot(x - p.x, y - p.y), k = Math.ceil(d / 25); for (let s = 1; s < k; s++) { const id = node(p.x + (x - p.x) * s / k, p.y + (y - p.y) * s / k, { kind: 'road', road: name }); G.addEdge(prev, id); prev = id; } } const id = node(x, y, { kind: 'road', road: name }); if (prev) G.addEdge(prev, id); prev = id; } };
  for (const [k, poly] of Object.entries(ROUTE)) road(poly, k);
  for (const [k, poly] of Object.entries(ANN.roads || {})) road(poly, k);
  // join a place to the nearest point of each road within reach and to the nearest town, so a town where two roads begin joins both
  // a link is made only if a walker can really get there (A* over the same tiles the navigator uses), so no link crosses a channel
  const walkPass = navPass({ doors: true }), walkStep = navCanStep({ doors: true }); let checks = 0;
  const reach = (a, b) => { checks++; const s0 = navSnap(Math.floor(a.x), Math.floor(a.y)), g0 = navSnap(Math.floor(b.x), Math.floor(b.y)); const pad = Math.max(40, Math.round(Math.hypot(a.x - b.x, a.y - b.y) * .4)), s = SIM.findPath({ sx: s0[0], sy: s0[1], gx: g0[0], gy: g0[1], passable: walkPass, canStep: walkStep, cost: navCost, minCost: .7, maxNodes: b.maxNodes || 60000, goalR: 1.5,
    bounds: [Math.min(a.x, b.x) - pad, Math.min(a.y, b.y) - pad, Math.max(a.x, b.x) + pad, Math.max(a.y, b.y) + pad] }); return s.status === 'found' ? s.path : null; };
  const link = (id, maxD, any) => { const a = G.node(id), cand = {};
    for (const r of G.ids()) { if (r === id) continue; const b = G.node(r); if (!any && b.kind !== 'road' && b.kind !== 'town') continue; if (b.kind === 'stair' || b.kind === 'gate' || b.kind === 'pier') continue; const d = Math.hypot(a.x - b.x, a.y - b.y); if (d > maxD) continue; const k = any ? 'any:' + b.kind : b.kind === 'road' ? 'road:' + b.road : 'town'; (cand[k] = cand[k] || []).push({ r, d }); }
    let n = 0; for (const k in cand) for (const c of cand[k].sort((p, q) => p.d - q.d).slice(0, any ? 8 : 3)) { const path = reach(a, G.node(c.r)); if (!path) continue; chain(id, c.r, path); n++; break; } return n; };
  // a long link is laid along its verified path as short legs (≤ 35 tiles), so every leg stays within one search budget
  const chain = (a, b, path) => { let prev = a; for (let i = 35; i < path.length - 12; i += 35) { const [x, y] = path[i]; const id = 'trail:' + (n++); G.addNode(id, { x: x + .5, y: y + .5, kind: 'trail' }); G.addEdge(prev, id); prev = id; } G.addEdge(prev, b); };
  for (const t of ANN.towns || []) link(node(t.x, t.y, { kind: 'town', name: t.n, keep: 1 }), 70);
  const lms = Object.entries(LM).map(([k, l]) => { const id = node(l.x + .5, l.y + .5, { kind: k === 'quay' ? 'town' : 'landmark', name: l.n, keep: 1 }); link(id, 60); return id; });
  for (const id of lms) if (G.edges(id).length === 0 || G.node(id).kind === 'landmark') link(id, 160, true);   // wilderness landmarks off the roads join the nearest place
  for (const r of ANN.routes || []) { const w = r.id === 'packet' ? 'packet' : r.kind; const a = node(r.a.x, r.a.y, { kind: 'pier', name: r.a.n + ' ' + w + ' pier', keep: 1 }), b = node(r.b.x, r.b.y, { kind: 'pier', name: r.b.n + ' ' + w + ' pier', keep: 1 }); link(a, 200); link(b, 200); G.addEdge(a, b, { kind: 'travel', cost: 25, via: w }); }
  // camps, dungeon mouths and Southwatch join the road where their trail meets it (known from the frontier build), else the nearest place
  for (const st of (typeof FRONT !== 'undefined' ? FRONT.sites : [])) { const id = node(st.x + .5, st.y + (st.k === 'dungeon' ? 2.5 : .5), { kind: st.k, name: st.n, keep: 1 });
    const j = st.join && G.nearest(st.join[0], st.join[1], q => q.kind === 'road' || q.kind === 'town'), path = j && reach(G.node(id), Object.assign({ maxNodes: 120000 }, j));
    if (path) chain(id, j.id, path); else link(id, 280, true); }
  const gates = (ANN.gates || []).map(g => { const id = node(g.x, g.y, { kind: 'gate', name: (g.n || '') + ' moongate', keep: 1 }); link(id, 200); return id; });
  for (const a of gates) for (const b of gates) if (a < b) G.addEdge(a, b, { kind: 'travel', cost: 15, via: 'moongate' });
  const st = STAIRS.map(s => ({ s, a: node(s.x + .5, s.y + .5, { kind: 'stair', keep: 1 }), b: node(s.to.x, s.to.y, { kind: 'stair', keep: 1 }) }));
  for (const { a, b } of st) G.addEdge(a, b, { kind: 'travel', cost: 4, via: 'stairs', oneWay: true });
  const stairNodes = [...new Set(st.flatMap(o => [o.a, o.b]))];
  for (const a of stairNodes) for (const b of stairNodes) if (a < b) { const A = G.node(a), B = G.node(b); if (levelAt(Math.floor(A.x), Math.floor(A.y)) === levelAt(Math.floor(B.x), Math.floor(B.y)) && levelAt(Math.floor(A.x), Math.floor(A.y))) G.addEdge(a, b); }
  for (const a of stairNodes) { const A = G.node(a); if (!levelAt(Math.floor(A.x), Math.floor(A.y))) link(a, 160, true); }   // a dungeon mouth in the wilds joins the nearest place
  G.checks = checks; return G;
}
const navGraph = () => NAV.graph || (NAV.graph = buildNavGraph());
const navPlaces = () => navGraph().ids().map(id => navGraph().node(id)).filter(n => n.name && n.kind !== 'road' && n.kind !== 'stair');

/* ---------- the navigator: one actor following a journey leg by leg, opening doors, recovering when stuck ---------- */
function navTo(e, gx, gy, o) {
  o = Object.assign({ doors: true, speed: SF.WALK, name: null }, o || {});
  const sameLevel = levelAt(Math.floor(e.x), Math.floor(e.y)) === levelAt(Math.floor(gx), Math.floor(gy)), near = sameLevel && (o.direct || Math.hypot(gx - e.x, gy - e.y) < 60);   // direct: one local search (sliced over steps), no travel graph
  let legs = [];
  if (near) legs = [{ kind: 'walk', x: gx, y: gy }];
  else {
    const G = navGraph();   // built on first long journey only: short trips (creatures going home, packs) never pay for it
    const lvl = n => levelAt(Math.floor(n.x), Math.floor(n.y)), ls = levelAt(Math.floor(e.x), Math.floor(e.y)), lg = levelAt(Math.floor(gx), Math.floor(gy));
    const a = G.nearest(e.x, e.y, n => lvl(n) === ls), b = G.nearest(gx, gy, n => lvl(n) === lg), r = a && b && G.route(a.id, b.id);
    if (!r) { e.nav = { state: 'failed', reason: 'no route', goal: { x: gx, y: gy, name: o.name }, o }; return e.nav; }
    legs.push({ kind: 'walk', x: a.x, y: a.y }); for (const l of r.legs) { const t = G.node(l.to); legs.push(l.kind === 'travel' ? { kind: 'travel', x: t.x, y: t.y, via: l.via } : { kind: 'walk', x: t.x, y: t.y }); } legs.push({ kind: 'walk', x: gx, y: gy });
  }
  e.nav = { state: 'moving', goal: { x: gx, y: gy, name: o.name }, o, legs, li: 0, wp: null, wi: 0, job: null, prog: { t: GT, x: e.x, y: e.y, d: Infinity }, stuck: 0, retries: 0, opened: [], t0: GT };
  return e.nav;
}
function navFail(e, reason) { const n = e.nav; n.state = 'failed'; n.reason = reason; e.speed = 0; navCloseDoors(e, 1); }
/* close the doors this actor opened once it is past them and nobody stands in the doorway (§14: doors are used, not left open) */
function navCloseDoors(e, minD) { const n = e.nav; if (!n || !n.opened || !n.opened.length) return;
  for (const d of n.opened.slice()) if (Math.hypot(d.x + .5 - e.x, d.y - e.y) > minD) { const c = d.col, r = .3, blocked = ents.some(o => !o.gone && o.kind !== 'corpse' && o.x + r > c[0] && o.x - r < c[2] && o.y + r > c[1] && o.y - r < c[3]); if (blocked) continue;
    if (d.open) { setDoor(d, false); sndAt('door.' + d.mat + '.close', { x: d.x + .1, y: d.y }, { key: 'door' + d.key }); } n.opened.splice(n.opened.indexOf(d), 1); } }
function navStep(e, dt) {
  const n = e.nav; if (!n || n.state !== 'moving') { e.speed = 0; return; }
  navCloseDoors(e, 2.2);
  const leg = n.legs[n.li]; if (!leg) { n.state = 'done'; e.speed = 0; navCloseDoors(e, 1); return; }
  if (leg.kind === 'travel') { e.x = leg.x; e.y = leg.y; if (leg.via !== 'stairs') { for (const [ox, oy] of [[0, 2.7], [2.7, 0], [-2.7, 0], [0, -2.7]]) if (canStand(e, leg.x + ox, leg.y + oy)) { e.x = leg.x + ox; e.y = leg.y + oy; break; } } n.li++; n.wp = null; n.prog = { t: GT, x: e.x, y: e.y, d: Infinity }; return; }
  if (!n.wp) {
    if (!n.job) n.job = navRequest(Math.floor(e.x), Math.floor(e.y), Math.floor(leg.x), Math.floor(leg.y), n.o, n.retries > 0);
    if (n.job.status === 'running') { e.speed = 0; if (GT - n.prog.t > 8) return navFail(e, 'timeout'); return; }
    if (n.job.status === 'failed') { if (n.retries++ < 1) { n.job = null; return; } return navFail(e, n.job.reason); }
    n.wp = n.job.path.map(([x, y]) => [x + .5, y + .5]); if (n.li === n.legs.length - 1 && canStand(e, leg.x, leg.y)) n.wp[n.wp.length - 1] = [leg.x, leg.y];   // the exact goal only if one can stand there
    n.wi = 1; n.job = null; n.prog = { t: GT, x: e.x, y: e.y, d: Infinity };
  }
  if (n.wi >= n.wp.length) { n.li++; n.wp = null; n.stuck = 0; n.retries = 0; if (n.li >= n.legs.length) { n.state = 'done'; e.speed = 0; navCloseDoors(e, 1); } return; }
  const [tx, ty] = n.wp[n.wi], dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy);
  if (l < .35) { n.wi++; return; }
  { const d = nearDoorTo(e, 1.2); if (d && ents.some(o => o !== e && !o.gone && o.kind === 'npc' && o.nav && o.nav.state === 'moving' && Math.hypot(o.x - d.x - .5, o.y - d.y) < .7 && o.id < e.id) && (n.doorWait || 0) < 1.2) { n.doorWait = (n.doorWait || 0) + dt; e.speed = 0; return; } if (!d) n.doorWait = 0; }   // one at a time through a doorway (§14 crowding)
  if (n.o.doors) { const d = nearDoorTo(e, 1.4); if (d && !d.open) { setDoor(d, true); n.opened.push(d); sndAt('door.' + d.mat + '.open', { x: d.x + .1, y: d.y }, { key: 'door' + d.key }); } }
  const s = Math.min(l, n.o.speed * MOVE_SCALE * dt), mv = moveBy(e, dx / l * s, dy / l * s);
  if (mv < s * .3) moveBy(e, (n.stuck % 2 ? 1 : -1) * -dy / l * s, (n.stuck % 2 ? 1 : -1) * dx / l * s);
  e.speed = mv / Math.max(dt, 1e-6); updateFacing(e, dx, dy);
  /* stuck recovery (§14): progress is distance gained towards the waypoint, so sliding along a wall does not count.
     No gain for 1.5 s: sidestep the other way; twice: plan again from here; four times: give up and let the controller choose */
  const dw = Math.hypot(tx - e.x, ty - e.y);
  if (GT - n.prog.t >= 1.5) {
    if (!(dw < (n.prog.d === undefined ? Infinity : n.prog.d) - .3)) { n.stuck++; if (n.stuck === 2) { n.wp = null; n.retries = 1; } if (n.stuck >= 4) return navFail(e, 'stuck'); } else n.stuck = 0;
    n.prog = { t: GT, x: e.x, y: e.y, d: dw }; }
}
function nearDoorTo(e, r) { let best = null, bd = r; for (const d of DOORS) { const dd = Math.hypot(d.x + .5 - e.x, d.y - e.y); if (dd < bd) { bd = dd; best = d; } } return best; }

/* townsfolk controller: follow a travel goal if one is set (developer travellers in this phase; daily routines are phase 4). A traveller
   that cannot reach its goal heads home instead, once. */
function townTick(e, dt) {
  if (!e.nav) return; if (e.nav.state === 'moving') return navStep(e, dt);
  if (e.nav.state === 'failed' && e.dev && !e.nav.home && e.home) { const why = e.nav.reason; navTo(e, e.home.x, e.home.y, { name: 'home' }); e.nav.home = true; e.nav.why = why; say(e, 'No way through. Heading back.'); return; }
  if (e.nav.state === 'done' && !e.nav.said && e.dev) { e.nav.said = true; say(e, e.nav.goal.name ? 'Arrived at ' + e.nav.goal.name + '.' : 'Arrived.'); }
  e.speed = 0;
}
let DEVN = 0;
function devTraveller(placeId, from) {
  const G = navGraph(), t = G.node(placeId); if (!t) return null; from = from || P;
  let x = from.x + 1.5, y = from.y + 1; for (const [ox, oy] of [[1.5, 1], [-1.5, 1], [1, -1.5], [0, 2]]) if (canStand(P, from.x + ox, from.y + oy)) { x = from.x + ox; y = from.y + oy; break; }
  const e = addEnt({ kind: 'npc', role: 'traveller', dev: true, name: 'Traveller ' + (++DEVN), x, y, sect: 0, home: { x, y } });
  navTo(e, t.x, t.y, { name: t.name }); return e;
}

/* ---------- developer panel (§27): only with ?dev in the address; never reachable in normal play ---------- */
const DEV = { on: /[?&#]dev\b/.test(location.search + location.hash), open: false, show: { paths: true, perception: false, territory: false, collision: false, factions: false }, fps: 0, frames: 0, fpsT: 0, aiMs: 0, steps: 0, stepRate: 0, lastSave: null, advance: 0 };
function devInit() {
  if (!DEV.on || document.getElementById('devp')) return;
  const b = document.createElement('button'); b.id = 'devb'; b.textContent = 'DEV'; b.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:60;font:10px monospace;padding:3px 6px;background:#402020;color:#ffd0a0;border:1px solid #a06040;border-radius:4px;opacity:.8';
  const p = document.createElement('div'); p.id = 'devp'; p.hidden = true; p.style.cssText = 'position:fixed;left:4px;top:4px;bottom:30px;width:min(330px,62vw);overflow:auto;z-index:61;background:rgba(8,10,16,.9);color:#d8e0e8;font:10px/1.35 monospace;padding:6px;border:1px solid #445;border-radius:6px';
  document.body.append(b, p);
  b.addEventListener('click', () => { DEV.open = !DEV.open; p.hidden = !DEV.open; devRender(); });
  p.addEventListener('click', ev => { const t = ev.target.closest('[data-dev]'); if (!t) return; ev.stopPropagation(); devAct(t.dataset.dev, t.dataset); devRender(); });
  p.addEventListener('change', ev => { const t = ev.target; if (t.dataset.show) { DEV.show[t.dataset.show] = t.checked; } });
  p.addEventListener('pointerdown', ev => ev.stopPropagation());
}
function devAct(a, d) {
  const C = WS.clock;
  if (a === 'hour') C.setHour(GT, +d.h);
  if (a === 'shift') C.setHour(GT, C.hourAt(GT) + +d.h);
  if (a === 'daynight') { const p = C.periodAt(GT); C.setHour(GT, p === 'day' || p === 'dawn' ? 23 : 12); }
  if (a === 'pause') SIMPAUSE = !SIMPAUSE;
  if (a === 'step') { simStep(STEPPER.step); }
  if (a === 'adv') DEV.advance += +d.s;                                                // run that many simulation seconds, a slice per frame
  if (a === 'spawn') { const id = document.getElementById('devdest').value; const e = devTraveller(id); if (e) { P.sel = e; log('Spawned ' + e.name + ' → ' + e.nav.goal.name + '.', '#a0d0ff'); } }
  if (a === 'clearT') for (const e of ents.slice()) if (e.dev) rmEnt(e);
  if (a === 'save') DEV.lastSave = { ok: save(), at: GT };
}
function devFrame(dtReal) {
  DEV.frames++; DEV.fpsT += dtReal; if (DEV.fpsT >= 1) { DEV.fps = DEV.frames / DEV.fpsT; DEV.stepRate = DEV.steps / DEV.fpsT; DEV.frames = 0; DEV.steps = 0; DEV.fpsT = 0; }
  if (DEV.advance > 0) { const n = Math.min(200, Math.ceil(DEV.advance / STEPPER.step)); for (let i = 0; i < n; i++) simStep(STEPPER.step); DEV.advance = Math.max(0, DEV.advance - n * STEPPER.step); }
}
function devRender() {
  if (!DEV.on || !DEV.open || !P) return; const p = document.getElementById('devp'); if (!p) return;
  const acts = ents.filter(e => !e.gone && e.actorId), by = {}; for (const e of acts) by[e.archetype] = (by[e.archetype] || 0) + 1;
  const cam = (e) => { const X = SX(e.x, e.y) - CAM.x, Y = SY(e.x, e.y) - CAM.y; return X > -60 && Y > -60 && X < LB.width + 60 && Y < LB.height + 120; };
  const visible = acts.filter(cam).length, npcs = acts.filter(e => e.kind === 'npc').length, mons = acts.filter(e => e.kind === 'mon').length;
  let saveKB = '?'; try { saveKB = ((localStorage.getItem(SAVEKEY) || '').length / 1024).toFixed(1) + ' KB'; } catch (e) { }
  const C = WS.clock, h = C.hourAt(GT), ls = DEV.lastSave;
  const sel = P.sel && P.sel.actorId ? P.sel : null, ins = sel ? devInspect(sel) : null;
  const opts = navPlaces().map(n => `<option value="${esc(n.id)}">${esc(n.name)}</option>`).join('');
  const prevSel = document.getElementById('devdest') ? document.getElementById('devdest').value : null;
  const B = (a, l, extra) => `<button data-dev="${a}" ${extra || ''} style="font:10px monospace;margin:1px;padding:2px 4px">${l}</button>`;
  p.innerHTML = `<b>${esc(document.title)}</b> · sim ${Math.round(1 / STEPPER.step)} Hz (${DEV.stepRate.toFixed(0)}/s) · ${DEV.fps.toFixed(0)} fps${SIMPAUSE ? ' · <b style="color:#f88">PAUSED</b>' : ''}<br>
  actors ${acts.length} · visible ${visible} · tiers ${TIER.on ? `local ${TIER.last.A} (busy ${TIER.last.busy}) · regional ${TIER.last.B} · distant ${TIER.last.C} · A ≤ ${TIER.radii.a.toFixed(0)} m, B ≤ ${TIER.radii.b.toFixed(0)} m · woke ${TIER.woke} (placed ${TIER.placed}, walked ${TIER.walked})` : 'off (?tiers=off)'}<br>
  NPCs ${npcs} · creatures ${mons} · ${Object.entries(by).map(([k, v]) => k + ' ' + v).join(', ')}<br>
  time ${SIM.fmtHour(h)} · day ${C.dayAt(GT)} · ${PERIOD_NAME[C.periodAt(GT)]} · ${C.dayMinutes} min/day · light ${lightNow().dark.toFixed(2)}<br>
  paths: queue ${NAV.jobs.length} · cache ${NAV.cache.size} · searched ${NAV.searches} · failed ${NAV.failed} · cache hits ${NAV.hits}<br>
  AI ${DEV.aiMs.toFixed(3)} ms/step · audio voices ${SFXA.stats.voices} · save ${saveKB} · last save ${ls ? (ls.ok ? 'ok' : 'FAILED') + ' at ' + Math.round(ls.at) + ' s' : '—'}<br>
  ${devEco()}<br>
  ${lifeDev()}<br>${npcFightDev()}<br>${lawDev()}
  <hr style="border-color:#334">
  ${B('hour', 'Dawn', 'data-h="5.5"')}${B('hour', 'Noon', 'data-h="12"')}${B('hour', 'Dusk', 'data-h="17.8"')}${B('hour', 'Midnight', 'data-h="0"')}${B('shift', '−1 h', 'data-h="-1"')}${B('shift', '+1 h', 'data-h="1"')}${B('daynight', 'Day/night')}<br>
  ${B('pause', SIMPAUSE ? 'Resume' : 'Pause')}${B('step', 'Step')}${B('adv', 'Run +1 min', 'data-s="60"')}${B('adv', 'Run +10 min', 'data-s="600"')}${DEV.advance ? ' running… ' + Math.ceil(DEV.advance) + ' s' : ''}${B('save', 'Save now')}<br>
  <select id="devdest" style="font:10px monospace;max-width:170px">${opts}</select>${B('spawn', 'Spawn traveller')}${B('clearT', 'Remove travellers')}<br>
  ${['paths', 'perception', 'territory', 'collision', 'factions'].map(k => `<label><input type="checkbox" data-show="${k}" ${DEV.show[k] ? 'checked' : ''}>${k}</label>`).join(' ')}
  <hr style="border-color:#334">${ins ? '<b>' + esc(ins.name || ins.actorId) + '</b><br>' + Object.entries(ins).map(([k, v]) => k + ': ' + esc(typeof v === 'object' ? JSON.stringify(v) : String(v))).join('<br>') : '<span style="color:#889">tap an actor to inspect it</span>'}
  <hr style="border-color:#334"><b>recent events</b><br>${WS.bus.recent(8).reverse().map(ev => `${ev.t.toFixed(1)} ${ev.type} ${esc(ev.actor || '')}${ev.amount ? ' −' + ev.amount : ''}`).join('<br>')}`;
  if (prevSel) document.getElementById('devdest').value = prevSel;
}
/* ecosystem lines (Living World phase 3): creatures by faction, camps, regions, what the ecosystem has been doing */
function devEco() {
  const by = {}; for (const e of ents) if (e.kind === 'mon' && !e.gone) { const f = factionOf(e); by[f] = (by[f] || 0) + 1; }
  const camps = [...ECOS.camps.values()].map(c => `${esc(c.name)} ${c.alive}/${c.cap}${c.cleared ? (c.recovering(GT) ? ' recovering' : ' <b style="color:#fc8">cleared</b> ' + Math.max(0, Math.ceil(c.clearedAt + c.recover - GT)) + ' s') : ''}${c.sortie ? ' · sortie' : ''}`).join(' · ');
  const rc = ecoRegionCounts(), rk = {}; for (const k in rc) { const r = rc[k]; const o = rk[r.kind] || (rk[r.kind] = { n: 0, cap: 0, k: 0 }); o.n += r.n; o.cap += r.cap; o.k++; }
  const fm = DEV.show.factions ? '<br>' + ECO_FACTIONS.names().map(a => `<b>${a}</b> ✕ ${ECO_FACTIONS.names().filter(b => b !== a && ECO_FACTIONS.hostile(a, b)).join(', ') || '—'}`).join('<br>') : '';
  return `factions: ${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', ')}<br>
  regions: ${Object.entries(rk).map(([k, o]) => `${k} ${o.k} (${o.n}/${o.cap})`).join(', ')}<br>
  camps: ${camps}<br>
  ecosystem: hunts ${ECOS.hunts} · creature fights ${ECOS.mvm} · flights ${ECOS.flees} · deaths ${ECOS.kills} · sorties ${ECOS.sorties} · camps cleared ${ECOS.cleared} · risen dead sunk ${ECOS.sunk} · think ${(ECOS.thinkMs / Math.max(1, ECOS.stepN)).toFixed(3)} ms/step${fm}`;
}
function devInspect(e) {
  const n = e.nav, d = e.type && MON[e.type];
  return SIM.inspect(e, Object.assign({ goal: n ? (n.goal.name || Math.round(n.goal.x) + ',' + Math.round(n.goal.y)) + ' · ' + n.state + (n.reason ? ' (' + n.reason + ')' : '') : null,
    destination: n && n.legs && n.legs[n.li] ? Math.round(n.legs[n.li].x) + ',' + Math.round(n.legs[n.li].y) + ' leg ' + (n.li + 1) + '/' + n.legs.length : null,
    territory: d ? 'territory ' + ecoP(e.type).terr + ' m, pursuit ' + (ecoP(e.type).pur || d.leash) + ' m, aggro ' + d.aggro + ' m' : null, reason: e.state ? 'state ' + e.state + (e.target ? ' → ' + aidOf(e.target) : '') : null,
    notoriety: notoOf(e), murderCounts: lawHuman(e) ? LAW.counts(aidOf(e), GT) : null }, ecoInspect(e), lifeInspect(e), e === P ? { hp: [Math.round(P.hp), SF.maxHp(P)] } : null));
}
/* world-space debug overlays, drawn after the light so they read at night */
function devDraw(camX, camY) {
  if (!DEV.on || !DEV.open) return; const g = ctx; g.save(); g.setTransform(1, 0, 0, 1, -camX, -camY);
  const ell = (x, y, r, col, fill) => { g.beginPath(); g.ellipse(SX(x, y), SY(x, y), r * HW * 1.414, r * HH * 1.414, 0, 0, 7); if (fill) { g.fillStyle = col; g.fill(); } else { g.strokeStyle = col; g.lineWidth = 1; g.stroke(); } };
  if (DEV.show.collision) { const cx = Math.floor(P.x), cy = Math.floor(P.y); g.fillStyle = 'rgba(255,40,40,.28)'; for (let y = cy - 14; y <= cy + 14; y++) for (let x = cx - 14; x <= cx + 14; x++) if (!navStatic(x, y) || (doorOn(x, y) && !doorOn(x, y).open)) { const X = SX(x, y), Y = SY(x, y); g.beginPath(); g.moveTo(X, Y); g.lineTo(X + HW, Y + HH); g.lineTo(X, Y + TH); g.lineTo(X - HW, Y + HH); g.closePath(); g.fill(); } }
  for (const e of ents) { if (e.gone || Math.hypot(e.x - P.x, e.y - P.y) > 45) continue; const d = e.type && MON[e.type];
    if (DEV.show.perception && d && e.kind === 'mon') { const r = SIM.senseRange(ecoSenseOf(e), ecoSenseCtx(e)); ell(e.x, e.y, r.sight, 'rgba(255,220,80,.7)'); if (r.hear > .5) ell(e.x, e.y, r.hear, 'rgba(255,160,80,.35)'); }
    if (DEV.show.territory && d && e.kind === 'mon' && e.home) { ell(e.home.x, e.home.y, ecoP(e.type).terr, 'rgba(120,200,255,.6)'); ell(e.home.x, e.home.y, ecoP(e.type).pur || d.leash, 'rgba(120,200,255,.25)'); ell(e.home.x, e.home.y, .4, 'rgba(120,200,255,.8)', true); }
    if (DEV.show.paths && e.nav && e.nav.wp && e.nav.state === 'moving') { g.strokeStyle = 'rgba(120,255,160,.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(SX(e.x, e.y), SY(e.x, e.y)); for (let i = e.nav.wi; i < e.nav.wp.length; i++) g.lineTo(SX(e.nav.wp[i][0], e.nav.wp[i][1]), SY(e.nav.wp[i][0], e.nav.wp[i][1])); g.stroke(); } }
  g.restore();
}
