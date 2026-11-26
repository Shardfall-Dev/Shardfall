/* ================= ANNIABREEN v1.0: the mainland, Vespar's river islands, Skara Bryn and Moonglen =================
   Design reference: the four classic Britannian towns (mining, river trade, rangers and ferry, mages), redrawn with
   original coastlines, streets and footprints. Anniabreen shares the world grid with the Saltmarsh slice: it starts
   AO tiles east of the origin. Coordinates in this file are local (x − AO) unless a name says global.
   Distances follow the walk speed in game.js (SF.WALK × MOVE_SCALE ≈ 6.15 tiles/s at full stick):
   forge → first ore face ≈ 17 s, Mynoc → Vespar by cart road ≈ 75 s, Skara landing → fork ≈ 46 s, fork → Mynoc or
   Vespar ≈ 75 s, Moonglen harbor → college ≈ 24 s (measured in tests/anniabreen-smoke). */
const AO = 640;
const ANN_BOUNDS = [AO + 40, 40, AO + 1440, 830];
const ANN_ZONE_NAME = { mynoc: 'Mynoc · protected', mine: 'Mynoc Mine · protected', vespar: 'Vespar · protected', skara: 'Skara Bryn · protected', skaraland: 'Skara Bryn landing · protected',
  moonglen: 'Moonglen · protected', mglen: 'Moonglen downs · wilderness', woods: 'Westwood · wilderness', ridge: 'Northern Ridge · wilderness', vale: 'Mynoc Vale · wilderness', fields: 'Anniabreen · wilderness', sea: 'Open water' };
const ANN_ZONE_MUSIC = { mynoc: '01-saltmarsh-home', mine: '04-the-empty-watch', vespar: '02-lanterns-on-the-quay', skara: '01-saltmarsh-home', skaraland: '01-saltmarsh-home', moonglen: '02-lanterns-on-the-quay',
  mglen: '03-mist-on-the-causeway', woods: '05-beyond-the-tidegate', ridge: '04-the-empty-watch', vale: '05-beyond-the-tidegate', fields: '05-beyond-the-tidegate' };
const ANN_SHOPS = {
  miner: ['pickaxe', 'tongs', 'hammer', 'repairkit', 'ironbar', 'bandage', 'cookedmeat', 'lanternoil'],
  tailor: ['cloth', 'sewkit', 'clothvest', 'leather', 'strap'],
  tinker: ['tongs', 'pickaxe', 'hatchet', 'knife', 'rod', 'repairkit', 'lockpick', 'trapkit'],
  fishmonger: ['fish', 'cookedmeat', 'rod'],
  innkeeper: ['cookedmeat', 'fish', 'bandage', 'draught', 'lanternoil'],
  fletcher: ['arrow', 'bolt', 'pine', 'knife', 'strap'],
  ranger: ['shortbow', 'crossbow', 'arrow', 'bolt', 'knife', 'bandage', 'trapkit'],
  reagents: [], mage: ['vial', 'manatonic', 'draught'] };          // reagents and scrolls are filled in at boot from the Magery tables
/* filled by genAnniabreen, global coordinates */
const ANN = { towns: [], labels: [], gates: [], signs: [], routes: [], npcs: [], zones: [], mine: null, river: null, roads: {} };

/* ---------- small geometry helpers (local coordinates) ---------- */
function annNoise(r, cell, w, h) { const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, g = new Float32Array(gw * gh); for (let i = 0; i < g.length; i++) g[i] = r(); const s = t => t * t * (3 - 2 * t);
  return (x, y) => { x = Math.max(0, Math.min(w, x)); y = Math.max(0, Math.min(h, y)); const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), u = s(fx - ix), v = s(fy - iy), i = iy * gw + ix; const a = g[i], b = g[i + 1], c = g[i + gw], d = g[i + gw + 1]; return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }; }
function annInPoly(px, py, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } return c; }
function annSegD(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(px - ax - dx * t, py - ay - dy * t); }
function annPolyD(px, py, pts) { let d = 1e9; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, annSegD(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])); return d; }
/* every tile whose centre lies within rad of the polyline */
function annAlong(pts, rad, fn) { const seen = new Set(); for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
  for (let y = Math.floor(Math.min(ay, by) - rad - 1); y <= Math.max(ay, by) + rad + 1; y++) for (let x = Math.floor(Math.min(ax, bx) - rad - 1); x <= Math.max(ax, bx) + rad + 1; x++) { const k = y * 4096 + x; if (seen.has(k)) continue; const d = annSegD(x + .5, y + .5, ax, ay, bx, by); if (d <= rad) { seen.add(k); fn(x, y, d); } } } }
const annLen = pts => { let l = 0; for (let i = 0; i < pts.length - 1; i++) l += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); return l; };
const annG = pts => pts.map(([x, y]) => [x + AO, y]);

/* ---------- the layout (local) ---------- */
const AL = {
  mainland: [[250, 95], [330, 70], [420, 88], [520, 64], [610, 80], [700, 70], [790, 92], [880, 82], [950, 112], [990, 175], [968, 250], [992, 320], [1006, 400], [1016, 470], [1016, 680], [985, 722], [930, 702], [880, 738],
    [820, 762], [760, 742], [700, 772], [640, 800], [560, 788], [500, 768], [430, 792], [360, 770], [300, 746], [240, 722], [204, 690], [190, 600], [198, 540], [216, 470], [200, 400], [214, 320], [204, 240], [226, 160]],
  spur: [[548, 176], [668, 166], [694, 226], [662, 288], [622, 282], [591, 287], [578, 262], [560, 222]],
  skara: { cx: 122, cy: 640, rx: 54, ry: 50 }, moon: { cx: 1270, cy: 572, rx: 150, ry: 205 },
  river: [[603, 290], [640, 325], [690, 375], [740, 430], [790, 480], [835, 515], [868, 540]],
  C1: [[868, 540], [900, 528], [950, 522], [1030, 522]],
  C2: [[868, 540], [905, 562], [960, 570], [1030, 572]],
  C3: [[868, 540], [874, 570], [884, 612], [930, 628], [1030, 630]],
  X: [[939, 568], [940, 630]],
  forest: [[194, 640], [232, 646], [292, 660], [360, 672], [420, 677], [480, 680]],
  north: [[480, 680], [474, 610], [488, 520], [512, 430], [536, 360], [554, 306]],
  east: [[482, 682], [580, 652], [680, 602], [760, 560], [812, 548], [846, 556]],
  cart: [[566, 303], [592, 322], [631, 336], [681, 386], [731, 441], [781, 491], [826, 526], [846, 556], [858, 578], [866, 590]],
  fork: [480, 680], tower: [474, 672], forkSign: [486, 675],
  yard: [560, 296], forge: [555, 290], anvil: [557, 290],
  adit: [[589, 284], [589, 262], [598, 255], [609, 242], [614, 226], [615, 218]], chamber: [603, 200, 627, 219],
  cross: [676, 393], crossSign: [686, 389], wheel: [736, 435],
  vbank: [898, 573], harbor: [1016, 596],
  skPierIsle: [176, 640], skPierMain: [189, 640], skGate: [122, 604], skTree: [140, 640],
  mgPier: [1263, 776], mgGate: [1205, 603], mgCourt: [1265, 630], obs: [1258, 434] };

