<script>
/* Shardfall human rig (HUMAN_RIG) v2.1.0-shardfall — the articulated classic-human body with layered equipment, ported from
   asset-packs/classic-humans-v2 and asset-packs/layered-armor-v1 (procedural prototypes, not final painted art).
   Contract: 112×100 cells, ground anchor (56,86), directions S SW W NW N NE E SE, 29 animations, male and female bodies.
   Every equipment piece is drawn on the body segment it covers, in depth order, every frame; nothing is pasted over a finished
   sprite and nothing recolours the whole character. Colours, occlusion and weapon channels come from SF.GEAR (live EQ.matColor),
   not from the packs' palette snapshots. Pure: builds draw lists (and SVG for previews); src/gear-render.js paints and caches them.
   Changes from the packs: real item materials and stud metal; blade/head and handle/shaft colours from the weapon's own metal
   and wood; a two-handed weapon hides the off hand in every animation (not only attacks); helmet hair/face rules from
   SF.GEAR.HEAD_COVER; Character Creation v2 skin, hair, beard and clothing colours. */
(function (root) {
'use strict';
const DIRECTIONS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'], CELL = { width: 112, height: 100, anchorX: 56, anchorY: 86 };
const ANIMATIONS = { idle: 4, walk: 8, run: 8, ready: 4, unarmed: 8, slash1h: 8, slash2h: 8, chop1h: 8, chop2h: 8, blunt1h: 8, blunt2h: 8, thrust1h: 8, thrust2h: 8, polearm: 8, staff: 8,
  bow: 8, crossbow: 8, cast1h: 8, cast2h: 8, caststaff: 8, block: 6, hit: 4, death: 8, corpse: 1, mine: 8, chopwood: 8, smith: 8, bandage: 8, fish: 8 };
const TWO_HAND_ANIMS = ['slash2h', 'chop2h', 'blunt2h', 'thrust2h', 'polearm', 'staff', 'mine', 'chopwood', 'caststaff'];
// Character Creation v2 hair and beard styles → the rig's shapes
const STYLE = { short: 'short', long: 'long', ponytail: 'ponytail', pageboy: 'parted', receding: 'cropped', mohawk: 'cropped', buns: 'bun', pigtails: 'braid', bald: 'bald' };
const BEARD = { none: 'none', mustache: 'stubble', goatee: 'goatee', vandyke: 'goatee', short: 'short', long: 'full' };
const v = (x, y, z) => [x, y, z], add = (a, b) => a.map((x, i) => x + b[i]), scale = (a, k) => a.map(x => x * k), mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t),
  unit = a => scale(a, 1 / (Math.hypot(...a) || 1)), seq = (a, t) => { const u = Math.max(0, Math.min(a.length - 1, t * (a.length - 1))), i = Math.floor(u); return mix(a[i], a[Math.min(i + 1, a.length - 1)], u - i); };
const shade = (c, k) => '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(c.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join(''), dark = '#302821';

function pose(ac, t) {
  let hip = v(0, 0, 29), sh = v(0, 0, 48), head = v(0, 0, 56), feet = [v(-4, 1, 1), v(4, -1, 1)], hands = [v(-10, 1, 28), v(10, 1, 28)], el = [v(-9, 0, 38), v(9, 0, 38)], axis = v(0, 0, -1);
  const q = Math.sin(t * Math.PI), p = Math.sin(t * 2 * Math.PI);
  if (ac === 'idle') { sh[2] += .35 * p; head[2] += .35 * p; }
  else if (ac === 'walk' || ac === 'run') { const stride = ac === 'run' ? 12 : 7; feet = feet.map((f, i) => v(f[0], p * stride * (i ? 1 : -1), 1 + Math.max(0, p * (i ? 1 : -1)) * 4)); hands = hands.map((h, i) => v(h[0], p * stride * (i ? -1 : 1), 29)); sh[2] += Math.abs(p); hip[2] += Math.abs(p); head[2] += Math.abs(p); if (ac === 'run') { sh[1] = 4; head[1] = 6; el = [v(-9, -5, 40), v(9, 5, 39)]; } }
  else if (ac === 'death' || ac === 'corpse') { const f = ac === 'corpse' ? 1 : Math.min(1, t * 1.35); hip = v(0, -5 * f, 29 * (1 - f) + 3 * f); sh = v(0, -19 * f, 48 * (1 - f) + 5 * f); head = v(0, -27 * f, 56 * (1 - f) + 5 * f); hands = [v(-11, -17 * f, 28 * (1 - f) + 2 * f), v(11, -15 * f, 28 * (1 - f) + 2 * f)]; el = [v(-10, -13 * f, 38 * (1 - f) + 3 * f), v(10, -12 * f, 38 * (1 - f) + 3 * f)]; feet = [v(-4, 10 * f, 1), v(4, 8 * f, 1)]; }
  else {
    feet = [v(-5, 5, 1), v(5, -5, 1)]; let r = v(9, 8, 37), l = v(-8, 7, 35), a = v(0, .5, 1);
    if (ac === 'ready' || ac === 'block' || ac === 'hit') { l = v(-8, 8, 36); r = v(8, 7, 37); if (ac === 'block') l = v(-3, 13, 44); if (ac === 'hit') { sh[1] = -5 * q; head[1] = -7 * q; } }
    else if (ac === 'unarmed') { r = seq([v(9, 8, 38), v(8, 3, 43), v(2, 20, 43), v(8, 7, 38)], t); l = v(-7, 9, 40); }
    else if (['slash1h', 'slash2h', 'polearm', 'staff'].includes(ac)) { r = seq([v(9, 8, 37), v(13, -6, 51), v(8, 0, 49), v(-8, 19, 37), v(-12, 10, 32), v(9, 8, 37)], t); a = seq([v(0, 1, 1), v(.7, -.3, 1), v(1, 0, .4), v(-.8, 1, -.2), v(-1, .3, -.4), v(0, 1, 1)], t); }
    else if (['chop1h', 'chop2h', 'blunt1h', 'blunt2h', 'mine', 'chopwood', 'smith'].includes(ac)) { r = seq([v(9, 7, 36), v(8, -5, 54), v(5, -4, 57), v(5, 20, 29), v(7, 14, 24), v(9, 7, 36)], t); a = seq([v(0, .5, 1), v(0, -.8, 1), v(0, 0, 1), v(0, 1, -.6), v(0, 1, -.9), v(0, .5, 1)], t); }
    else if (ac.startsWith('thrust')) { r = seq([v(9, 7, 36), v(8, -3, 38), v(4, 24, 39), v(9, 7, 36)], t); a = v(0, 1, .08); sh[1] = 3 * q; head[1] = 3 * q; }
    else if (ac === 'bow' || ac === 'crossbow') { l = v(-3, 18, 42); r = v(3, 18 - 13 * q, 43); a = v(0, 1, 0); }
    else if (ac.startsWith('cast')) { r = seq([v(9, 3, 32), v(8, 9, 43), v(12, 6, 56), v(4, 19, 47), v(9, 3, 32)], t); l = ac === 'cast1h' ? v(-8, 3, 30) : seq([v(-9, 3, 32), v(-8, 9, 43), v(-12, 6, 56), v(-4, 19, 47), v(-9, 3, 32)], t); a = v(0, .2, 1); }
    else if (ac === 'bandage') { r = v(-1, 11, 34 + 4 * q); l = v(-4, 11, 36); }
    else if (ac === 'fish') { r = v(6, 10, 37 + 8 * q); a = v(0, 1, .8 + q); }
    if (TWO_HAND_ANIMS.includes(ac)) { l = add(r, scale(unit(a), -8)); l[0] -= 3; }
    hands = [l, r]; axis = unit(a); el = [mix(v(-11, 1, 39), l, .30), mix(v(11, 1, 39), r, .30)];
  }
  return { hip, sh, head, feet, hands, el, axis };
}

/* the layered-armor-v1 painter: every piece on its own segment, with family detail (plates, rings, studs, bone, scales) */
function armorPainter({ line, ell, poly, depth, front, p, w }) {
  const at = (a, x, y, z) => add(a, v(x, y, z)), between = (a, b, t) => mix(a, b, t), trim = '#49382d';
  const details = (a, b, g, width) => {
    const c = g.color, f = g.family; let s = '';
    if (f === 'plate' || f === 'helm') { for (const t of [.22, .52, .78]) { const k = between(a, b, t); s += ell(k, width * .49, 1.05, shade(c, .7)) + ell(at(k, -.35, 0, .4), width * .43, .48, shade(c, 1.35)); } }
    else if (f === 'chain' || f === 'ringmail') { for (let i = 1; i <= 5; i++) { const k = between(a, b, i / 6); for (const x of [-.9, .9]) s += ell(at(k, x, 0, 0), .78, .65, shade(c, i % 2 ? 1.32 : .58)); } }
    else if (f === 'studded') { for (let i = 1; i <= 4; i++) s += ell(between(a, b, i / 5), .67, .67, g.secColor || '#8e8f8a'); }
    else if (f === 'bone') { for (const t of [.23, .52, .8]) s += ell(between(a, b, t), width * .42, 1.35, shade(c, 1.08)); }
    else if (f === 'dragon') { for (let i = 1; i <= 4; i++) s += ell(between(a, b, i / 5), width * .38, 1.4, shade(c, i % 2 ? 1.28 : .67)); }
    else s += line(between(a, b, .12), between(a, b, .88), .65, shade(c, .65));
    return s;
  };
  const limb = (a, b, g, width) => g ? line(a, b, width, g.color) + details(a, b, g, width) : '';
  function torso(g) {
    if (!g) return ''; const c = g.color, f = g.family, top = (x, y) => at(p.sh, x, y, 0), bottom = (x, y) => at(p.hip, x, y, 0), y = front ? 4.5 : -4.5;
    const W = w + (f === 'plate' ? 1.0 : .15), D = 4.3, E = 3.9, planes = [[[top(-W, -D), top(W, -D), bottom(W * .72, -E), bottom(-W * .72, -E)], .66, v(0, -D, 0)], [[top(-W, D), top(W, D), bottom(W * .72, E), bottom(-W * .72, E)], 1, v(0, D, 0)],
      [[top(-W, -D), top(-W, D), bottom(-W * .72, E), bottom(-W * .72, -E)], 1.13, v(-W, 0, 0)], [[top(W, -D), top(W, D), bottom(W * .72, E), bottom(W * .72, -E)], .82, v(W, 0, 0)]];
    let s = planes.sort((a, b) => depth(a[2]) - depth(b[2])).map(([q, k]) => poly(q, shade(c, k))).join('');
    const a = at(p.sh, 0, y, -2), b = at(p.hip, 0, y, 1);
    if (f === 'plate') { s += poly([at(a, -W * .77, 0, -1), at(a, 0, .4, -5), at(a, W * .77, 0, -1), at(b, W * .57, 0, 4), at(b, 0, .4, 1), at(b, -W * .57, 0, 4)], shade(c, 1.16)) + line(at(a, 0, .5, -5), at(b, 0, .5, 4), .8, shade(c, 1.5)); for (let i = 0; i < 3; i++) { const k = at(b, 0, 0, i * 2); s += line(at(k, -W * .64, 0, 0), at(k, W * .64, 0, 0), .85, shade(c, .63)); } }
    else if (['ringmail', 'chain', 'studded', 'dragon', 'bone'].includes(f)) { for (let i = 0; i < 5; i++) for (let j = -2; j <= 2; j++) { const k = at(between(a, b, (i + .5) / 5), j * W / 3, 0, 0); if (f === 'bone') s += line(at(k, -.8, 0, 0), at(k, .8, 0, 0), 1.25, shade(c, 1.14)); else s += ell(k, f === 'ringmail' ? 1.05 : .75, f === 'dragon' ? 1.2 : .68, f === 'studded' ? (g.secColor || '#8e8f8a') : shade(c, (i + j) % 2 ? 1.32 : .63)); } }
    else s += line(at(a, -W * .7, 0, 0), at(b, W * .55, 0, 0), 1.05, shade(c, .62));
    return s + line(at(b, -W * .7, 0, 0), at(b, W * .7, 0, 0), 1.9, trim);
  }
  function head(g, h) {
    if (!g) return ''; const c = g.color, id = g.id, y = front ? 3.9 : -3.9; let s = '';
    if (g.family === 'cloth' || g.family === 'leather') return ell(at(h, 0, 0, 3), 5.5, 3.9, c) + line(at(h, -4, y, 2), at(h, 4, y, 2), 1.1, shade(c, .65));
    if (id === 'chain_coif') { s = ell(h, 5.75, 6.6, c); for (let z = -4; z <= 5; z += 2) for (let x = -3; x <= 3; x += 2) s += ell(at(h, x, y, z), .65, .66, shade(c, (x + z) % 4 ? 1.28 : .66)); if (front) s += ell(at(h, 0, 4, -.7), 2.65, 2.7, g.skin || '#aa7853'); return s; }
    const full = ['closed_helm', 'plate_helm', 'great_helm', 'bone_helm', 'dragon_helm'].includes(id);
    s = ell(at(h, 0, 0, 1.8), id === 'great_helm' ? 6.4 : 5.7, full ? 6.6 : 4.7, c); s += line(at(h, -4, y, 4.2), at(h, 4, y, 4.2), 1.1, shade(c, 1.38));
    if (full) { s += poly([at(h, -4.7, y, 2), at(h, 4.7, y, 2), at(h, 4.0, y, -4.6), at(h, -4.0, y, -4.6)], shade(c, .91)); if (front) { s += line(at(h, -3.4, y + .2, .6), at(h, 3.4, y + .2, .6), 1.35, dark); for (let i = -1; i <= 1; i++) s += ell(at(h, i * 1.35, y + .3, -2.4), .38, .68, dark); } }
    else if (front) { s += line(at(h, -4.7, y, 0), at(h, -4.2, y, -3), 1.8, c) + line(at(h, 4.7, y, 0), at(h, 4.2, y, -3), 1.8, c); if (id === 'norse_helm' || id === 'bascinet') s += line(at(h, 0, y, 3), at(h, 0, y, -1.7), 1.65, c); }
    if (id === 'norse_helm' || id === 'dragon_helm') s += line(at(h, 0, 0, 5), at(h, 0, 0, 7), 1.2, shade(c, 1.22));
    return s;
  }
  function shield(g, h) {
    if (!g) return ''; const c = g.color, id = g.id, y = front ? 1 : -1, q = (x, z) => at(h, x, y, z); let s;
    if (id === 'kite_shield' || id === 'heater_shield') { const pts = id === 'kite_shield' ? [q(-5, 7), q(5, 7), q(5, 1), q(0, -12), q(-5, 1)] : [q(-6, 7), q(6, 7), q(5, -3), q(0, -9), q(-5, -3)]; s = poly(pts, shade(c, .77)) + poly(pts.map(k => between(h, k, .78)), c); }
    else { const b = id === 'buckler'; s = ell(h, b ? 4.5 : 6.5, b ? 4.5 : 7, c) + ell(h, b ? 3.5 : 5.1, b ? 3.5 : 5.7, shade(c, .81)); }
    // the boss and rim are the shield's second channel (metal fittings on wood, or the face on metal)
    return s + ell(h, 1.5, 1.6, g.secColor ? shade(g.secColor, 1.2) : shade(c, 1.45));
  }
  function outer(g) { if (!g) return ''; const c = g.color, y = front ? 4.9 : -4.9; return poly([at(p.sh, -w * .75, y, -1), at(p.sh, w * .75, y, -1), at(p.hip, w * .65, y, -2), at(p.hip, -w * .65, y, -2)], c) + (g.id === 'robe' ? poly([at(p.hip, -w * .65, y, 0), at(p.hip, w * .65, y, 0), at(p.hip, w + 2, y, -21), at(p.hip, -w - 2, y, -21)], shade(c, .87)) : ''); }
  function cloak(g) { if (!g) return ''; const c = g.color, y = -5; return poly([at(p.sh, -w, y, 0), at(p.sh, w, y, 0), at(p.hip, w + 3, y - 3, -22), at(p.hip, -w - 3, y - 3, -22)], shade(c, .85)) + line(at(p.sh, -w * .6, y, 0), at(p.hip, -w * .55, y - 2, -20), 1, shade(c, 1.22)); }
  return { limb, torso, head, shield, outer, cloak };
}

/* frameOps({ gear, look colours, dir (0–7), action, frame }) → the draw list of one 112×100 cell.
   gear: an SF.GEAR.resolve() result or a corpse snapshot. o.skin, o.hair, o.beardHex, o.cloth: hex colours. */
function frameOps(o) {
  const ac = ANIMATIONS[o.action] ? o.action : 'idle', n = ANIMATIONS[ac], f = Math.max(0, Math.min(n - 1, Math.floor(o.frame || 0))), t = n > 1 ? f / (n - 1) : 1;
  // a fall straight toward or away from the viewer foreshortens into a squat upright shape, so S and N bodies fall a step diagonal
  let di = ((o.dir | 0) % 8 + 8) % 8; if ((ac === 'death' || ac === 'corpse') && di % 4 === 0) di += 1;
  const angle = di * Math.PI / 4, d = [-Math.sin(angle), Math.cos(angle)], s = [d[1], -d[0]];
  const R = o.gear || { slots: {}, occ: { offhand: true, hair: 'all', face: true } }, G = R.slots, occ = R.occ;
  const female = R.body === 'female' || o.body === 'female', w = female ? 5.8 : 7.2, p = pose(ac, t);
  const cloth = o.cloth || '#ac9776', hair = o.hair || '#65452e', skin = o.skin || '#ca9a72', style = STYLE[o.style] || 'short', beard = female ? 'none' : (BEARD[o.beard] || 'none');
  const wpn = G.weapon, wp = wpn ? ((o.weaponRig && o.weaponRig[wpn.wpn || wpn.id]) || ['', 'fist'])[1] : 'fist';
  const steel = wpn && wpn.hex.metal ? wpn.hex.metal : '#a6aeb0', edge = shade(steel, 1.32), wood = wpn && wpn.hex.wood ? wpn.hex.wood : '#775036';
  const proj = a => [CELL.anchorX + a[0] * s[0] + a[1] * d[0], CELL.anchorY - a[2] + .45 * (a[0] * s[1] + a[1] * d[1])], depth = a => .45 * (a[0] * s[1] + a[1] * d[1]), r = x => Math.round(x * 10) / 10, pt = a => proj(a).map(r).join(',');
  // a compact draw list (one op per ';'): L line (outline, fill, highlight), P polygon, E ellipse. drawOps() paints it on a canvas
  // synchronously; toSVG() turns it into SVG for previews and tests.
  const line = (a, b, wd, c) => { const [x, y] = proj(a).map(r), [X, Y] = proj(b).map(r); return 'L ' + x + ' ' + y + ' ' + X + ' ' + Y + ' ' + r(wd) + ' ' + c + ';'; };
  const poly = (ps, c) => 'P ' + ps.map(pt).join(' ') + ' ' + c + ';';
  const ell = (a, x, y, c) => { const [X, Y] = proj(a).map(r); return 'E ' + X + ' ' + Y + ' ' + r(x) + ' ' + r(y) + ' ' + c + ';'; };
  const front = d[1] >= 0, faceY = front ? 4 : -4, A = armorPainter({ line, ell, poly, depth, front, p, w });
  const shapes = [], put = (z, a) => shapes.push([z, a]);
  if (G.cloak) put(front ? -24 : 24, A.cloak(G.cloak));
  for (let i = 0; i < 2; i++) {
    const k = i ? 1 : -1, h = add(p.hip, v(k * 3.2, 0, 0)), ft = p.feet[i], knee = mix(h, ft, .53); knee[1] += 2;
    const pants = G.trousers ? G.trousers.color : shade(cloth, .53), boot = G.feet ? G.feet.color : '#49382a', sh = add(p.sh, v(k * (w + .5), 0, -1)), el = p.el[i], hand = p.hands[i];
    put(-12 + depth(h), line(h, knee, female ? 5 : 5.8, pants) + line(knee, add(ft, v(0, 0, 4)), 4.8, shade(pants, .88)) + line(add(ft, v(0, 0, 4)), ft, 4.7, boot) + line(ft, add(ft, v(0, 3, 0)), 5, boot)
      + A.limb(h, knee, G.legs, 6.5) + A.limb(knee, add(ft, v(0, 0, 4)), G.legs, 5.6) + (G.feet ? A.limb(add(ft, v(0, 0, 5)), ft, G.feet, 5.4) + line(ft, add(ft, v(0, 3, 0)), 5.4, G.feet.color) : ''));
    put(depth(sh) * 1.5 + depth(hand) * .6 + (k * s[1] > .05 ? 2 : -2), line(sh, el, 4.7, G.shirt ? G.shirt.color : shade(cloth, .91)) + line(el, hand, 3.8, skin) + ell(hand, 2, 2.2, skin)
      + A.limb(sh, el, G.arms, 6.0) + A.limb(el, mix(el, hand, .85), G.arms, 5.1) + (G.hands ? A.limb(mix(el, hand, .77), hand, G.hands, 4.7) + ell(hand, 2.2, 2.35, G.hands.color) : '')
      + (G.bracelet ? ell(mix(el, hand, .75), 2.2, .7, G.bracelet.color) : '') + (G.ring ? ell(hand, .75, .75, G.ring.color) : ''));
  }
  const top = (x, y) => add(p.sh, v(x, y, 0)), bottom = (x, y) => add(p.hip, v(x, y, 0));
  const TD = 3.8, BD = 3.4;   // torso depth at the shoulders and hips (the packs used 2.8/2.5, which reads paper-thin from the side)
  const planes = [[[top(-w, -TD), top(w, -TD), bottom(w * .72, -BD), bottom(-w * .72, -BD)], .74, v(0, -TD, 0)], [[top(-w, TD), top(w, TD), bottom(w * .72, BD), bottom(-w * .72, BD)], 1, v(0, TD, 0)],
    [[top(-w, -TD), top(-w, TD), bottom(-w * .72, BD), bottom(-w * .72, -BD)], 1.14, v(-w, 0, 0)], [[top(w, -TD), top(w, TD), bottom(w * .72, BD), bottom(w * .72, -BD)], .83, v(w, 0, 0)]];
  const shirt = G.shirt ? G.shirt.color : cloth;
  let tor = planes.sort((a, b) => depth(a[2]) - depth(b[2])).map(([ps, k]) => poly(ps, shade(shirt, k))).join('');
  tor += line(add(p.hip, v(-w * .7, faceY, 2)), add(p.hip, v(w * .7, faceY, 2)), 2.3, '#60442d');
  if (front) tor += line(add(p.sh, v(-2, 3, -1)), add(p.sh, v(0, 3, -7)), 1, shade(shirt, .57)) + line(add(p.sh, v(2, 3, -1)), add(p.sh, v(0, 3, -7)), 1, shade(shirt, 1.23));
  tor += A.torso(G.chest) + A.outer(G.robe) + A.outer(G.tunic);
  if (G.neck) tor += line(add(p.sh, v(-w * .5, faceY, 0)), add(p.sh, v(w * .5, faceY, 0)), 3.1, G.neck.color);
  if (G.necklace && front) tor += line(add(p.sh, v(-2, 3, -1)), add(p.sh, v(0, 3, -5)), .8, G.necklace.color) + line(add(p.sh, v(2, 3, -1)), add(p.sh, v(0, 3, -5)), .8, G.necklace.color);
  if (G.belt) tor += line(add(p.hip, v(-w * .7, faceY, 2)), add(p.hip, v(w * .7, faceY, 2)), 2.3, G.belt.color) + (front ? ell(add(p.hip, v(0, faceY, 2)), 1.2, 1, G.belt.secColor || '#b19b69') : '');
  put(.3, tor);
  // head: hair shows fully, trimmed (no long hair, braids or buns) under open helms and caps, or not at all under coifs and closed helms
  const h = p.head; let ha = line(add(h, v(0, 0, -7)), add(h, v(0, 0, -3)), 3.8, skin) + ell(h, female ? 4.7 : 5.1, 6.1, skin);
  if (style !== 'bald' && occ.hair !== 'none') {
    const full = occ.hair === 'all';
    if (full && ['long', 'braid', 'ponytail'].includes(style)) ha = ell(add(h, v(0, -2, -4)), 4.5, 8, hair) + ha;
    if (full && ['bun', 'ponytail'].includes(style)) ha = ell(add(h, v(0, -4, 1)), 2.8, 3.2, hair) + ha;
    ha += ell(add(h, v(0, -.8, 2.8)), 5, style === 'cropped' ? 2 : 3.3, hair) + line(add(h, v(-3, -.5, 3)), add(h, v(2, -.5, 4.6)), .9, shade(hair, 1.35));
    if (!front) ha += ell(add(h, v(0, -1, -.8)), 4.7, 4.6, hair);
    if (full && style === 'parted' && front) ha += line(add(h, v(-2, 2, 4)), add(h, v(0, 2, 1)), 1.6, hair);
    if (full && style === 'braid') ha += line(add(h, v(2, -3, -1)), add(h, v(2, -4, -12)), 2.6, hair);
  }
  if (front && occ.face !== false) { ha += ell(add(h, v(-1.6, 3, .1)), .5, .5, dark) + ell(add(h, v(1.6, 3, .1)), .5, .5, dark) + line(add(h, v(0, 3, -1)), add(h, v(0, 4, -2)), .8, shade(skin, 1.15)); if (beard !== 'none') ha += ell(add(h, v(0, 3, -3)), beard === 'goatee' ? 1.5 : 3.1, beard === 'full' ? 3 : 1.6, o.beardHex || shade(hair, .82)); }
  if (G.head) ha += A.head(Object.assign({}, G.head, { skin }), h);
  put(30 + depth(h), ha);
  // weapon: blade/head in the weapon's metal, grip/shaft in its wood (independent channels)
  if (wp !== 'fist' && !['death', 'corpse', 'bandage'].includes(ac)) {
    const g = ac === 'bow' ? p.hands[0] : p.hands[1], a = unit(p.axis), atw = k => add(g, scale(a, k)), c = unit(v(-a[2], .1, a[0] || .3)); let art = '';
    if (['bow', 'longbow'].includes(wp)) { const L = wp === 'longbow' ? 18 : 14, tp = add(g, v(0, -2, L)), bt = add(g, v(0, -2, -L)), md = add(g, v(0, 3, 0)), draw = ac === 'bow' ? p.hands[1] : g; art = line(tp, md, 1.7, wood) + line(md, bt, 1.7, wood) + line(tp, draw, .65, '#d1c5a5') + line(draw, bt, .65, '#d1c5a5'); if (ac === 'bow' && t < .65) art += line(draw, add(g, v(0, 12, 0)), .8, edge); }
    else if (['crossbow', 'heavycrossbow'].includes(wp)) { const L = wp === 'heavycrossbow' ? 12 : 8; art = line(atw(-6), atw(13), 3.2, wood) + line(add(atw(7), v(-L, 0, 0)), atw(10), 1.9, steel) + line(atw(10), add(atw(7), v(L, 0, 0)), 1.9, steel) + line(add(atw(7), v(-L, 0, 0)), atw(0), .7, '#d1c5a5') + line(atw(0), add(atw(7), v(L, 0, 0)), .7, '#d1c5a5'); }
    else if (['dagger', 'kryss', 'sword', 'broadsword', 'katana', 'rapier', 'greatsword'].includes(wp)) { const L = { dagger: 9, kryss: 15, sword: 20, broadsword: 21, katana: 23, rapier: 22, greatsword: 29 }[wp], b = wp === 'rapier' ? 1 : wp === 'broadsword' ? 2.5 : 1.7; art = line(atw(-5), atw(3), 2.1, wood) + line(add(atw(3), scale(c, -4)), add(atw(3), scale(c, 4)), 1.7, steel) + poly([add(atw(4), scale(c, -b)), atw(L), add(atw(4), scale(c, b))], steel) + line(atw(5), atw(L - 1), .7, edge); }
    else {
      const L = { axe: 17, battleaxe: 24, doubleaxe: 24, mace: 16, warhammer: 24, maul: 24, club: 18, spear: 33, shortspear: 23, halberd: 31, bardiche: 30, staff: 30, quarterstaff: 28, wand: 13, pickaxe: 20, hatchet: 15, smithhammer: 13, fishingpole: 36 }[wp] || 18;
      art = line(atw(-Math.min(12, L * .38)), atw(L), wp === 'wand' ? 1.3 : 2.2, wood);
      if (['axe', 'battleaxe', 'doubleaxe', 'halberd', 'bardiche', 'hatchet', 'pickaxe'].includes(wp)) { const tip = atw(L - 2), wing = wp === 'pickaxe' ? 8 : ['battleaxe', 'doubleaxe'].includes(wp) ? 7 : 5; art += poly([atw(L - 7), add(tip, scale(c, wing)), add(atw(L + 1), scale(c, wing)), atw(L + 1)], steel); if (['doubleaxe', 'pickaxe'].includes(wp)) art += poly([atw(L - 7), add(tip, scale(c, -wing)), add(atw(L + 1), scale(c, -wing)), atw(L + 1)], steel); }
      if (['spear', 'shortspear', 'halberd', 'bardiche'].includes(wp)) art += poly([add(atw(L - 6), scale(c, -2.3)), atw(L + 4), add(atw(L - 6), scale(c, 2.3))], edge);
      if (['mace', 'club', 'maul', 'warhammer', 'smithhammer'].includes(wp)) art += line(add(atw(L - 2), scale(c, -3.3)), add(atw(L - 2), scale(c, 3.3)), wp === 'maul' ? 6 : 4.7, wp === 'club' ? wood : steel);
      if (['staff', 'wand'].includes(wp)) art += ell(atw(L), 1.8, 2.1, '#b9a16c');
    }
    put(depth(g) + 7, art);
  }
  // off hand: never with a two-handed weapon (any state), and not in two-handed or ranged poses
  if (G.shield && occ.offhand !== false && !['death', 'corpse', 'bow', 'crossbow', 'bandage'].concat(TWO_HAND_ANIMS).includes(ac)) { const g = p.hands[0]; put(depth(g) + 8, A.shield(G.shield, g)); }
  if (ac === 'bandage') put(20, ell(p.hands[0], 2.7, 2.1, '#d8cbb1'));
  return shapes.sort((a, b) => a[0] - b[0]).map(x => x[1]).join('');
}
/* paint a draw list at (ox, oy) on a 2D context */
function drawOps(g, ops, ox, oy) {
  g.save(); g.translate(ox || 0, oy || 0); g.lineCap = 'round'; g.lineJoin = 'round';
  for (const op of ops.split(';')) {
    if (!op) continue; const t = op.split(' '), k = t[0], c = t[t.length - 1];
    if (k === 'L') { const x = +t[1], y = +t[2], X = +t[3], Y = +t[4], wd = +t[5];
      g.beginPath(); g.moveTo(x, y); g.lineTo(X, Y); g.strokeStyle = dark; g.lineWidth = wd + 1.5; g.stroke(); g.strokeStyle = c; g.lineWidth = wd; g.stroke();
      g.beginPath(); g.moveTo(x - .45, y - .45); g.lineTo(X - .45, Y - .45); g.strokeStyle = shade(c, 1.22); g.lineWidth = Math.max(.5, wd * .23); g.stroke(); }
    else if (k === 'E') { g.beginPath(); g.ellipse(+t[1], +t[2], +t[3], +t[4], 0, 0, Math.PI * 2); g.fillStyle = c; g.fill(); g.strokeStyle = dark; g.lineWidth = .7; g.stroke(); }
    else if (k === 'P') { g.beginPath(); for (let i = 1; i < t.length - 1; i++) { const [x, y] = t[i].split(',').map(Number); i === 1 ? g.moveTo(x, y) : g.lineTo(x, y); } g.closePath(); g.fillStyle = c; g.fill(); g.strokeStyle = dark; g.lineWidth = .8; g.stroke(); }
  }
  g.restore();
}
function toSVG(ops, w, h) {
  let s = '';
  for (const op of ops.split(';')) {
    if (!op) continue; const t = op.split(' '), k = t[0], c = t[t.length - 1];
    if (k === 'L') { const a = '<line x1="' + t[1] + '" y1="' + t[2] + '" x2="' + t[3] + '" y2="' + t[4] + '" stroke-linecap="round" stroke="'; s += a + dark + '" stroke-width="' + (+t[5] + 1.5) + '"/>' + a + c + '" stroke-width="' + t[5] + '"/>' + a + shade(c, 1.22) + '" stroke-width="' + Math.max(.5, t[5] * .23) + '" transform="translate(-.45 -.45)"/>'; }
    else if (k === 'E') s += '<ellipse cx="' + t[1] + '" cy="' + t[2] + '" rx="' + t[3] + '" ry="' + t[4] + '" fill="' + c + '" stroke="' + dark + '" stroke-width=".7"/>';
    else if (k === 'P') s += '<polygon points="' + t.slice(1, -1).join(' ') + '" fill="' + c + '" stroke="' + dark + '" stroke-width=".8" stroke-linejoin="round"/>';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + (w || CELL.width) + '" height="' + (h || CELL.height) + '">' + s + '</svg>';
}
const RIG = { VERSION: '2.1.0-shardfall', DIRECTIONS, CELL, ANIMATIONS, STYLE, BEARD, frameOps, drawOps, toSVG, pose };
root.HUMAN_RIG = RIG;
if (typeof module !== 'undefined' && module.exports) module.exports = RIG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
</script>
