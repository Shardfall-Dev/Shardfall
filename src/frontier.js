/* ================= THE FRONTIER (world expansion, v0.23): the Southern Reach, camps and dungeon sites =================
   New land south of the stretched Anniabreen, reached by the Long Causeway from the forest fork, and camps and dungeon
   mouths spread through the wilds. Coordinates here are global unless a name says local (original Anniabreen frame,
   placed with annWarp so they follow the stretch). Camps get provisional spawners on existing creatures (the persistent
   camp populations are Living World phase 3). Dungeon interiors are not built yet: each mouth is sealed and says so.
   Original names; themes after the classic dungeons (master spec §17): Hollowdeep (Despise), Wyrmhold (Destard),
   Liar's Keep (Deceit), Sorrowstone (Shame), Gilt Maw (Covetous). */
const FRONT = { sites: [], reach: null, roads: [] };
Object.assign(ANN_ZONE_NAME, {
  reach: 'Southern Reach · wilderness', mirefen: 'Mirefen · wilderness', greyspine: 'Greyspine · wilderness', barrows: 'Ashen Barrows · wilderness',
  southwatch: 'Southwatch · wilderness', causeway: 'The Long Causeway · wilderness' });
Object.assign(ANN_ZONE_MUSIC, { reach: '05-beyond-the-tidegate', mirefen: '03-mist-on-the-causeway', greyspine: '04-the-empty-watch', barrows: '04-the-empty-watch', southwatch: '05-beyond-the-tidegate', causeway: '03-mist-on-the-causeway' });
const REACH = [[760, 1150], [900, 1126], [1100, 1136], [1300, 1122], [1500, 1132], [1700, 1116], [1900, 1130], [2100, 1150], [2250, 1192], [2300, 1282], [2262, 1380], [2150, 1458],
  [1950, 1488], [1700, 1478], [1450, 1494], [1200, 1484], [950, 1470], [800, 1430], [722, 1340], [700, 1240]];
const REACH_AREAS = { mirefen: { cx: 930, cy: 1340, rx: 210, ry: 140 }, greyspine: { cx: 1910, cy: 1240, rx: 270, ry: 105 }, barrows: { cx: 1350, cy: 1415, r: 58 }, southwatch: { cx: 1292, cy: 1192, r: 16 } };
/* sites: camps (k: 'camp') and dungeon mouths (k: 'dungeon'). at: global [x, y], or local: original Anniabreen frame */
const FRONT_SITES = [
  { id: 'southwatch', k: 'outpost', n: 'Southwatch', at: [1292, 1192] },
  { id: 'cutpurse', k: 'camp', n: 'Cutpurse Hollow', local: [330, 585], camp: 'bandit', spawn: [['bandit', 5, 2]] },
  { id: 'greywolf', k: 'camp', n: 'Greywolf Den', local: [380, 262], camp: 'den', spawn: [['dire_wolf', 5, 2]] },
  { id: 'silkwood', k: 'camp', n: 'Silkwood', local: [930, 262], camp: 'web', spawn: [['giant_spider', 3]] },
  { id: 'trollgate', k: 'camp', n: 'Trollgate', local: [300, 205], camp: 'lair', spawn: [['troll', 2], ['ettin', 1]] },
  { id: 'harpyroost', k: 'camp', n: 'Harpy Roost', local: [1392, 540], camp: 'nest', spawn: [['harpy', 4, 2]] },
  { id: 'kragmaw', k: 'camp', n: 'Kragmaw Camp', at: [1820, 1362], camp: 'orc', spawn: [['orc', 6, 2]] },
  { id: 'scalemire', k: 'camp', n: 'Scalemire', at: [905, 1318], camp: 'lizard', spawn: [['lizardman', 5, 2], ['slime', 4]] },
  { id: 'barrows', k: 'camp', n: 'Ashen Barrows', at: [1350, 1415], camp: 'graves', spawn: [['skeleton', 6, 2]] },
  { id: 'hollowdeep', k: 'dungeon', n: 'Hollowdeep', theme: 'Despise', local: [800, 176], art: 'cave', guard: [['earth_elemental', 1]] },
  { id: 'wyrmhold', k: 'dungeon', n: 'Wyrmhold', theme: 'Destard', at: [1985, 1206], art: 'cave', guard: [['gargoyle', 2]] },
  { id: 'liarskeep', k: 'dungeon', n: "Liar's Keep", theme: 'Deceit', local: [1268, 392], art: 'keep' },
  { id: 'sorrowstone', k: 'dungeon', n: 'Sorrowstone', theme: 'Shame', at: [842, 1428], art: 'crypt' },
  { id: 'giltmaw', k: 'dungeon', n: 'Gilt Maw', theme: 'Covetous', local: [962, 424], art: 'cave' }];