function genAnniabreen(carve, disc) {
  const r = mulberry(2026), LW = Math.min(W - AO, 1460), LH = H;
  const S = (x, y, t) => tSet(x + AO, y, t), Gt = (x, y) => tAt(x + AO, y);
  const nA = annNoise(r, 34, LW, LH), nB = annNoise(r, 34, LW, LH), nF = annNoise(r, 16, LW, LH), nF2 = annNoise(r, 6, LW, LH), nR = annNoise(r, 9, LW, LH), nC = annNoise(r, 60, LW, LH);
  const ell = (o, x, y, j) => Math.hypot((x - o.cx) / o.rx, (y - o.cy) / o.ry) + j < 1;
  // 1. land and water
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    const ja = (nA(x, y) - .5), jb = (nB(x, y) - .5), jc = nF2(x, y) - .5; let land = annInPoly(x + ja * 44 + jc * 8, y + jb * 44 - jc * 8, AL.mainland) || ell(AL.skara, x, y, ja * .14) || ell(AL.moon, x, y, ja * .12);
    if (y >= 596 && y <= 690 && x >= 177 && x <= 189) land = false;                 // Skara channel: narrow, both landings in view
    if (y >= 600 && y <= 682 && x >= 190 && x <= 206) land = true;
    if (y >= 500 && y <= 664 && x >= 1000 && x < 1100) land = x < 1016;                          // a clean harbour front for Vespar
    S(x, y, land ? T.G : T.WA);
  }
  // 2. beaches
  for (let y = 2; y < LH - 2; y++) for (let x = 2; x < LW - 2; x++) { if (Gt(x, y) !== T.G) continue; let w = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) if (Gt(x + dx, y + dy) === T.WA) { w = 1; break; } if (w) S(x, y, T.SA); }
  // 3. the northern ridge: cliffs, scree and ore-bearing rock; woods in the west; sparse trees elsewhere
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    if (Gt(x, y) !== T.G) continue; const inMoon = ell(AL.moon, x, y, 0), inSk = ell(AL.skara, x, y, 0);
    const ridgeY = 168 + (nC(x, 0) - .5) * 60;
    if (!inMoon && !inSk && y < ridgeY && x > 240 && x < 1000) { const k = nR(x, y); if (k > .6) S(x, y, T.CL); else if (hash(x, y) % 11 === 0) S(x, y, T.RK); else if (k > .5 && hash(x + 1, y) % 3 === 0) S(x, y, T.DI); continue; }
    const f = nF(x, y) * .7 + nF2(x, y) * .3;
    if (inMoon) { if (y < 420 && nR(x, y) > .62) S(x, y, T.CL); else if (f > .6 && r() < .3) S(x, y, T.TR); continue; }
    if (x < 520 && !inSk) { if (f > .44 && r() < .55) S(x, y, T.TR); else if (r() < .006) S(x, y, T.MR); continue; }
    if (inSk) { if (f > .55 && r() < .3) S(x, y, T.TR); continue; }
    if (f > .7 && r() < .22) S(x, y, T.TR); else if (r() < .004) S(x, y, T.MR); else if (hash(x, y) % 97 === 0 && f < .3) S(x, y, T.RK);
  }
  // 4. the river: a spring below the ridge, the narrow vale, three channels at the mouth
  const water = (pts, hw) => annAlong(pts, hw + 1.3, (x, y, d) => { if (d <= hw) S(x, y, T.WA); else if (Gt(x, y) !== T.WA) S(x, y, T.SH); });
  disc(AL.river[0][0] + AO, AL.river[0][1], 4.5, (x, y) => tSet(x, y, T.WA));
  water(AL.river, 2.6); water(AL.C1, 2.4); water(AL.C2, 2.4); water(AL.C3, 2.4); water(AL.X, 2.2);
  const band = (pts, hw, gap) => annAlong(pts, hw, (x, y) => { const t = Gt(x, y); if (t === T.WA || t === T.SH) return; if (nR(x, y) > gap) return; S(x, y, T.CL); });
  band([[650, 300], [706, 357], [756, 412], [806, 462]], 3.2, .74);
  band([[612, 357], [660, 405], [708, 458]], 3, .76);
  // 5. Mynoc mine: the cliff mass, an adit and a walkable first chamber with ore faces
  for (let y = 160; y <= 292; y++) for (let x = 540; x <= 700; x++) { const ja = nR(x, y) - .5; if (!annInPoly(x + ja * 10, y - ja * 10, AL.spur) || Gt(x, y) === T.WA) continue; S(x, y, T.CL); }
  annAlong(AL.adit, 1.6, (x, y) => S(x, y, T.CF)); const [c0, c1, c2, c3] = AL.chamber;
  for (let y = c1; y <= c3; y++) for (let x = c0; x <= c2; x++) { const e = Math.min(x - c0, c2 - x, y - c1, c3 - y); if (e === 0 && hash(x, y) % 3 === 0) continue; S(x, y, T.CF); }
  for (let y = c1 - 1; y <= c3 + 1; y++) for (let x = c0 - 1; x <= c2 + 1; x++) { if (Gt(x, y) !== T.CF) continue; let wall = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (Gt(x + dx, y + dy) === T.CL) wall = 1; if (wall && (x + y) % 2 === 0 && !(y > c3 - 2 && Math.abs(x - 615) < 3)) S(x, y, T.RK); }
  ANN.mine = { x0: c0 + AO, y0: c1, x1: c2 + AO, y1: c3, front: (c1 + c3) / 2 };
  for (const [x, y] of AL.adit.slice(1, -1)) LIGHTS.push({ x: x + AO, y, r: 4 }); LIGHTS.push({ x: 609 + AO, y: 205, r: 5 }, { x: 621 + AO, y: 214, r: 5 });
  // 6. roads (cobbled main roads, dirt trails); carve bridges any water it meets
  const road = (pts, w, t) => carve(annG(pts), w, t || T.RD);
  road(AL.forest, 3); road(AL.north, 3); road(AL.east, 3); road(AL.cart, 3);
  disc(AL.fork[0] + AO + 1, AL.fork[1] + 1, 5, (x, y) => tSet(x, y, T.RD));
  ANN.roads = { forest: annG(AL.forest), north: annG(AL.north), east: annG(AL.east), cart: annG(AL.cart) };
  const clear = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = Gt(x, y); if (k !== T.WA && k !== T.SH && k !== T.CL && k !== T.SA || t === 'all') S(x, y, typeof t === 'number' ? t : T.G); } };
  const house = (x, y, w, d, side, mat, role, spur) => {   // a kit building; a short path from the door, then along to a street
    for (let yy = y - 1; yy <= y + d; yy++) for (let xx = x - 1; xx <= x + w; xx++) { const k = Gt(xx, yy); if (k === T.TR || k === T.RK || k === T.MR || k === T.CL || k === T.SA) S(xx, yy, T.G); }
    const b = kitBuilding(x + AO, y, w, d, side, mat, role); const dx = x + (w >> 1), dy = side === 'S' ? y + d : y - 1, st = side === 'S' ? 1 : -1;
    for (let k = 0; k < 12; k++) { const yy = dy + k * st; if (k > 2 && spur === undefined && (Gt(dx, yy) === T.RD || Gt(dx + 1, yy) === T.RD)) break; if (k > 2 && spur !== undefined) break;
      for (const ox of [0, 1]) { const t = Gt(dx + ox, yy); if (t === T.FL || t === T.WA || t === T.WL || t === T.FN || t === T.BR || t === T.SBR) { k = 99; break; } S(dx + ox, yy, T.RD); } }
    if (spur !== undefined) { const yy = dy + 2 * st; for (let xx = Math.min(dx, spur); xx <= Math.max(dx, spur); xx++) for (const oy of [0, 1]) { const t = Gt(xx, yy + oy); if (t !== T.FL && t !== T.WA && t !== T.WL) S(xx, yy + oy, T.RD); } }
    return b; };
  const deck = (x0, y0, x1, y1, onWater, onLand) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const t = Gt(x, y); S(x, y, t === T.WA || t === T.SH || t === T.BR ? onWater : onLand === undefined ? t : onLand); } };
  const npc = (role, name, x, y, town) => ANN.npcs.push({ role, name, x: x + AO, y, town });
  const lm = (kind, x, y, o) => { o = o || {}; const p = place('__lm', x + AO, y, { d: o.d !== undefined ? o.d + AO : x + AO + y }); p.draw = LMD[kind]; p.lm = kind; Object.assign(p, o.extra || {}); if (o.col) addCol(x + AO - o.col, y - o.col, x + AO + o.col, y + o.col); return p; };
  const town = (id, n, x0, y0, x1, y1, cx, cy) => { ANN.zones.push({ id, x0: x0 + AO, y0, x1: x1 + AO, y1 }); if (n) ANN.towns.push({ id, n, x: cx + AO, y: cy }); };
  const prot = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x + AO < W && y < H) PROT[y * W + x + AO] = 1; };
  const shrine = (id, n, x, y) => { S(x, y, T.AK); SHRINES.push({ id, n, x: x + AO, y }); };
  const label = (n, x, y, minor) => ANN.labels.push({ n, x: x + AO, y, minor: !!minor });

  /* ---------------- MYNOC: mining and smithing ---------------- */
  {
    const [yx, yy] = AL.yard; clear(500, 255, 576, 318); disc(yx + AO, yy, 9.5, (x, y) => tSet(x, y, T.RD));
    road([[566, 300], [578, 290], [588, 284]], 2, T.DI);                                       // yard → mine mouth
    tSet(AL.forge[0] + AO, AL.forge[1], T.FG); tSet(AL.anvil[0] + AO, AL.anvil[1], T.AN);
    STATIONS.push({ k: 'forge', x: AL.forge[0] + AO, y: AL.forge[1], town: 'mynoc' }, { k: 'anvil', x: AL.anvil[0] + AO, y: AL.anvil[1], town: 'mynoc' });
    lm('chimney', AL.forge[0] + .5, AL.forge[1] - .25, { d: AL.forge[0] + AL.forge[1] + .6 }); addCol(AL.forge[0] + AO + .25, AL.forge[1] - .6, AL.forge[0] + AO + .75, AL.forge[1] - .1);
    lm('scales', 566.5, 291.5, { col: .25 });
    house(538, 286, 10, 4, 'S', 'stone', 'mynoc_smith'); house(553, 276, 10, 4, 'S', 'stone', 'mynoc_bank'); house(568, 282, 8, 4, 'S', 'timber', 'mynoc_supply');
    for (const [x, y, s] of [[524, 300, 'N'], [513, 288, 'S'], [525, 274, 'S'], [511, 262, 'S']]) house(x, y, 6, 4, s, 'timber', 'cottage');
    road([[516, 294], [528, 292], [552, 294]], 2, T.DI); road([[514, 268], [520, 280], [528, 280], [540, 284]], 2, T.DI);
    shrine('mynoc', 'Mynoc shrine', 548, 303);
    // the mine mouth: timber portal, cart siding and spoil heap, all visible from the yard
    lm('portal', 589.5, 283.2, { d: 589 + 283 + 1.2 }); lm('rails', 590.5, 288, { extra: { x1: 595 + AO, y1: 294.5 } }); lm('spoil', 596.5, 296.8, { col: .8 });
    for (const [x, y] of [[593, 284], [584, 291]]) place('barrel_dock', x + AO + .5, y + .5, { col: true });
    lm('lantern', 587.6, 284.4);
    town('mine', null, 576, 192, 654, 286); town('mynoc', 'Mynoc', 500, 250, 600, 322, 556, 300); prot(500, 192, 654, 322);
    npc('banker', 'Hobb, Mynoc banker', 558.5, 278.4, 'mynoc'); npc('smith', 'Brega, forgemistress', 559.5, 292.5, 'mynoc'); npc('miner', 'Tollin, mine stores', 572.5, 284.4, 'mynoc');
    npc('healer', 'Sister Ewe, healer', 549.5, 305.5, 'mynoc'); npc('guard', 'Mynoc warden', 556.5, 310.5, 'mynoc'); npc('guard', 'Mynoc warden', 586.5, 288.5, 'mynoc');
    label('Mynoc Mine', 614, 212, true);
  }
  /* ---------------- VESPAR: river islands, bridges and trade ---------------- */
  {
    // bridges first: stone to Market Island, timber to Workshop Island, Customs Bridge, the quay footbridge, and one to the east bank
    deck(864, 589, 891, 592, T.SBR, T.RD);
    deck(930, 553, 931, 574, T.BR, T.RD);
    deck(931, 584, 947, 586, T.SBR, T.RD);
    deck(1000, 553, 1001, 581, T.BR, T.RD);
    deck(912, 510, 913, 533, T.BR, T.RD);
    for (const [x0, x1, y] of [[864, 891, 588], [864, 891, 593], [931, 947, 583], [931, 947, 587]]) for (let x = x0; x <= x1; x++) if (Gt(x, y) === T.WA || Gt(x, y) === T.SH) place('fence_stone_x', x + AO, y + (y === 588 || y === 583 ? 1 : 0), { d: x + AO + y + .5 });
    for (const [x, y0, y1] of [[929, 553, 574], [932, 553, 574], [999, 553, 581], [1002, 553, 581], [911, 510, 533], [914, 510, 533]]) for (let y = y0; y <= y1; y++) if (Gt(x, y) === T.WA || Gt(x, y) === T.SH) place('dock_railing_z', x + AO + (x === 932 || x === 1002 || x === 914 ? 0 : 1), y, { d: x + AO + y + .5 });
    // West bank: the road from Mynoc, a small cemetery, two houses
    for (let y = 562; y <= 580; y++) for (let x = 824; x <= 842; x++) { const e = x === 824 || x === 842 || y === 562 || y === 580; if (e && !(y === 571 && x === 842)) S(x, y, T.FN); else if (!e) S(x, y, (x % 3 === 0 && y % 3 === 1) ? T.GV : T.G); }
    lm('bigtree', 830.5, 566.5, { col: .35 });
    house(846, 600, 8, 4, 'N', 'timber', 'house'); house(834, 612, 8, 4, 'N', 'timber', 'house'); road([[843, 571], [852, 572]], 2, T.DI);
    // Market Island: the square, with the bank opening straight onto it
    for (let y = 575; y <= 622; y++) for (let x = 886; x <= 934; x++) { const t = Gt(x, y); if (t === T.G || t === T.SA || t === T.TR || t === T.MR || t === T.RK) S(x, y, T.RD); }
    house(AL.vbank[0], AL.vbank[1], 10, 4, 'S', 'stone', 'vespar_bank'); house(912, 573, 8, 4, 'S', 'stone', 'vespar_hall');
    shrine('vespar', 'Vespar shrine', 910, 610);
    for (const [x, y] of [[893, 602], [920, 600], [900, 614]]) { place('awning_market', x + AO + .5, y + .6); place('crate_shipping', x + AO - .4, y + 1.2, { col: true }); }
    // Workshop Island: tailor, tinker and supply shop on one lane, a narrow quay along the south water
    for (let x = 878; x <= 1006; x++) for (const y of [545, 546]) if (Gt(x, y) !== T.WA) S(x, y, T.RD);
    for (let x = 931; x <= 1003; x++) for (const y of [556, 557]) { const t = Gt(x, y); if (t !== T.WA && t !== T.SH && t !== T.BR) S(x, y, T.RD); else if (t === T.SH) S(x, y, T.BR); }
    house(880, 535, 8, 4, 'S', 'timber', 'vespar_tailor'); house(892, 535, 8, 4, 'S', 'timber', 'vespar_tinker'); house(916, 535, 10, 4, 'S', 'timber', 'vespar_supply');
    for (const x of [950, 962, 976]) house(x, 533, 8, 4, 'S', 'timber', 'house');
    for (const x of [944, 962, 980]) house(x, 549, 6, 4, 'N', 'timber', 'house');
    // East bank: a row of houses and the footbridge
    for (const x of [890, 918, 936]) house(x, 500, 8, 4, 'S', 'timber', 'house'); for (let x = 888; x <= 950; x++) for (const y of [506, 507]) if (Gt(x, y) !== T.WA && Gt(x, y) !== T.FL) S(x, y, T.RD);
    // Customs Island: warehouses, the fish market and the harbour
    for (let x = 943; x <= 1015; x++) for (const y of [595, 596, 597]) if (Gt(x, y) !== T.WA) S(x, y, T.RD); for (let y = 582; y <= 597; y++) for (const x of [948, 949]) if (Gt(x, y) !== T.WA) S(x, y, T.RD);
    house(943, 575, 9, 4, 'S', 'stone', 'vespar_fishhall'); house(921, 573, 7, 4, 'S', 'stone', 'vespar_hall');
    house(950, 604, 14, 6, 'N', 'stone', 'warehouse'); house(968, 604, 14, 6, 'N', 'stone', 'warehouse'); house(988, 604, 10, 6, 'N', 'stone', 'customs');
    for (const x of [960, 970, 980]) { place('awning_market', x + AO + .5, 589.6); place('barrel_dock', x + AO - .3, 590.2, { col: true }); } place('net_fishing', 990.5 + AO, 589.6);
    deck(1012, 594, 1034, 598, T.BR, T.RD); deck(1028, 586, 1031, 606, T.BR, T.RD);
    for (const [x, y] of [[1034, 594], [1034, 598], [1031, 586], [1031, 606], [1028, 606]]) place('dock_piling', x + AO + .1, y + .5); for (const [x, y] of [[1016, 594], [1022, 598]]) place('bollards_rope', x + AO + .5, y + .4, { col: true });
    lm('boat', 1036.5, 591, { extra: { big: 1, o: 'x' } }); lm('boat', 1036.5, 603, { extra: { big: 1, o: 'x' } });
    for (let y = 520; y < 680; y++) for (let x = 1016; x < 1050; x++) if (Gt(x, y) === T.SA || Gt(x, y) === T.G) S(x, y, T.WA);
    town('vespar', 'Vespar', 818, 488, 1040, 642, 905, 588); prot(818, 488, 1040, 642);
    npc('banker', 'Quill, Vespar banker', 903.5, 575.4, 'vespar'); npc('tailor', 'Merrin, tailor', 884.5, 537.4, 'vespar'); npc('tinker', 'Pip, tinker', 896.5, 537.4, 'vespar');
    npc('provisioner', 'Adda, supplies', 921.5, 537.4, 'vespar'); npc('fishmonger', 'Old Cray, fishmonger', 947.5, 577.4, 'vespar'); npc('healer', 'Brother Lune, healer', 912.5, 613.5, 'vespar');
    npc('boat', 'Captain Rhea, Moonglen boat', 1030.5, 594.5, 'vespar'); npc('packet', 'Captain Ysolde, Quay packet', 1030.5, 598.6, 'vespar');
    for (const [x, y] of [[868.5, 595.5], [950.5, 589.5], [1010.5, 593.5], [852.5, 566.5]]) npc('guard', 'Vespar watch', x, y, 'vespar');
    label('Market Island', 910, 618, true); label('Workshop Island', 935, 540, true); label('Customs Island', 980, 615, true);
  }
  /* ---------------- SKARA BRYN: ferry island and rangers ---------------- */
  {
    clear(60, 588, 176, 694); clear(186, 594, 262, 676);
    deck(165, 639, 180, 641, T.BR, T.RD); deck(186, 639, 194, 641, T.BR, T.RD);
    for (const [x, y] of [[180, 638], [180, 642], [186, 638], [186, 642]]) place('dock_piling', x + AO + .5, y + .5);
    place('sign_pier', 178.5 + AO, 637.6, { col: true }); place('sign_pier', 187.5 + AO, 643.4, { col: true });
    lm('ferry', 183.4, 643.2, { extra: { o: 'x' } });
    disc(140 + AO, 640, 7.5, (x, y) => tSet(x, y, T.RD)); road([[148, 639], [166, 639]], 3); road([[124, 632], [158, 632]], 2); road([[124, 648], [158, 648]], 2);
    lm('bigtree', AL.skTree[0] + .5, AL.skTree[1] + .5, { col: .45, extra: { big: 1 } });
    house(127, 624, 9, 4, 'S', 'stone', 'skara_bank'); house(146, 624, 10, 4, 'S', 'timber', 'skara_inn');
    house(125, 652, 9, 4, 'N', 'timber', 'skara_bowyer'); house(146, 652, 9, 4, 'N', 'timber', 'skara_fletcher');
    // the woodland archery range behind the houses
    road([[112, 640], [133, 640]], 2, T.DI); for (let y = 632; y <= 648; y++) for (let x = 86; x <= 112; x++) if (Gt(x, y) === T.TR || Gt(x, y) === T.G) S(x, y, T.DI);
    for (const y of [634.5, 640.5, 646.5]) lm('butt', 87.5, y, { col: .3 }); for (const y of [632, 636, 644, 648]) place('fence_wood_post', 110.5 + AO, y + .5, { col: true });
    // the orchard and its moongate; a path down to the old tree
    for (let y = 594; y <= 616; y++) for (let x = 96; x <= 150; x++) if (Gt(x, y) !== T.WA && Gt(x, y) !== T.SA) S(x, y, T.G);
    for (let y = 596; y <= 614; y += 4) for (let x = 98; x <= 148; x += 5) { if (Math.hypot(x - AL.skGate[0], y - AL.skGate[1]) < 6 || Math.abs(x - 127) < 3) continue; place((x + y) % 2 ? 'tree_autumn_birch' : 'tree_marsh_oak', x + AO + .5, y + .5, { col: true }); }
    disc(AL.skGate[0] + AO + .5, AL.skGate[1] + .5, 3.5, (x, y) => tSet(x, y, T.RD)); road([[122, 607], [131, 612], [139, 619], [139, 632]], 2, T.DI);
    // mainland side: fenced fields, the stable, the ranger hall, the ferry landing at the end of the forest road
    for (let y = 598; y <= 628; y++) for (let x = 206; x <= 246; x++) { const e = x === 206 || x === 246 || y === 598 || y === 628; if (e && !(y === 628 && (x === 226 || x === 227))) S(x, y, T.FN); else if (!e) S(x, y, y % 2 ? T.CP : T.DI); }
    house(205, 652, 8, 4, 'N', 'timber', 'skara_stable'); house(222, 652, 12, 4, 'N', 'timber', 'skara_rangers');
    for (const [x, y] of [[214, 662], [216, 664]]) place('crate_shipping', x + AO + .5, y + .5, { col: true });
    shrine('skara', 'Skara Bryn shrine', 133, 646);
    for (let y = 586; y <= 694; y++) for (let x = 62; x <= 176; x++) { if (Gt(x, y) !== T.G) continue; const inRange = x >= 80 && x <= 114 && y >= 626 && y <= 654, core = Math.hypot(x - 138, y - 640) < 24, orch = y >= 592 && y <= 618 && x >= 94 && x <= 152;
      if (!core && !orch && hash(x, y) % (inRange ? 4 : 9) === 0 && !(inRange && y >= 631 && y <= 649)) S(x, y, T.TR); }
    town('skara', 'Skara Bryn', 60, 585, 182, 695, 132, 636); town('skaraland', null, 183, 590, 262, 676); prot(60, 585, 262, 695);
    npc('ferry', 'Tam, ferryman', 179.5, 640.5, 'skara'); npc('ferry', 'Wenna, ferrywoman', 186.5, 640.5, 'skaraland');
    npc('banker', 'Ivo, Skara banker', 131.5, 626.4, 'skara'); npc('innkeeper', 'Maeve, innkeeper', 151.5, 626.4, 'skara');
    npc('workshop', 'Fen, bowyer', 129.5, 653.6, 'skara'); npc('fletcher', 'Ash, fletcher', 150.5, 653.6, 'skara'); npc('healer', 'Old Rowan, healer', 135.5, 648.5, 'skara');
    npc('ranger', 'Ranger-captain Hale', 228.5, 653.6, 'skaraland'); npc('stable', 'Dorn, stablehand', 209.5, 653.6, 'skaraland');
    npc('guard', 'Skara ranger', 160.5, 643.5, 'skara'); npc('guard', 'Skara ranger', 199.5, 637.5, 'skaraland');
    label('Archery range', 98, 630, true); label('Orchard', 108, 598, true);
  }
  /* ---------------- MOONGLEN: island of mages ---------------- */
  {
    clear(1180, 420, 1345, 790); const lane = [[1263, 771], [1263, 740], [1262, 700], [1264, 660], [1264, 634]];
    deck(1262, 772, 1265, 792, T.BR, T.RD); road(lane, 3);
    for (const [x, y] of [[1261, 792], [1266, 792], [1261, 784], [1266, 784]]) place('dock_piling', x + AO + .5, y + .5);
    lm('boat', 1269.6, 789, { extra: { big: 1, o: 'z' } });
    house(1242, 708, 9, 4, 'S', 'timber', 'moon_reagents', 1263); house(1272, 694, 10, 4, 'S', 'stone', 'moon_inn', 1265);
    // the walled college: south arch from the lane, far arch to the library and the observatory
    const [wx0, wy0, wx1, wy1] = [1234, 572, 1296, 634];
    for (let y = wy0; y <= wy1; y++) for (let x = wx0; x <= wx1; x++) { const e = x === wx0 || x === wx1 || y === wy0 || y === wy1; if (e) { if ((y === wy0 || y === wy1) && x >= 1262 && x <= 1266) S(x, y, T.RD); else S(x, y, T.WL); } else S(x, y, T.RD); }
    house(1238, 620, 9, 4, 'N', 'stone', 'moon_bank'); house(1284, 620, 9, 4, 'N', 'stone', 'moon_mage');
    house(1238, 580, 14, 6, 'S', 'stone', 'college_hall'); house(1276, 580, 14, 6, 'S', 'stone', 'college_hall');
    road([[1264, 572], [1264, 540], [1266, 470], [1264, 446]], 3); house(1236, 528, 16, 6, 'S', 'stone', 'moon_library', 1264);
    const ob = house(AL.obs[0], AL.obs[1], 12, 6, 'S', 'stone', 'moon_observatory'); lm('dome', AL.obs[0] + 6, AL.obs[1] + 3, { d: AL.obs[0] + 12 + AL.obs[1] + 6 + .4 }); void ob;
    for (let y = 400; y <= 430; y++) for (let x = 1236; x <= 1296; x++) if ((x < 1252 || x > 1276 || y < 414) && nR(x, y) > .5 && Gt(x, y) !== T.WA) S(x, y, T.CL);
    // the eastern herb gardens loop back to the harbour lane
    road([[1266, 456], [1300, 470], [1324, 520], [1328, 600], [1310, 660], [1266, 702]], 2, T.DI);
    for (let y = 528; y <= 628; y++) for (let x = 1308; x <= 1320; x++) { if (y > 572 && y < 584) continue; if (Gt(x, y) !== T.G && Gt(x, y) !== T.TR) continue; S(x, y, (y % 4 === 0) ? T.DI : hash(x, y) % 5 === 0 ? T.HB : T.CP); }
    // the moongate among three pale standing stones, outside the college wall
    disc(AL.mgGate[0] + AO + .5, AL.mgGate[1] + .5, 6.5, (x, y) => tSet(x, y, T.G)); road([[1206, 609], [1226, 640], [1262, 660]], 2, T.DI);
    for (const [x, y] of [[1199.5, 597.5], [1211.5, 597.5], [1205.5, 611.2]]) lm('stone', x, y, { col: .3 });
    town('moonglen', 'Moonglen', 1185, 420, 1345, 795, 1265, 600); prot(1185, 420, 1345, 795);
    npc('banker', 'Sela, college bank', 1242.5, 621.6, 'moonglen'); npc('mage', 'Magister Orrin', 1288.5, 621.6, 'moonglen'); npc('reagents', 'Nettle, reagent seller', 1246.5, 710.4, 'moonglen');
    npc('innkeeper', 'Pell, innkeeper', 1277.5, 696.4, 'moonglen'); npc('scholar', 'Archivist Venn', 1244.5, 532.4, 'moonglen'); npc('scholar', 'Astronomer Iska', 1264.5, 438.4, 'moonglen');
    npc('healer', 'Sister Moira, healer', 1258.5, 640.5, 'moonglen'); npc('boat', 'Captain Hollis, Vespar boat', 1264.4, 779.2, 'moonglen');
    npc('guard', 'College warden', 1261.5, 636.5, 'moonglen'); npc('guard', 'College warden', 1268.5, 569.5, 'moonglen');
    S(1259, 646, T.AK); SHRINES.push({ id: 'moonglen', n: 'Moonglen shrine', x: 1259 + AO, y: 646 });
    for (let y = 425; y <= 780; y++) for (let x = 1186; x <= 1344; x++) if (Gt(x, y) === T.G && hash(x, y) % 19 === 0 && Math.hypot(x - AL.mgGate[0], y - AL.mgGate[1]) > 8) S(x, y, T.TR);
    label('Observatory', 1264, 426, true); label('Library', 1244, 524, true); label('Herb gardens', 1314, 580, true);
  }
  // the main roads again, so town clearings never cut them
  road(AL.forest, 3); road(AL.north, 3); road(AL.east, 3); road(AL.cart, 3); road([[828, 598], [858, 595], [866, 592]], 2);
  /* ---------------- landmarks, signs and the three public moongates ---------------- */
  {
    for (let y = AL.fork[1] - 16; y <= AL.fork[1] + 14; y++) for (let x = AL.fork[0] - 18; x <= AL.fork[0] + 16; x++) if (Gt(x, y) === T.TR && Math.hypot(x - AL.fork[0], y - AL.fork[1]) < 14) S(x, y, T.G);   // a glade at the fork
    lm('tower', AL.tower[0] + .5, AL.tower[1] + .5, { col: .6 }); for (const [x, y] of [[470, 669], [477, 668], [471, 675]]) { if (Gt(x, y) === T.G) S(x, y, T.WL); }
    lm('sign', AL.forkSign[0] + .5, AL.forkSign[1] + .5, { col: .12 }); ANN.signs.push({ x: AL.forkSign[0] + AO + .5, y: AL.forkSign[1] + .5, lines: ['↑ Mynoc', '→ Vespar', '← Skara Bryn ferry'] });
    lm('wheel', AL.wheel[0] + .5, AL.wheel[1] + .5, { d: AL.wheel[0] + AL.wheel[1] + 1.5 });
    disc(AL.cross[0] + AO + .5, AL.cross[1] + .5, 4.5, (x, y) => tSet(x, y, T.RD)); road([[AL.cross[0] + 3, AL.cross[1] - 2], [AL.crossSign[0] - 1, AL.crossSign[1]]], 2);
    lm('sign', AL.crossSign[0] + .5, AL.crossSign[1] + .5, { col: .12 }); ANN.signs.push({ x: AL.crossSign[0] + AO + .5, y: AL.crossSign[1] + .5, lines: ['↖ Mynoc Mine', 'Vespar Docks ↘'] });
    const gate = (id, n, x, y) => { const g = { id, n, x: x + AO + .5, y: y + .5 }; ANN.gates.push(g); lm('gate', x + .5, y + .5); return g; };
    gate('cross', 'Miner’s Cross', AL.cross[0], AL.cross[1]); gate('skara', 'Skara Bryn', AL.skGate[0], AL.skGate[1]); gate('moonglen', 'Moonglen', AL.mgGate[0], AL.mgGate[1]);
    label('Forest fork', AL.fork[0], AL.fork[1] + 8, true); label('Waterwheel', AL.wheel[0] + 6, AL.wheel[1] + 6, true); label('Northern Ridge', 640, 120, true); label('Westwood', 330, 560, true);
    ANN.river = annG(AL.river);
  }
  /* ---------------- travel routes over water ---------------- */
  ANN.routes.push(
    { id: 'ferry', kind: 'ferry', a: { x: 177.5 + AO, y: 640.5, n: 'Skara Bryn' }, b: { x: 188.5 + AO, y: 640.5, n: 'the mainland landing' } },
    { id: 'moon', kind: 'boat', a: { x: 1029.5 + AO, y: 596.5, n: 'Vespar' }, b: { x: 1263.5 + AO, y: 777.5, n: 'Moonglen' } },
    { id: 'packet', kind: 'boat', a: { x: 1029.5 + AO, y: 596.6, n: 'Vespar' }, b: { x: 47.5, y: 288.6, n: 'Saltmarsh Quay' } });
  // wilderness: thin the woods to one tree in a 3×3 cell, so every wood is walkable; then creatures
  { const cell = new Set(); for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) { if (Gt(x, y) !== T.TR) continue; const k = Math.floor(x / 3) + ',' + Math.floor(y / 3); if (x % 3 === 2 || y % 3 === 2 || cell.has(k)) S(x, y, T.G); else cell.add(k); } }
  SPAWNS.push(
    { type: 'boar', x: 360 + AO, y: 610, r: 40, max: 6 }, { type: 'boar', x: 330 + AO, y: 470, r: 44, max: 5 }, { type: 'rat', x: 262 + AO, y: 712, r: 14, max: 4 },
    { type: 'skeleton', x: 470 + AO, y: 700, r: 9, max: 2 }, { type: 'hound', x: 720 + AO, y: 150, r: 40, max: 4, pack: 2 }, { type: 'snapper', x: 790 + AO, y: 640, r: 22, max: 3 },
    { type: 'spider', x: 1340 + AO, y: 430, r: 18, max: 3 }, { type: 'rat', x: 860 + AO, y: 660, r: 12, max: 3 });
  for (const s of SPAWNS) if (s.n === undefined) { s.n = 0; s.next = 0; }
}

/* ---------------- zones, node grades ---------------- */
function annZone(x, y) {
  if (x < SW) return 'sea';
  for (const z of ANN.zones) if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z.id;
  const t = tAt(x, y); const lx = x - AO;
  if (Math.hypot((lx - AL.moon.cx) / AL.moon.rx, (y - AL.moon.cy) / AL.moon.ry) < 1.06) return t === T.WA ? 'sea' : 'mglen';
  if (t === T.WA && (lx < 190 || lx > 1012 || y > 940 || y < 75)) return 'sea';
  if (y < 190) return 'ridge';
  if (ANN.river && annPolyD(x, y, ANN.river) < 42 && y < 520) return 'vale';
  if (lx < 520) return 'woods';
  return 'fields';
}
/* Mynoc's first chamber: grade 1 faces near the adit, grade 2 at the back; ridge rock grade 3; elsewhere grade 2 */
function annTier(x, y) {
  const m = ANN.mine; if (m && x >= m.x0 - 1 && x <= m.x1 + 1 && y >= m.y0 - 1 && y <= m.y1 + 1) return y >= m.front ? 0 : 1;
  if (hash(x, y) % 41 === 0) return 3; const z = annZone(x, y); return z === 'ridge' ? 2 : z === 'mglen' || z === 'moonglen' ? 1 : 1;
}