function genFrontier(carve, disc) {
  /* a road bandit: the brine smuggler's rules and look in road leathers (provisional; phase 3 gives bandits their own profile) */
  if (!MON.bandit) { MON.bandit = Object.assign({}, MON.smuggler, { n: 'road bandit', scout: '#5a3a26', hideChance: .3 }); SPECIES_CLASS.bandit = 'criminal'; }
  const r = mulberry(2027), nA = annNoise(r, 40, W, H), nF = annNoise(r, 14, W, H), nF2 = annNoise(r, 5, W, H), nR = annNoise(r, 9, W, H);
  const X0 = 680, X1 = 2320, Y0 = 1100, Y1 = H - 6, ell = (o, x, y) => Math.hypot((x - o.cx) / o.rx, (y - o.cy) / o.ry);
  const inReach = (x, y) => { const j = nA(x, y) - .5, k = nF2(x, y) - .5; return annInPoly(x + j * 46 + k * 8, y - j * 40 + k * 8, REACH); };
  // 1. land, beaches
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) if (inReach(x, y)) tSet(x, y, T.G);
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) { if (tAt(x, y) !== T.G) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) if (tAt(x + dx, y + dy) === T.WA) { tSet(x, y, T.SA); break; } }
  // 2. regions: Greyspine's cliffs and ore, Mirefen's pools and reeds, the barrow field's graves; woods elsewhere
  const A = REACH_AREAS;
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    if (tAt(x, y) !== T.G) continue; const f = nF(x, y) * .7 + nF2(x, y) * .3;
    const gs = ell(A.greyspine, x, y); if (gs < 1) { const k = nR(x, y); if (k > .58 && gs < .92) tSet(x, y, T.CL); else if (hash(x, y) % 9 === 0) tSet(x, y, T.RK); else if (k > .5 && hash(x + 3, y) % 3 === 0) tSet(x, y, T.DI); continue; }
    const mf = ell(A.mirefen, x, y); if (mf < 1) { if (f > .6 && mf < .9) tSet(x, y, T.SH); else if (r() < .05) tSet(x, y, T.MR); else if (f > .52 && r() < .12) tSet(x, y, T.TR); continue; }
    if (Math.hypot(x - A.barrows.cx, y - A.barrows.cy) < A.barrows.r) { if (hash(x, y) % 11 === 0 && (x + y) % 3) tSet(x, y, T.GV); else if (hash(x + 7, y) % 5 === 0) tSet(x, y, T.DI); continue; }
    if (f > .5 && r() < .5) tSet(x, y, T.TR); else if (r() < .004) tSet(x, y, T.MR);
  }
  // 3. the Long Causeway from the forest fork, Southwatch crossroads and the Reach roads
  const fork = annWarp(AL.fork[0] + 1, AL.fork[1] + 1), sw = [A.southwatch.cx, A.southwatch.cy];
  let coast = Math.round(fork[1]); while (coast < Y0 && tAt(Math.round(fork[0]), coast) !== T.WA) coast++;
  const toFork = [[Math.round(fork[0]) - 1, Math.round(fork[1]) - 1], [Math.round(fork[0]), Math.round(fork[1]) + 6], [Math.round(fork[0]), coast - 2]], /* starts on the fork itself, so the roads join */ causeway = [[Math.round(fork[0]), coast - 2], [Math.round(fork[0]), sw[1] - 20], sw];
  carve(toFork, 3, T.RD); carve(causeway, 4, T.RD);
  const west = [sw, [1180, 1230], [1060, 1270], [970, 1300], [915, 1316]], east = [sw, [1420, 1220], [1560, 1240], [1700, 1260], [1790, 1300], [1820, 1352]], south = [sw, [1300, 1290], [1330, 1360], [1350, 1405]];
  const spine = [[1560, 1240], [1700, 1222], [1850, 1212], [1975, 1212]];
  for (const p of [west, east, south, spine]) carve(p, 3, T.RD);
  FRONT.roads = { fork: toFork, causeway, west, east, south, spine }; Object.assign(ANN.roads, { causeway: toFork.concat(causeway.slice(1)), reachW: west, reachE: east, reachS: south, spine });
  FRONT.causeway = { x: Math.round(fork[0]), y0: coast - 2, y1: sw[1] - 20 };
  // 4. Southwatch: a shrine to bind at and return to, a lamp and a signpost
  disc(sw[0] + 1, sw[1] + 1, 7, (x, y) => { if (tAt(x, y) !== T.WA) tSet(x, y, T.RD); });
  tSet(sw[0] + 4, sw[1] - 3, T.AK); SHRINES.push({ id: 'southwatch', n: 'Southwatch shrine', x: sw[0] + 4, y: sw[1] - 3 });
  tSet(sw[0] - 4, sw[1] - 4, T.LP);
  flm('sign', sw[0] + 2.5, sw[1] + 4.5, { col: .12 }); ANN.signs.push({ x: sw[0] + 2.5, y: sw[1] + 4.5, lines: ['↑ The Long Causeway', '← Mirefen', '→ Greyspine · Kragmaw', '↓ Ashen Barrows'] });
  ANN.labels.push({ n: 'Southern Reach', x: 1500, y: 1170, minor: true }, { n: 'Mirefen', x: 900, y: 1390, minor: true }, { n: 'Greyspine', x: 1900, y: 1150, minor: true }, { n: 'The Long Causeway', x: fork[0] + 30, y: (coast + sw[1]) / 2, minor: true });
  // 5. camps and dungeon mouths
  for (const s of FRONT_SITES) placeSite(s, carve, disc);
  ANN_BOUNDS[0] = AO + 60; ANN_BOUNDS[1] = 30; ANN_BOUNDS[2] = Math.min(W - 10, 2600); ANN_BOUNDS[3] = H - 10;
  // 6. thin the new woods: one tree in a 3×3 cell
  const cell = new Set(); for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) { if (tAt(x, y) !== T.TR) continue; const k = Math.floor(x / 3) + ',' + Math.floor(y / 3); if (x % 3 === 2 || y % 3 === 2 || cell.has(k)) tSet(x, y, T.G); else cell.add(k); }
}
function flm(kind, x, y, o) { o = o || {}; const p = place('__lm', x, y, { d: o.d !== undefined ? o.d : x + y }); p.draw = FLMD[kind] || LMD[kind]; p.lm = kind; Object.assign(p, o.extra || {}); if (o.col) addCol(x - o.col, y - o.col, x + o.col, y + o.col); return p; }
/* clear ground for a site, draw it, give it a trail to the nearest road and (for camps) a provisional spawner */
function placeSite(s, carve, disc) {
  const [x, y] = s.at || annWarp(s.local[0], s.local[1]); s.x = Math.round(x); s.y = Math.round(y); FRONT.sites.push(s);
  if (s.k === 'outpost') { s.join = [s.x, s.y]; return; }
  const R = s.k === 'dungeon' ? 6 : 11, clearT = s.camp === 'graves' ? null : T.G;
  disc(s.x, s.y, R, (xx, yy) => { const t = tAt(xx, yy); if (t === T.WA || t === T.FL || t === T.WL || t === T.AK) return; if (s.k === 'dungeon' && yy < s.y - 2 && Math.abs(xx - s.x) > 2 && t === T.CL) return; if (clearT !== null && t !== T.GV) tSet(xx, yy, t === T.SH ? T.G : clearT); });
  // a trail over land to the nearest road tile (never across water); dirt, two tiles wide, cut through cliffs where it must
  const sy2 = s.y + (s.k === 'dungeon' ? 2 : 0), tr = landTrail(s.x, sy2, 120) || landTrail(s.x, sy2, 320);
  if (tr) for (const [tx, ty] of tr) for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const t = tAt(tx + ox, ty + oy); if (protAt(tx + ox, ty + oy)) continue; if (t !== T.RD && t !== T.WA && t !== T.SH && t !== T.BR && t !== T.FL && t !== T.AK && t !== T.WL && t !== T.FN) tSet(tx + ox, ty + oy, T.DI); }
  s.trail = tr ? tr.length : 0; s.join = tr && tr.length ? tr[tr.length - 1] : [s.x, s.y];
  if (s.k === 'dungeon') { flm(s.art, s.x + .5, s.y - .5, { d: s.x + s.y + 1.2 }); for (let k = -2; k <= 2; k++) addCol(s.x + k + .1, s.y - 1.6, s.x + k + .9, s.y - 1.1); tSet(s.x - 3, s.y + 1, T.LP); ANN.labels.push({ n: s.n, x: s.x, y: s.y - 10, minor: true, dungeon: true }); }
  else {
    const tents = { bandit: 3, orc: 4, lizard: 3, den: 0, web: 0, lair: 0, nest: 0, graves: 0 }[s.camp] || 0;
    for (let i = 0; i < tents; i++) { const a = i / tents * Math.PI * 2 + .6, tx = s.x + Math.cos(a) * 6, ty = s.y + Math.sin(a) * 6; flm(s.camp === 'lizard' ? 'hut' : 'tent', tx, ty, { col: .9, extra: { tint: s.camp } }); }
    if (tents) { flm('campfire', s.x + .5, s.y + .5, { col: .35 }); LIGHTS.push({ x: s.x, y: s.y, r: 6, kind: 'fire' }); }
    if (s.camp === 'orc') { disc(s.x, s.y, 10.5, (xx, yy, d) => { if (d > .93 && !(Math.abs(Math.abs(yy - s.y) - 10) < 2 && Math.abs(xx - s.x) < 3) && tAt(xx, yy) === T.G) tSet(xx, yy, T.FN); });   /* a palisade with gates north and south */ flm('totem', s.x - 3.5, s.y - 3.5, { col: .3 }); }
    if (s.camp === 'den' || s.camp === 'lair' || s.camp === 'nest') flm('bones', s.x + .5, s.y + .5);
    if (s.camp === 'web') for (let i = 0; i < 3; i++) flm('web', s.x - 3 + i * 3, s.y - 2 + (i % 2) * 4);
    if (s.camp === 'graves') { flm('crypt', s.x + .5, s.y - 4.5, { d: s.x + s.y - 3 }); for (let k = -2; k <= 2; k++) addCol(s.x + k + .1, s.y - 5.6, s.x + k + .9, s.y - 5.1); }
    ANN.labels.push({ n: s.n, x: s.x, y: s.y - 14, minor: true });
  }
  for (const [type, max, pack] of s.spawn || s.guard || []) if (MON[type]) SPAWNS.push({ type, x: s.x + .5, y: s.y + .5, r: s.k === 'dungeon' ? 7 : 12, max, pack: pack || 1, n: 0, next: 0, site: s.id });
}
/* breadth-first over land from a site to the nearest road or bridge tile, within a square of half-size R; returns the tiles between */
function landTrail(sx, sy, R) {
  const x0 = sx - R, y0 = sy - R, n = 2 * R + 1, prev = new Int32Array(n * n).fill(-1), q = new Int32Array(n * n); let h = 0, t = 0;
  const idx = (x, y) => (y - y0) * n + (x - x0); const k0 = idx(sx, sy); prev[k0] = k0; q[t++] = k0;
  while (h < t) { const k = q[h++], x = x0 + k % n, y = y0 + Math.floor(k / n), tt = tAt(x, y);
    if ((tt === T.RD || tt === T.BR || protAt(x, y)) && Math.hypot(x - sx, y - sy) > 8) { /* a road, or the edge of a town: trails never cut through a town */ const out = []; let c = k; while (c !== k0) { out.push([x0 + c % n, y0 + Math.floor(c / n)]); c = prev[c]; } return out.reverse(); }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < x0 || ny < y0 || nx >= x0 + n || ny >= y0 + n) continue; const nk = idx(nx, ny); if (prev[nk] !== -1) continue; const nt = tAt(nx, ny); if (nt === T.WA || nt === T.SH || nt === T.FN || nt === T.WL) continue; prev[nk] = k; q[t++] = nk; } }
  return null;
}
/* zones: the Reach and its regions, the causeway, camps and dungeon mouths (null where Anniabreen's own rules apply) */
function frontierZone(x, y) {
  const c = FRONT.causeway; if (c && Math.abs(x - c.x - 1.5) < 5 && y >= c.y0 && y <= c.y1 + 4) return 'causeway';
  for (const s of FRONT.sites) { const d = Math.hypot(x - s.x, y - s.y); if (d < (s.k === 'dungeon' ? 9 : s.k === 'outpost' ? 16 : 18)) return 'site_' + s.id; }
  if (y < 1100) return null; const A = REACH_AREAS;
  if (Math.hypot((x - A.greyspine.cx) / A.greyspine.rx, (y - A.greyspine.cy) / A.greyspine.ry) < 1) return 'greyspine';
  if (Math.hypot((x - A.mirefen.cx) / A.mirefen.rx, (y - A.mirefen.cy) / A.mirefen.ry) < 1) return 'mirefen';
  return tAt(x, y) === T.WA ? 'sea' : 'reach';
}
for (const s of FRONT_SITES) { ANN_ZONE_NAME['site_' + s.id] = s.n + (s.k === 'dungeon' ? ' · sealed' : ' · wilderness'); ANN_ZONE_MUSIC['site_' + s.id] = s.k === 'dungeon' || s.camp === 'graves' ? '04-the-empty-watch' : '05-beyond-the-tidegate'; }
/* a sealed mouth answers when you try it: the interiors come later, and the game says so plainly */
const frontNearSeal = r => FRONT.sites.find(s => s.k === 'dungeon' && P && Math.hypot(s.x + .5 - P.x, s.y - P.y) <= r);
function frontierInteract() { const s = frontNearSeal(3); if (!s) return false; log(`The way into ${s.n} is choked with fallen stone. It is sealed for now; its halls open in a later version.`, '#e8d8b0'); snd('door.locked'); return true; }
const frontierCanInteract = () => !!frontNearSeal(3);