/* ---------------- NPCs, talk and travel ---------------- */
const ANN_SAY = { guard: ['Keep the peace in town.', 'The roads past the gate are open wilderness.', 'Mind your pack beyond the boundary.'], stable: ['The horses are resting. Come back when the saddles are mended.', 'Rangers ride out at dawn.'],
  scholar: ['The stars over Anniabreen keep their own calendar.', 'Quiet, please. The archive remembers every voice.'] };
function annPopulate(npc) {
  for (const n of ANN.npcs) { const e = npc(n.role, n.name, n.x, n.y); e.town = n.town; }
  npc('packet', 'Captain Bram, Vespar packet', 49.5, 288.6);                        // the starter Quay's boat to Vespar (and back)
  if (typeof MG !== 'undefined') { SHOPS.reagents = Object.keys(MG.REAGENTS); if (!SHOPS.mage.includes('spellbook')) SHOPS.mage.push('spellbook', 'rune', ...MG.SPELLS.filter(s => s.circle <= 4).map(s => s.scroll)); }
  SHOPS.reagents = SHOPS.reagents.filter(id => SF.ITEMS[id] && SF.PRICES[id] !== undefined); SHOPS.mage = SHOPS.mage.filter(id => SF.ITEMS[id] && SF.PRICES[id] !== undefined);
  Object.assign(PANELS, { mgpick: annGatePanel });
  Object.assign(ACT, { mgto: d => annGateTo(+d.i), mgcancel: () => { MGPICK = null; closePanel(); snd('ui.close'); } });
}
function annTalk(n) {
  const rt = n.role === 'ferry' ? ANN.routes[0] : n.role === 'boat' ? ANN.routes[1] : n.role === 'packet' ? ANN.routes[2] : null;
  if (rt) { if (P.ghost) return say(n, 'I cannot carry the dead. Find a healer first.'), true; const fromA = Math.hypot(rt.a.x - n.x, rt.a.y - n.y) < Math.hypot(rt.b.x - n.x, rt.b.y - n.y); const to = fromA ? rt.b : rt.a;
    annTravel(to, rt.kind === 'ferry' ? `The ferry carries you across to ${to.n}.` : `You sail to ${to.n}.`); return true; }
  if (ANN_SAY[n.role] && (n.town || n.role !== 'guard')) { if (P.ghost && n.role === 'guard') return resurrect(), true; say(n, pick(ANN_SAY[n.role])); return true; }
  return false;
}
/* move the player (and pets and a following ally within reach) to dest; one interaction, either direction */
function annTravel(dest, msg) {
  const why = typeof travelCheck === 'function' ? travelCheck(null) : null; if (why) { log(why, '#ffb070'); return false; }
  if (inCombat()) { log('You cannot leave in the middle of a fight.', '#ffb070'); return false; }
  const al = ents.find(e => e.kind === 'ally' && !e.gone && !e.dead && e.order === 'follow' && dist(e, P) <= 8);
  if (typeof moveWithFollowers === 'function') moveWithFollowers({ x: dest.x, y: dest.y }); else { P.x = dest.x; P.y = dest.y; }
  if (al) { al.x = P.x + .6; al.y = P.y + .6; }
  P.task = null; P.batch = null; resetInput(); log(msg, '#ffe08a'); sndAt('world.surf', P); save(); return true;
}
/* ---------------- public moongates ---------------- */
let MGPICK = null;
const annNearGate = r => { let best = null, bd = r; for (const g of ANN.gates) { const d = Math.hypot(g.x - P.x, g.y - P.y); if (d < bd) { bd = d; best = g; } } return best; };
function annOpenGate(g) { MGPICK = g; openPanel('mgpick'); snd('ui.open'); }
function annGatePanel() {
  const g = MGPICK; if (!g || Math.hypot(g.x - P.x, g.y - P.y) > 3.3) return null;
  const rows = ANN.gates.map((d, i) => d === g ? '' : `<div class="row"><span class="nm">${esc(d.n)}</span>${btn('mgto', 'Travel', { i }, 'ac')}</div>`).join('');
  return ['Moongate · ' + g.n, `<p class="note">The gate shimmers. Choose where to step out.</p>${rows}<div class="row">${btn('mgcancel', 'Cancel')}</div>`];
}
function annGateTo(i) {
  const g = ANN.gates[i]; if (!g) return; const from = MGPICK; MGPICK = null; closePanel();
  if (from === g) return;
  const why = typeof travelCheck === 'function' ? travelCheck(null) : null; if (why) return log(why, '#ffb070');
  if (P.ghost) return log('Ghosts cannot travel this way.', '#ffb070');
  const dest = annArrival(g); if (typeof moveWithFollowers === 'function') moveWithFollowers(dest); else { P.x = dest.x; P.y = dest.y; }
  const al = ents.find(e => e.kind === 'ally' && !e.gone && !e.dead && e.order === 'follow' && from && Math.hypot(e.x - from.x, e.y - from.y) <= 8); if (al) { al.x = P.x + .6; al.y = P.y + .4; }
  P.mgDeb = { out: false }; FX.push({ k: 'ring', x: P.x, y: P.y, c: '#7aa8ff', t0: GT, dur: .9 }); log('You step out of the moongate at ' + g.n + '.', '#9fc4ff'); snd('magic.blink'); save();
}
/* clear ground beside the gate, outside the radius that opens the picker */
function annArrival(g) { for (const [dx, dy] of [[0, 2.7], [2.7, 0], [-2.7, 0], [0, -2.7], [2, 2], [-2, 2]]) { const x = g.x + dx, y = g.y + dy; if (canStand(P, x, y) && !BLK[tAt(Math.floor(x), Math.floor(y))]) return { x, y }; } return { x: g.x, y: g.y + 2.7 }; }
function annTick() {
  if (!P || P.ghost || !ANN.gates.length) return; const st = P.mgDeb || (P.mgDeb = { out: true });
  const g = annNearGate(.8); if (!g) { if (!annNearGate(1.9)) st.out = true; if (PANEL === 'mgpick' && MGPICK && Math.hypot(MGPICK.x - P.x, MGPICK.y - P.y) > 3.3) { MGPICK = null; closePanel(); } return; }
  if (st.out && PANEL !== 'mgpick') { st.out = false; annOpenGate(g); }
}
function annInteract() { const g = annNearGate(3.1); if (g) { annOpenGate(g); return true; } const s = annNearSign(2.2); if (s) { log('The sign reads: ' + s.lines.join(' · '), '#e8d8b0'); return true; } return false; }
function annCanInteract() { return !!(P && (annNearGate(3.1) || annNearSign(2.2))); }
const annNearSign = r => ANN.signs.find(s => Math.hypot(s.x - P.x, s.y - P.y) <= r);