/* ---------------- frontier art (procedural, in the kit's palette and pixel scale) ---------------- */
const FLMD = {
  tent(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y), col = { orc: ['#6a5a3a', '#4e4028'], bandit: ['#7a6a50', '#5a4c36'] }[p.tint] || ['#8a7a5a', '#665a40']; annShadow(g, X + 6, Y + 2, 30, 10);
    annPoly(g, col[0], [[X - 28, Y], [X, Y - 40], [X + 4, Y + 10]]); annPoly(g, col[1], [[X + 4, Y + 10], [X, Y - 40], [X + 28, Y - 2]]); annPoly(g, '#1e1810', [[X - 4, Y + 4], [X, Y - 16], [X + 4, Y + 6]]); g.fillStyle = '#3a2a18'; g.fillRect(X - 1, Y - 46, 2, 8); },
  hut(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y); annShadow(g, X + 4, Y + 2, 28, 10); annPoly(g, '#5e5a36', [[X - 24, Y - 4], [X, Y + 8], [X + 24, Y - 4], [X + 24, Y - 22], [X, Y - 10], [X - 24, Y - 22]]);
    annPoly(g, '#8a8a4a', [[X - 30, Y - 20], [X, Y - 52], [X + 30, Y - 20], [X, Y - 8]]); annPoly(g, '#6e6e3a', [[X, Y - 52], [X + 30, Y - 20], [X, Y - 8]]); g.fillStyle = '#1a1a10'; g.fillRect(X - 6, Y - 12, 8, 14); },
  campfire(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.fillStyle = '#6e6a60'; g.fillRect(Math.round(X + Math.cos(a) * 9) - 2, Math.round(Y + Math.sin(a) * 4) - 2, 4, 3); }
    const f = Math.floor(GT * 8) % 3; annPoly(g, '#e86a1a', [[X - 6, Y], [X - 1, Y - 14 - f * 2], [X + 6, Y]]); annPoly(g, '#ffd04a', [[X - 3, Y], [X + 1, Y - 8 - f], [X + 4, Y]]); },
  totem(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y); annShadow(g, X + 3, Y, 10, 4); g.fillStyle = '#5a3a22'; g.fillRect(X - 4, Y - 60, 8, 60); g.fillStyle = '#e8e0c8'; g.fillRect(X - 7, Y - 66, 14, 10); g.fillStyle = '#1a120a'; g.fillRect(X - 4, Y - 62, 3, 3); g.fillRect(X + 1, Y - 62, 3, 3); g.fillStyle = '#8a2a1a'; g.fillRect(X - 6, Y - 40, 12, 3); },
  bones(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y); g.fillStyle = '#d8d0b8'; for (const [ox, oy, w, h] of [[-12, -2, 10, 2], [-4, 2, 2, 8], [6, -4, 9, 2], [2, 4, 7, 2], [-10, 6, 3, 3]]) g.fillRect(X + ox, Y + oy, w, h); g.fillStyle = '#c8c0a8'; g.beginPath(); g.ellipse(X + 12, Y + 3, 4, 3, 0, 0, 7); g.fill(); },
  web(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y) - 20; g.strokeStyle = 'rgba(230,230,230,.7)'; g.lineWidth = 1; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(a) * 18, Y + Math.sin(a) * 12); g.stroke(); } for (const k of [5, 10, 15]) { g.beginPath(); g.ellipse(X, Y, k, k * .66, 0, 0, 7); g.stroke(); } },
  cave(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y) + 6; annShadow(g, X, Y + 2, 58, 16);
    annPoly(g, '#7a7268', [[X - 58, Y], [X - 46, Y - 46], [X - 18, Y - 74], [X + 16, Y - 80], [X + 44, Y - 56], [X + 58, Y - 4], [X, Y + 12]]); annPoly(g, '#5c544c', [[X + 16, Y - 80], [X + 44, Y - 56], [X + 58, Y - 4], [X, Y + 12], [X + 6, Y - 40]]);
    annPoly(g, '#0c0a08', [[X - 22, Y + 2], [X - 20, Y - 30], [X - 6, Y - 44], [X + 10, Y - 40], [X + 22, Y - 26], [X + 22, Y + 4], [X, Y + 10]]);
    g.fillStyle = '#6a625a'; for (const [ox, oy] of [[-16, -2], [-6, 2], [6, -4], [14, 2], [-2, -10], [10, -12]]) g.fillRect(X + ox - 5, Y + oy - 4, 10, 7); g.fillStyle = '#4a443e'; for (const [ox, oy] of [[-14, 0], [8, -2], [0, -8]]) g.fillRect(X + ox - 3, Y + oy - 2, 6, 4); },
  crypt(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y) + 4; annShadow(g, X + 8, Y + 2, 46, 14);
    annPoly(g, '#9a9488', [[X - 40, Y - 6], [X, Y + 12], [X, Y - 48], [X - 40, Y - 66]]); annPoly(g, '#716c62', [[X, Y + 12], [X + 40, Y - 6], [X + 40, Y - 66], [X, Y - 48]]); annPoly(g, '#b4aea0', [[X - 44, Y - 64], [X, Y - 86], [X + 44, Y - 64], [X, Y - 46]]);
    annPoly(g, '#141210', [[X - 26, Y - 2], [X - 26, Y - 34], [X - 14, Y - 42], [X - 4, Y - 36], [X - 4, Y + 6]]); g.fillStyle = '#5a564e'; for (let i = 0; i < 4; i++) g.fillRect(X - 30 + i * 3, Y - 6 + i * 3, 28, 2); },
  keep(g, p) { LMD.tower(g, p); const X = SX(p.x, p.y), Y = SY(p.x, p.y) + 8; annPoly(g, '#141210', [[X - 22, Y - 4], [X - 22, Y - 30], [X - 14, Y - 36], [X - 6, Y - 30], [X - 6, Y + 1]]); g.fillStyle = '#5a564e'; g.fillRect(X - 26, Y - 4, 24, 3); } };