/* ---------------- overlay, minimap and map symbols ---------------- */
function annOverlay(g, S) {
  if (!P || P.ghost) return; g.textAlign = 'center';
  for (const s of ANN.signs) { const d = Math.hypot(s.x - P.x, s.y - P.y); if (d > 8) continue; const [x, y] = S(s.x, s.y); g.font = `bold 12px ${PXF}`; s.lines.forEach((t, i) => { const yy = y - 58 / CAM.f - (s.lines.length - 1 - i) * 15; g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(t, x, yy); g.fillStyle = '#f4e2b0'; g.fillText(t, x, yy); }); }
  for (const q of ANN.gates) { const d = Math.hypot(q.x - P.x, q.y - P.y); if (d > 9) continue; const [x, y] = S(q.x, q.y); g.font = `bold 12px ${PXF}`; const yy = y - 92 / CAM.f; g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText('Moongate · ' + q.n, x, yy); g.fillStyle = '#a8c8ff'; g.fillText('Moongate · ' + q.n, x, yy); }
}
function annMiniDraw(g) { for (const q of ANN.gates) { const dx = q.x - P.x, dy = q.y - P.y; if (Math.abs(dx) > 45 || Math.abs(dy) > 45) continue; g.fillStyle = '#7aa8ff'; g.beginPath(); g.arc(dx, dy, 2.2, 0, 7); g.fill(); } }
function annMapDraw(g, X, Y, s, f, small) {
  const D = DPR; g.save(); g.lineJoin = 'round'; g.lineWidth = 2 * D; g.setLineDash([5 * D, 5 * D]); g.strokeStyle = 'rgba(255,240,200,.85)';
  for (const r of ANN.routes) { g.beginPath(); g.moveTo(X(r.a.x), Y(r.a.y)); g.lineTo(X(r.b.x), Y(r.b.y)); g.stroke(); }
  g.setLineDash([]);
  for (const r of ANN.routes) for (const e of [r.a, r.b]) { const x = X(e.x), y = Y(e.y), k = 5 * D; g.fillStyle = '#7a4a22'; g.strokeStyle = '#000'; g.lineWidth = 1.5 * D; g.beginPath(); g.moveTo(x - k * 1.4, y - k * .3); g.lineTo(x + k * 1.4, y - k * .3); g.lineTo(x + k * .8, y + k * .7); g.lineTo(x - k * .8, y + k * .7); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.fillRect(x - .7 * D, y - k * 1.7, 1.4 * D, k * 1.4); }
  for (const q of ANN.gates) { const x = X(q.x), y = Y(q.y); g.strokeStyle = '#2a5ad8'; g.lineWidth = 3 * D; g.beginPath(); g.ellipse(x, y, 4 * D, 7 * D, 0, 0, 7); g.stroke(); g.fillStyle = '#bcd4ff'; g.beginPath(); g.ellipse(x, y, 2.4 * D, 5 * D, 0, 0, 7); g.fill();
    if (!small || s > 1.2) { g.font = `600 ${f * .8}px ${PXF}`; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.85)'; g.textAlign = 'center'; g.strokeText(q.n, x, y + 17 * D); g.fillStyle = '#a8c8ff'; g.fillText(q.n, x, y + 17 * D); } }
  g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.85)';
  if (!small) for (const l of ANN.labels) { g.font = `${f * .78}px ${PXF}`; g.fillStyle = '#e8dcc0'; g.strokeText(l.n, X(l.x), Y(l.y)); g.fillText(l.n, X(l.x), Y(l.y)); }
  for (const t of ANN.towns) { const x = X(t.x), y = Y(t.y); g.fillStyle = '#ffe9b0'; g.strokeStyle = '#000'; g.lineWidth = 2 * D; g.fillRect(x - 3.5 * D, y - 3.5 * D, 7 * D, 7 * D); g.strokeRect(x - 3.5 * D, y - 3.5 * D, 7 * D, 7 * D);
    g.font = `bold ${f * 1.25}px ${PXF}`; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.9)'; g.strokeText(t.n, x, y - 9 * D); g.fillText(t.n, x, y - 9 * D); }
  g.restore();
}

/* ---------------- landmark art (procedural, in the kit's palette and pixel scale) ---------------- */
function annShadow(g, X, Y, rx, ry) { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(X, Y, rx, ry, 0, 0, 7); g.fill(); }
function annPoly(g, c, pts) { g.fillStyle = c; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); }
const LMD = {
  chimney(g, p) { const X = Math.round(SX(p.x, p.y)), Y = Math.round(SY(p.x, p.y)), h = 124; annShadow(g, X + 10, Y + 2, 18, 7);
    g.fillStyle = '#86452f'; g.fillRect(X - 11, Y - h, 11, h); g.fillStyle = '#5e2e1f'; g.fillRect(X, Y - h, 11, h);
    for (let i = 5; i < h; i += 7) { g.fillStyle = 'rgba(30,10,6,.35)'; g.fillRect(X - 11, Y - i, 22, 1); g.fillRect(X - 11 + ((i / 7) % 2) * 5 + 2, Y - i, 1, 7); }
    g.fillStyle = '#3e2c26'; g.fillRect(X - 14, Y - h - 6, 28, 7); g.fillStyle = '#2a1e1a'; g.fillRect(X - 9, Y - h - 9, 18, 4);
    const fl = .5 + .5 * Math.sin(GT * 9); g.fillStyle = `rgba(255,${130 + fl * 80 | 0},40,.9)`; g.fillRect(X - 6, Y - 14, 12, 8);
    for (let k = 0; k < 4; k++) { const t = (GT * .35 + k * .25) % 1; g.fillStyle = `rgba(190,186,180,${.55 * (1 - t)})`; g.beginPath(); g.arc(X + t * 18 + Math.sin(t * 6 + k) * 3, Y - h - 12 - t * 64, 5 + t * 11, 0, 7); g.fill(); } },
  scales(g, p) { const X = Math.round(SX(p.x, p.y)), Y = Math.round(SY(p.x, p.y)); annShadow(g, X, Y, 12, 5); g.fillStyle = '#4a3a2a'; g.fillRect(X - 2, Y - 34, 4, 34); g.fillRect(X - 16, Y - 34, 32, 3);
    for (const s of [-1, 1]) { g.strokeStyle = '#2a2420'; g.lineWidth = 1; g.beginPath(); g.moveTo(X + s * 14, Y - 32); g.lineTo(X + s * 14, Y - 20); g.stroke(); g.fillStyle = '#9a8a60'; g.beginPath(); g.ellipse(X + s * 14, Y - 19, 7, 3, 0, 0, 7); g.fill(); }
    g.fillStyle = '#8a7a6a'; g.fillRect(X - 17, Y - 23, 6, 3); },
  portal(g, p) { const L = [SX(p.x - 1.7, p.y), SY(p.x - 1.7, p.y)], R = [SX(p.x + 1.7, p.y), SY(p.x + 1.7, p.y)], h = 52;
    g.fillStyle = 'rgba(8,6,4,.85)'; annPoly(g, 'rgba(10,8,6,.9)', [[L[0] + 4, L[1] - 2], [R[0] - 4, R[1] - 2], [R[0] - 4, R[1] - h + 4], [L[0] + 4, L[1] - h + 4]]);
    for (const q of [L, R]) { g.fillStyle = '#6a4a2a'; g.fillRect(q[0] - 4, q[1] - h, 8, h); g.fillStyle = '#4a3018'; g.fillRect(q[0] + 1, q[1] - h, 3, h); }
    annPoly(g, '#7a5632', [[L[0] - 8, L[1] - h - 2], [R[0] + 8, R[1] - h - 2], [R[0] + 8, R[1] - h + 6], [L[0] - 8, L[1] - h + 6]]);
    g.fillStyle = '#ffd27a'; g.fillRect(L[0] + 6, L[1] - h + 12, 4, 5); },
  rails(g, p) { const a = [SX(p.x, p.y), SY(p.x, p.y)], b = [SX(p.x1, p.y1), SY(p.x1, p.y1)]; g.strokeStyle = '#5a4a3a'; g.lineWidth = 3;
    for (let k = 0; k <= 8; k++) { const t = k / 8, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t; g.beginPath(); g.moveTo(x - 6, y - 3); g.lineTo(x + 6, y + 3); g.stroke(); }
    g.strokeStyle = '#8a8a90'; g.lineWidth = 1.5; for (const o of [-4, 4]) { g.beginPath(); g.moveTo(a[0] + o * .7, a[1] - o * .4 + o * .3); g.lineTo(b[0] + o * .7, b[1] - o * .4 + o * .3); g.stroke(); }
    const cx = a[0] + (b[0] - a[0]) * .7, cy = a[1] + (b[1] - a[1]) * .7; annPoly(g, '#4a4440', [[cx - 12, cy - 18], [cx + 12, cy - 18], [cx + 9, cy - 4], [cx - 9, cy - 4]]); g.fillStyle = '#7a6a5a'; g.fillRect(cx - 9, cy - 22, 18, 5); g.fillStyle = '#2a2622'; g.fillRect(cx - 9, cy - 4, 4, 4); g.fillRect(cx + 5, cy - 4, 4, 4); },
  spoil(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y), h = hash(Math.floor(p.x), Math.floor(p.y)); annShadow(g, X, Y + 2, 40, 14);
    annPoly(g, '#6e665c', [[X - 40, Y + 2], [X - 22, Y - 22], [X - 4, Y - 34], [X + 16, Y - 26], [X + 40, Y + 2]]); annPoly(g, '#585048', [[X - 4, Y - 34], [X + 16, Y - 26], [X + 40, Y + 2], [X + 4, Y + 4]]);
    for (let i = 0; i < 18; i++) { g.fillStyle = ['#8a8278', '#4e4840', '#9a8a70'][i % 3]; g.fillRect(X - 30 + ((h >> i) % 60), Y - 18 + ((h >> (i + 2)) % 18), 3, 2); } },
  lantern(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y); g.fillStyle = '#2a2522'; g.fillRect(X - 1, Y - 30, 2, 30); g.fillStyle = '#ffd27a'; g.fillRect(X - 4, Y - 38, 8, 8); },
  wheel(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y) - 26, a = GT * 1.2; annShadow(g, X, Y + 28, 20, 6);
    g.fillStyle = '#5a3e22'; g.fillRect(X + 10, Y - 4, 6, 34); g.fillRect(X - 16, Y - 4, 6, 34);
    g.strokeStyle = '#7a5630'; g.lineWidth = 4; g.beginPath(); g.ellipse(X, Y, 12, 28, 0, 0, 7); g.stroke(); g.lineWidth = 2;
    for (let k = 0; k < 8; k++) { const t = a + k * Math.PI / 4; g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(t) * 12, Y + Math.sin(t) * 28); g.stroke(); g.fillStyle = '#6a4a28'; g.fillRect(X + Math.cos(t) * 12 - 3, Y + Math.sin(t) * 28 - 2, 6, 4); }
    g.fillStyle = 'rgba(200,230,255,.6)'; for (let k = 0; k < 4; k++) g.fillRect(X - 8 + k * 5, Y + 26 + Math.sin(GT * 8 + k) * 2, 2, 3); },
  tower(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y) + 8; annShadow(g, X + 16, Y, 44, 14);
    annPoly(g, '#9a9384', [[X - 28, Y - 6], [X, Y + 6], [X, Y - 124], [X - 8, Y - 112], [X - 15, Y - 120], [X - 22, Y - 104], [X - 28, Y - 108]]);
    annPoly(g, '#6e685c', [[X, Y + 6], [X + 28, Y - 6], [X + 28, Y - 96], [X + 20, Y - 104], [X + 12, Y - 100], [X + 6, Y - 116], [X, Y - 124]]);
    g.fillStyle = 'rgba(40,34,28,.35)'; for (let i = 12; i < 96; i += 10) { g.fillRect(X - 28, Y - 6 - i + 6 * 0, 28, 1); g.fillRect(X, Y - i, 28, 1); }
    g.fillStyle = '#1a1612'; g.fillRect(X - 17, Y - 70, 5, 13); g.fillRect(X + 12, Y - 56, 5, 12); g.fillRect(X - 10, Y - 28, 8, 22);
    annPoly(g, '#86806e', [[X + 22, Y + 4], [X + 40, Y - 4], [X + 52, Y + 4], [X + 36, Y + 12]]); annPoly(g, '#7a7464', [[X - 44, Y - 2], [X - 30, Y - 10], [X - 24, Y + 2], [X - 36, Y + 6]]);
    g.fillStyle = '#5a7a4a'; g.fillRect(X - 24, Y - 102, 6, 4); g.fillRect(X + 16, Y - 92, 7, 3); },
  sign(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y); annShadow(g, X, Y, 8, 3); g.fillStyle = '#5a3e22'; g.fillRect(X - 2, Y - 46, 4, 46);
    annPoly(g, '#a07444', [[X - 18, Y - 44], [X + 14, Y - 44], [X + 20, Y - 39], [X + 14, Y - 34], [X - 18, Y - 34]]); annPoly(g, '#8a6038', [[X + 18, Y - 30], [X - 14, Y - 30], [X - 20, Y - 25], [X - 14, Y - 20], [X + 18, Y - 20]]);
    g.fillStyle = '#3a2614'; g.fillRect(X - 12, Y - 40, 18, 1); g.fillRect(X - 8, Y - 26, 18, 1); },
  gate(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y), c = Y - 48; g.save(); g.translate(X, c); g.scale(1.25, 1.25); g.translate(-X, -c); annShadow(g, X, Y, 20, 8);
    const gr = g.createRadialGradient(X, c, 2, X, c, 36); gr.addColorStop(0, `rgba(220,236,255,${.8 + .15 * Math.sin(GT * 3)})`); gr.addColorStop(.6, 'rgba(90,140,255,.55)'); gr.addColorStop(1, 'rgba(40,80,220,.15)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(X, c, 15, 36, 0, 0, 7); g.fill();
    for (let i = 0; i < 3; i++) { g.strokeStyle = ['#2448b8', '#5a8cff', '#cfe0ff'][i]; g.lineWidth = 5 - i * 1.5; g.beginPath(); g.ellipse(X, c, 16 - i * 1.5, 38 - i * 2, 0, 0, 7); g.stroke(); }
    for (let k = 0; k < 6; k++) { const t = GT * 1.3 + k; g.fillStyle = 'rgba(230,240,255,.9)'; g.fillRect(X + Math.cos(t) * 10, c + Math.sin(t * 1.7) * 28, 2, 2); } g.restore(); },
  stone(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y); annShadow(g, X + 6, Y, 18, 7); annPoly(g, '#d8d6cc', [[X - 12, Y], [X + 12, Y], [X + 10, Y - 72], [X + 1, Y - 84], [X - 10, Y - 76]]); annPoly(g, '#b4b2a8', [[X + 2, Y], [X + 12, Y], [X + 10, Y - 72], [X + 2, Y - 82]]); g.fillStyle = 'rgba(120,150,120,.5)'; g.fillRect(X - 6, Y - 8, 6, 3); },
  dome(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y) - 66; g.fillStyle = '#8a8478'; g.fillRect(X - 34, Y - 6, 68, 16); g.fillStyle = '#6e685e'; g.fillRect(X, Y - 6, 34, 16);
    const gr = g.createLinearGradient(X - 36, 0, X + 36, 0); gr.addColorStop(0, '#e8ecf2'); gr.addColorStop(.55, '#b8c0cc'); gr.addColorStop(1, '#7c8594'); g.fillStyle = gr; g.beginPath(); g.arc(X, Y - 6, 36, Math.PI, 0); g.closePath(); g.fill();
    g.fillStyle = '#20283a'; annPoly(g, '#20283a', [[X - 4, Y - 6], [X + 4, Y - 6], [X + 3, Y - 41], [X - 3, Y - 41]]); g.strokeStyle = '#5a6272'; g.lineWidth = 1; for (const k of [-.6, -.3, .3, .6]) { g.beginPath(); g.ellipse(X, Y - 6, Math.abs(k) * 36, 36, 0, Math.PI, 0); g.stroke(); }
    g.fillStyle = '#c8a040'; g.fillRect(X - 1, Y - 48, 2, 7); },
  bigtree(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y), s = p.big ? 1.25 : 1; annShadow(g, X + 10, Y + 2, 42 * s, 15 * s); if (P && inFront(Math.floor(p.x), Math.floor(p.y))) g.globalAlpha = .55;
    annPoly(g, '#4e331b', [[X - 8 * s, Y], [X + 8 * s, Y], [X + 6 * s, Y - 56 * s], [X - 6 * s, Y - 56 * s]]); g.fillStyle = '#3a2412'; g.fillRect(X + 1, Y - 56 * s, 5 * s, 56 * s);
    for (const [ox, oy, r, c] of [[-22, -70, 26, '#2c5a30'], [20, -72, 28, '#2a5430'], [0, -96, 32, '#336a38'], [-14, -110, 20, '#3e7a42'], [16, -104, 22, '#3a7440'], [2, -122, 18, '#4a8a4c']]) { g.fillStyle = c; g.beginPath(); g.arc(X + ox * s, Y + oy * s, r * s, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(160,210,120,.35)'; for (let k = 0; k < 7; k++) g.fillRect(X - 30 * s + k * 9 * s, Y - (80 + (k % 3) * 18) * s, 3, 2); g.globalAlpha = 1; },
  butt(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y); annShadow(g, X, Y, 12, 5); g.fillStyle = '#5a3e22'; g.fillRect(X - 9, Y - 20, 3, 20); g.fillRect(X + 6, Y - 20, 3, 20);
    for (const [r, c] of [[14, '#c8b060'], [10, '#f0ece0'], [6, '#c03a2a'], [2.5, '#f0d040']]) { g.fillStyle = c; g.beginPath(); g.ellipse(X, Y - 26, r * .8, r, 0, 0, 7); g.fill(); } },
  ferry(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y), b = Math.sin(GT * 2) * 1.5; annPoly(g, '#5a3a1e', [[X - 36, Y - 14 + b], [X + 30, Y + 16 + b], [X + 38, Y + 10 + b], [X - 28, Y - 20 + b]]);
    annPoly(g, '#9a6a3c', [[X - 30, Y - 20 + b], [X + 34, Y + 10 + b], [X + 26, Y + 4 + b], [X - 36, Y - 26 + b]]); g.fillStyle = '#4e2e14'; for (let k = 0; k < 6; k++) g.fillRect(X - 26 + k * 10, Y - 18 + k * 5 + b, 2, 6);
    g.fillStyle = '#3a2614'; g.fillRect(X + 22, Y - 22 + b, 3, 26); },
  boat(g, p) { const X = SX(p.x, p.y), Y = SY(p.x, p.y), b = Math.sin(GT * 1.6 + p.x) * 2, z = p.o === 'z' ? -1 : 1;
    annPoly(g, '#4a2e16', [[X - 46 * z, Y - 22 + b], [X + 46 * z, Y + 22 + b], [X + 36 * z, Y + 32 + b], [X - 52 * z, Y - 10 + b]]); annPoly(g, '#7a4e2a', [[X - 46 * z, Y - 22 + b], [X + 46 * z, Y + 22 + b], [X + 40 * z, Y + 16 + b], [X - 50 * z, Y - 28 + b]]);
    g.fillStyle = '#3a2412'; g.fillRect(X - 2, Y - 92 + b, 4, 92);
    annPoly(g, '#e8e0cc', [[X + 3, Y - 88 + b], [X + 3 + 30 * z, Y - 50 + b], [X + 3, Y - 30 + b]]); annPoly(g, '#d0c6ae', [[X - 3, Y - 82 + b], [X - 3 - 24 * z, Y - 44 + b], [X - 3, Y - 34 + b]]);
    g.fillStyle = '#c03a2a'; g.fillRect(X - 1, Y - 100 + b, 10, 5); } };
/* tiles: cliff, grave, crop rows */
function drawAnnTile(g, t, x, y, h, cx, cy) {
  if (t === T.CL) { const Hh = 36 + (h % 4) * 9; const p = block(g, x, y, Hh, ['#7a7268', '#706860', '#847a6e'][h % 3], '#5c544c', '#463e38');
    const ax = p.T[0] + ((h >> 3) % 20 - 10), ay = p.T[1] + HH - Hh - 8 - ((h >> 6) % 10); annPoly(g, '#8a8276', [[p.L[0], p.L[1] - Hh], [ax, ay], [p.B[0], p.B[1] - Hh]]); annPoly(g, '#62594f', [[ax, ay], [p.Rr[0], p.Rr[1] - Hh], [p.B[0], p.B[1] - Hh]]);
    if (h % 5 === 0) { g.fillStyle = '#5a7a4a'; g.fillRect(p.L[0] + 8, p.L[1] - Hh * .4, 5, 3); } return; }
  if (t === T.GV) { annShadow(g, cx, cy, 8, 3); annPoly(g, '#a8a498', [[cx - 6, cy], [cx + 6, cy], [cx + 6, cy - 16], [cx, cy - 21], [cx - 6, cy - 16]]); annPoly(g, '#86827a', [[cx + 1, cy], [cx + 6, cy], [cx + 6, cy - 16], [cx + 1, cy - 20]]); g.fillStyle = '#5a564e'; g.fillRect(cx - 3, cy - 14, 5, 1); g.fillRect(cx - 1, cy - 17, 1, 6); return; }
  if (t === T.CP) { for (let i = 0; i < 5; i++) { const ox = -16 + i * 8, oy = -2 + (i % 2) * 2; g.fillStyle = h % 3 ? '#6a9a3a' : '#9ab040'; g.fillRect(cx + ox, cy + oy - 8, 2, 8); g.fillRect(cx + ox - 2, cy + oy - 6, 6, 2); } }
}
