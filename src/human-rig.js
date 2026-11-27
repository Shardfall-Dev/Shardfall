<script>
/* Shardfall classic human rig (SFRIG) — the articulated procedural human, v2.1.
   Ported from asset-packs/classic-humans-v2/classic-human-rig-v2.mjs (v2.0, provisional art; the pack itself is unchanged) and extended:
   armor layers (leather, studded, bone, ringmail, chain, plate, dragon), robes, aprons, tabards, cloaks, hoods, helmets, shields,
   gloves and boots in material colours; a separate, recognisable motion for every weapon family (slash 1h/2h, chop 1h/2h, blunt 1h/2h,
   thrust 1h/2h, polearm, staff, bow, crossbow, heavy crossbow, wrestling, shield block), three casting gestures, gathering and crafting;
   carry and ready poses so long weapons are held upright and bows sit in the off hand.
   THIS IS A FUNCTIONAL PROTOTYPE, NOT FINAL PAINTED ART. It fixes the animation, layer and anchor contracts the painted atlases replace.
   Pure: builds SVG strings only (no DOM), so node tests can check frame bounds. Input is a figure from SF.LOOK.figure(). */
(function (root) {
'use strict';
const DIRECTIONS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];          // = the game's sect order (rows S,SW,W,NW,N,NE,E,SE)
const CELL = { width: 144, height: 144, anchorX: 72, anchorY: 112 };      // ground anchor: the point between the feet. v2.0 used 112×100 (56,86),
                                                                          // which clipped overhead polearms and fallen bodies; same scale, more margin
const ANIMATIONS = { idle: 4, walk: 8, run: 8, ready: 4, unarmed: 8, slash1h: 8, slash2h: 8, chop1h: 8, chop2h: 8, blunt1h: 8, blunt2h: 8, thrust1h: 8, thrust2h: 8,
  polearm: 8, staff: 8, bow: 8, crossbow: 8, hcrossbow: 8, cast1h: 8, cast2h: 8, caststaff: 8, block: 6, hit: 4, death: 8, corpse: 1, mine: 8, chopwood: 8, smith: 8, craft: 8, bandage: 8, fish: 8 };
const LOOPED = ['idle', 'walk', 'run', 'ready', 'block', 'mine', 'chopwood', 'smith', 'craft', 'bandage', 'fish'];
const FPS = { idle: 3, walk: 10, run: 14, ready: 3, block: 6, mine: 7, chopwood: 7, smith: 9, craft: 6, bandage: 6, fish: 4 };
const TWO_HAND = ['slash2h', 'chop2h', 'blunt2h', 'thrust2h', 'polearm', 'staff', 'mine', 'chopwood', 'crossbow', 'hcrossbow'];
const LONG = ['halberd', 'spear', 'staff', 'quarterstaff', 'bardiche', 'shortspear', 'fishingpole'];
const SHOULDERED = ['battleaxe', 'doubleaxe', 'warhammer', 'maul', 'greatsword'];
const BOWS = ['bow', 'longbow'], XBOWS = ['crossbow', 'heavycrossbow'];
const v = (x, y, z) => [x, y, z], add = (a, b) => a.map((x, i) => x + b[i]), scale = (a, k) => a.map(x => x * k), mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t),
  unit = a => scale(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1)),
  seq = (a, t) => { const u = Math.max(0, Math.min(a.length - 1, t * (a.length - 1))), i = Math.floor(u); const A = a[i], B = a[Math.min(i + 1, a.length - 1)]; return typeof A === 'number' ? A + (B - A) * (u - i) : mix(A, B, u - i); };
const shade = (c, k) => '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(c.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('');
const dark = '#2c241d', steel = '#a6aeb0', edge = '#e0e0d3', wood = '#775036';

/* ---------- motion: keyframed attacks (6 keys: rest, wind-up, peak, CONTACT (t≈.6), follow-through, rest) ----------
   r: weapon hand; a: weapon axis from the grip; l: off hand (null = two-handed grip on the shaft or a guard pose);
   step: lead-foot lunge; crouch: body height; twist: shoulders forward/back. Coordinates: x right, y forward, z up. */
const K = {
  unarmed:  { r: [v(9, 8, 38), v(9, 2, 42), v(8, 0, 43), v(2, 21, 44), v(6, 12, 41), v(9, 8, 38)], a: [v(0, 1, .2)], l: [v(-6, 10, 42)], step: [0, 0, 0, 4, 3, 0], twist: [0, -2, -3, 5, 3, 0] },
  slash1h:  { r: [v(9, 8, 37), v(14, -4, 48), v(12, -2, 52), v(-2, 20, 42), v(-11, 10, 33), v(9, 8, 37)], a: [v(0, 1, 1), v(.6, -.6, .8), v(.9, -.2, .6), v(-.7, 1, 0), v(-1, .2, -.4), v(0, 1, 1)], l: [v(-8, 6, 34)], step: [0, 0, 0, 3, 3, 0], twist: [0, -3, -4, 4, 3, 0] },
  slash2h:  { r: [v(6, 8, 38), v(8, -6, 60), v(6, -8, 62), v(2, 18, 40), v(-6, 14, 22), v(6, 8, 38)], a: [v(0, .5, 1), v(.3, -.8, .6), v(.2, -1, .3), v(0, 1, -.2), v(-.4, .6, -1), v(0, .5, 1)], step: [0, 0, -1, 6, 6, 0], crouch: [0, 1, 1, -3, -4, 0], twist: [0, -4, -5, 5, 4, 0] },
  chop1h:   { r: [v(9, 7, 36), v(9, -4, 55), v(8, -6, 58), v(6, 18, 32), v(7, 13, 24), v(9, 7, 36)], a: [v(0, .5, 1), v(0, -.8, 1), v(0, -1, .4), v(0, 1, -.5), v(0, .8, -1), v(0, .5, 1)], l: [v(-8, 7, 35)], step: [0, 0, 0, 3, 3, 0], twist: [0, -2, -3, 3, 2, 0] },
  chop2h:   { r: [v(5, 7, 36), v(4, -6, 60), v(3, -9, 62), v(2, 20, 24), v(2, 16, 16), v(5, 7, 36)], a: [v(0, .5, 1), v(0, -.7, 1), v(0, -1, .2), v(0, 1, -.7), v(0, .6, -1), v(0, .5, 1)], step: [0, 0, -2, 6, 6, 0], crouch: [0, 1, 1, -4, -5, 0] },
  blunt1h:  { r: [v(9, 7, 38), v(12, 0, 52), v(12, -2, 54), v(7, 15, 38), v(8, 11, 34), v(9, 7, 38)], a: [v(0, .6, 1), v(.3, -.5, 1), v(.4, -.8, .6), v(0, 1, -.3), v(0, .9, -.6), v(0, .6, 1)], l: [v(-8, 8, 36)], step: [0, 0, 0, 2, 2, 0], twist: [0, -1, -2, 2, 1, 0] },
  blunt2h:  { r: [v(5, 7, 36), v(12, -6, 56), v(13, -8, 58), v(2, 20, 18), v(2, 18, 14), v(5, 7, 36)], a: [v(0, .5, 1), v(.5, -.6, 1), v(.6, -.8, .6), v(0, .9, -1), v(0, .7, -1), v(0, .5, 1)], step: [0, 0, 0, 5, 5, 0], crouch: [0, 1, 1, -6, -6, 0], twist: [0, -3, -4, 3, 3, 0] },
  thrust1h: { r: [v(9, 7, 36), v(9, -3, 38), v(8, -5, 39), v(4, 25, 40), v(6, 16, 38), v(9, 7, 36)], a: [v(0, 1, .08)], l: [v(-8, 4, 38)], step: [0, -1, -2, 7, 5, 0], twist: [0, -2, -3, 4, 2, 0] },
  thrust2h: { r: [v(6, 4, 34), v(7, -6, 34), v(7, -8, 34), v(2, 26, 40), v(3, 18, 38), v(6, 4, 34)], a: [v(0, 1, .15)], step: [0, -1, -2, 8, 6, 0], crouch: [0, 0, -1, -2, -1, 0], twist: [0, -2, -3, 4, 2, 0] },
  polearm:  { r: [v(8, 6, 40), v(12, -6, 58), v(10, -8, 60), v(-4, 22, 38), v(-10, 14, 28), v(8, 6, 40)], a: [v(0, .3, 1), v(.5, -.5, 1), v(.4, -.9, .4), v(-.6, 1, -.3), v(-.9, .4, -.6), v(0, .3, 1)], step: [0, 0, -1, 6, 6, 0], crouch: [0, 1, 1, -3, -3, 0], twist: [0, -3, -4, 4, 3, 0] },
  staff:    { r: [v(8, 6, 38), v(12, -2, 44), v(13, -4, 46), v(-6, 18, 40), v(-12, 10, 36), v(8, 6, 38)], a: [v(0, .4, 1), v(.8, -.4, .3), v(.9, -.4, .1), v(-.8, .8, .1), v(-1, .2, .2), v(0, .4, 1)], step: [0, 0, 0, 4, 3, 0], twist: [0, -3, -3, 3, 2, 0] },
  bow:      { r: [v(-1, 17, 44), v(1, 10, 45), v(3, 3, 45), v(3, 2, 45), v(6, -1, 46), v(6, 4, 40)], a: [v(0, 0, 1)], l: [v(-3, 19, 44)], twist: [0, 0, -1, -1, 0, 0] },
  crossbow: { r: [v(3, 10, 45), v(3, 10, 45), v(3, 10, 45), v(3, 7, 46), v(3, 8, 45), v(3, 10, 45)], a: [v(0, 1, .05), v(0, 1, .05), v(0, 1, .05), v(0, 1, .4), v(0, 1, .2), v(0, 1, .05)], twist: [0, 0, 0, -2, -1, 0] },
  hcrossbow: { r: [v(4, 9, 40), v(4, 9, 40), v(4, 9, 40), v(4, 4, 42), v(4, 6, 41), v(4, 9, 40)], a: [v(0, 1, .02), v(0, 1, .02), v(0, 1, .02), v(0, 1, .55), v(0, 1, .3), v(0, 1, .02)], step: [0, 0, 0, -3, -2, 0], crouch: [-2, -2, -2, -1, -2, -2], wide: 1 },
  cast1h:   { r: [v(9, 3, 32), v(8, 9, 43), v(12, 6, 56), v(4, 19, 47), v(9, 3, 32)], a: [v(0, .2, 1)], l: [v(-8, 3, 30)] },
  cast2h:   { r: [v(9, 3, 32), v(8, 9, 43), v(12, 6, 56), v(4, 19, 47), v(9, 3, 32)], a: [v(0, .2, 1)], l: [v(-9, 3, 32), v(-8, 9, 43), v(-12, 6, 56), v(-4, 19, 47), v(-9, 3, 32)], twist: [0, 0, -1, 2, 0] },
  caststaff: { r: [v(9, 3, 34), v(9, 6, 40), v(10, 4, 50), v(6, 16, 46), v(9, 3, 34)], a: [v(0, .2, 1), v(0, .1, 1), v(0, 0, 1), v(0, 1, .6), v(0, .2, 1)], l: [v(-9, 3, 32), v(-9, 8, 42), v(-10, 6, 52), v(-4, 18, 46), v(-9, 3, 32)] },
  mine:     { r: [v(5, 6, 36), v(5, -2, 58), v(4, -4, 60), v(3, 20, 12), v(3, 18, 10), v(5, 6, 36)], a: [v(0, .5, 1), v(0, -.7, 1), v(0, -1, .3), v(0, 1, -.8), v(0, .8, -1), v(0, .5, 1)], crouch: [-1, 0, 0, -6, -6, -1] },
  chopwood: { r: [v(10, 4, 34), v(14, -6, 44), v(14, -8, 45), v(0, 18, 34), v(-4, 16, 32), v(10, 4, 34)], a: [v(0, .3, 1), v(.8, -.6, .2), v(.9, -.5, .1), v(-.6, 1, 0), v(-.8, .8, 0), v(0, .3, 1)], twist: [0, -3, -4, 3, 3, 0] },
  smith:    { r: [v(9, 8, 34), v(9, 4, 48), v(9, 3, 50), v(7, 14, 28), v(7, 13, 28), v(9, 8, 34)], a: [v(0, .5, 1), v(0, -.6, 1), v(0, -.7, .8), v(0, 1, -.4), v(0, 1, -.4), v(0, .5, 1)], l: [v(-5, 12, 28)], crouch: [0, 0, 0, -1, -1, 0] } };
function pose(ac, t, f) {
  let hip = v(0, 0, 29), sh = v(0, 0, 48), head = v(0, 0, 56), feet = [v(-4, 1, 1), v(4, -1, 1)], hands = [v(-10, 1, 28), v(10, 1, 28)], el, axis = v(0, .7, -.6);
  const q = Math.sin(t * Math.PI), p = Math.sin(t * 2 * Math.PI), wp = f.weapon, bow = BOWS.includes(wp), xbow = XBOWS.includes(wp), long = LONG.includes(wp), shoul = SHOULDERED.includes(wp);
  let l = hands[0], r = hands[1], twoGrip = false, offGrip = false;
  const carry = (ready) => {   // where the weapon rides when the body is not attacking: idle, walking, running, ready
    if (!wp || wp === 'fist') return;
    if (bow) { l = ready ? v(-4, 13, 38) : add(l, v(1, 2, 2)); axis = v(0, ready ? .2 : 0, 1); return; }
    if (xbow) { r = ready ? v(3, 10, 44) : v(8, 6, 32); axis = v(0, 1, ready ? .05 : .1); l = add(r, scale(unit(axis), 8)); l[0] -= 4; offGrip = true; return; }
    if (long) { r = ready ? v(7, 7, 36) : add(r, v(-1, 2, 3)); axis = ready ? v(0, .6, 1) : v(0, .12, 1); if (ready) twoGrip = true; return; }
    if (shoul) { r = ready ? v(6, 8, 38) : v(8, 2, 40); axis = ready ? v(0, .5, 1) : v(0, -.6, .8); if (ready) twoGrip = true; return; }
    if (ready) { r = v(9, 8, 37); axis = v(0, .5, 1); } else axis = v(0, .7, -.6);
  };
  if (ac === 'idle') { sh[2] += .35 * p; head[2] += .35 * p; carry(false); }
  else if (ac === 'walk' || ac === 'run') {
    const stride = ac === 'run' ? 12 : 7;
    feet = feet.map((ft, i) => v(ft[0], p * stride * (i ? 1 : -1), 1 + Math.max(0, p * (i ? 1 : -1)) * 4));
    hands = hands.map((h, i) => v(h[0], p * stride * (i ? -1 : 1) * .8, 29)); l = hands[0]; r = hands[1];
    const bob = Math.abs(p); sh[2] += bob; hip[2] += bob; head[2] += bob;
    if (ac === 'run') { sh[1] = 4; head[1] = 6; hip[1] = 1; }
    carry(false);
  }
  else if (ac === 'death' || ac === 'corpse') {
    const k = ac === 'corpse' ? 1 : Math.min(1, t * 1.35);
    hip = v(0, -5 * k, 29 * (1 - k) + 3 * k); sh = v(0, -19 * k, 48 * (1 - k) + 5 * k); head = v(0, -27 * k, 56 * (1 - k) + 5 * k);
    l = v(-11, -17 * k, 28 * (1 - k) + 2 * k); r = v(11, -15 * k, 28 * (1 - k) + 2 * k); feet = [v(-4, 10 * k, 1), v(4, 8 * k, 1)];
    return { hip, sh, head, feet, hands: [l, r], el: [mix(v(-10, -13 * k, 38 * (1 - k) + 3 * k), l, .3), mix(v(10, -12 * k, 38 * (1 - k) + 3 * k), r, .3)], axis: v(0, 1, 0), twoGrip: false, down: k };
  }
  else {
    feet = [v(-5, 5, 1), v(5, -5, 1)]; l = v(-8, 7, 35); r = v(9, 8, 37);
    const k = K[ac];
    if (ac === 'ready' || ac === 'block' || ac === 'hit') {
      carry(true); if (!wp || wp === 'fist') { r = v(8, 9, 40); l = v(-7, 9, 41); }
      if (ac === 'ready') { sh[2] += .3 * p; head[2] += .3 * p; }
      if (ac === 'block') { l = v(-3, 13 + q, 44 + 2 * q); sh[2] -= 1 + q; head[2] -= 1 + q; hip[2] -= 1 + .5 * q; sh[1] -= q; }
      if (ac === 'hit') { sh[1] = -5 * q; head[1] = -7 * q; hip[1] = -2 * q; }
    }
    else if (k) {
      r = seq(k.r, t); axis = seq(k.a, t); if (k.l) l = seq(k.l, t);
      const st = k.step ? seq(k.step, t) : 0, cr = k.crouch ? seq(k.crouch, t) : 0, tw = k.twist ? seq(k.twist, t) : 0;
      feet[0] = add(feet[0], v(0, st, 0)); if (k.wide) feet = [v(-7, 4 + st, 1), v(7, -6 + st, 1)];
      hip[2] += cr; sh[2] += cr; head[2] += cr; sh[1] += tw; head[1] += tw * 1.2;
      if (TWO_HAND.includes(ac) || ((ac === 'slash1h' || ac === 'chop1h' || ac === 'blunt1h' || ac === 'thrust1h') && SHOULDERED.concat(LONG).includes(wp))) twoGrip = true;
      if (ac === 'crossbow' || ac === 'hcrossbow') { l = add(r, scale(unit(axis), 8)); l[0] -= 4; offGrip = true; twoGrip = false; }
    }
    else if (ac === 'bandage') { r = v(-1, 11, 34 + 4 * q); l = v(-4, 11, 36); }
    else if (ac === 'craft') { r = v(3, 11, 31 + 2 * p); l = v(-3, 11, 31 - 2 * p); sh[1] = 1.5; head[1] = 2.5; }
    else if (ac === 'fish') { r = v(6, 10, 37 + 8 * q); axis = v(0, 1, .8 + q); }
  }
  if (twoGrip) { l = add(r, scale(unit(axis), -8)); l[0] -= 3; }
  el = [mix(v(-11, 1, 39), l, .30), mix(v(11, 1, 39), r, .30)];
  return { hip, sh, head, feet, hands: [l, r], el, axis: unit(axis), twoGrip, offGrip, down: 0 };
}

/* ---------- one frame ---------- */
function frameSVG(f, o) {
  o = o || {}; const ac = ANIMATIONS[o.action] ? o.action : 'idle', n = ANIMATIONS[ac], fr = Math.max(0, Math.min(n - 1, Math.floor(o.frame || 0)));
  const t = o.t != null ? Math.max(0, Math.min(1, o.t)) : LOOPED.includes(ac) ? fr / n : n > 1 ? fr / (n - 1) : 1;
  const di = DIRECTIONS.includes(o.direction) ? DIRECTIONS.indexOf(o.direction) : typeof o.direction === 'number' ? ((o.direction % 8) + 8) % 8 : 0;
  const angle = di * Math.PI / 4, d = [-Math.sin(angle), Math.cos(angle)], s = [d[1], -d[0]];
  const fig = Object.assign({}, f); if (o.weapon !== undefined) fig.weapon = o.weapon;
  if (['bandage', 'craft'].includes(ac)) fig.weapon = null;
  const female = fig.body === 'female', w = female ? 5.8 : 7.2, hipW = female ? .86 : .72, p = pose(ac, t, fig), front = d[1] >= 0;
  const cloth = fig.cloth || '#ac9776', skin = fig.skin || '#ca9a72', hair = fig.hair || '#65452e', style = fig.style || 'short';
  const proj = a => [CELL.anchorX + a[0] * s[0] + a[1] * d[0], CELL.anchorY - a[2] + .45 * (a[0] * s[1] + a[1] * d[1])], depth = a => .45 * (a[0] * s[1] + a[1] * d[1]);
  const r1 = x => Math.round(x * 10) / 10, pt = a => proj(a).map(r1).join(',');
  const raw = (a, b, wd, c, x) => { const [X1, Y1] = proj(a).map(r1), [X2, Y2] = proj(b).map(r1); return '<line x1="' + X1 + '" y1="' + Y1 + '" x2="' + X2 + '" y2="' + Y2 + '" stroke-linecap="round" stroke="' + c + '" stroke-width="' + wd + '"' + (x || '') + '/>'; };
  const line = (a, b, wd, c) => raw(a, b, wd + 1.5, dark) + raw(a, b, wd, c) + raw(a, b, Math.max(.5, wd * .23), shade(c, 1.22), ' transform="translate(-.45 -.45)"');
  const poly = (ps, c, sw) => '<polygon points="' + ps.map(pt).join(' ') + '" fill="' + c + '" stroke="' + dark + '" stroke-width="' + (sw || .8) + '" stroke-linejoin="round"/>';
  const ell = (a, rx, ry, c, sw) => { const [X, Y] = proj(a).map(r1); return '<ellipse cx="' + X + '" cy="' + Y + '" rx="' + rx + '" ry="' + ry + '" fill="' + c + '" stroke="' + dark + '" stroke-width="' + (sw == null ? .7 : sw) + '"/>'; };
  const shapes = [], put = (z, a) => { if (a) shapes.push([z, a]); };
  const ARM = { leather: 1, studded: 1, bone: 1, ringmail: 1, chain: 1, plate: 1, dragon: 1 };
  const metal = fam => fam === 'chain' || fam === 'ringmail' || fam === 'plate' || fam === 'dragon';
  // pattern on a limb segment: rings for chain/ringmail, studs, plate highlights
  const texture = (a, b, fam, c) => { if (fam === 'chain' || fam === 'ringmail') return raw(a, b, 1.6, shade(c, 1.35), ' stroke-dasharray="' + (fam === 'chain' ? '.6 .9' : '.2 1.6') + '"');
    if (fam === 'studded') return raw(a, b, 1.1, '#cfc6a6', ' stroke-dasharray=".2 2.2"'); if (fam === 'plate' || fam === 'dragon') return raw(a, b, .9, shade(c, 1.45), ' transform="translate(-.6 -.4)"'); if (fam === 'bone') return raw(a, b, 1.2, shade(c, .7), ' stroke-dasharray=".8 1.6"'); return ''; };
  // cloak: behind the body seen from the front, over it seen from the back
  if (fig.cloak && !['death', 'corpse'].includes(ac)) {
    const sw2 = (ac === 'run' ? 5 : ac === 'walk' ? 2.5 : 1), top = (x) => add(p.sh, v(x, -3, 0)), bot = (x) => add(p.hip, v(x * 1.5, -4 - sw2, -24));
    const cl = poly([top(-w - .5), top(w + .5), bot(w + 1.5), bot(-w - 1.5)], shade(fig.cloak, front ? .72 : 1));
    put(front ? -30 : 18, cl + (front ? '' : raw(add(p.sh, v(0, -3.2, -1)), add(p.hip, v(0, -4.5 - sw2, -22)), .8, shade(fig.cloak, .7))));
  }
  // legs, boots; leg armor; the robe hides the legs
  for (let i = 0; i < 2; i++) {
    const k = i ? 1 : -1, h = add(p.hip, v(k * 3.2, 0, 0)), ft = p.feet[i], knee = mix(h, ft, .53); knee[1] += 2;
    const legFam = fig.legs && ARM[fig.legs] ? fig.legs : null, legC = legFam ? fig.legsCol : fig.pants || shade(cloth, .53), boot = fig.boots || '#49382a';
    let g = line(h, knee, female ? 5 : 5.8, legC) + line(knee, add(ft, v(0, 0, 4)), 4.8, shade(legC, .9)) + line(add(ft, v(0, 0, 4)), ft, 4.7, boot) + line(ft, add(ft, v(0, 3, 0)), 5, boot);
    if (legFam) g += texture(h, knee, legFam, legC) + texture(knee, add(ft, v(0, 0, 5)), legFam, legC) + (metal(legFam) ? ell(knee, 2.1, 1.7, shade(legC, 1.1), .5) : '');
    put(-12 + depth(h), g);
  }
  // arms: sleeve or arm armor, then hand or glove
  for (let i = 0; i < 2; i++) {
    const k = i ? 1 : -1, shp = add(p.sh, v(k * (w + .5), 0, -1)), elb = p.el[i], hand = p.hands[i];
    const armFam = fig.arms && ARM[fig.arms] ? fig.arms : null, armC = armFam ? fig.armsCol : fig.bareArms ? skin : (fig.robe || (ARM[fig.torso] && fig.torso !== 'leather' ? shade(cloth, .91) : fig.torso === 'leather' || fig.torso === 'studded' ? shade(cloth, .91) : fig.torsoCol || cloth));
    const glove = fig.hands ? fig.handsCol : skin;
    let g = line(shp, elb, 4.7, armC) + line(elb, hand, 3.8, armFam ? shade(armC, .95) : fig.bareArms ? skin : armC === skin ? skin : (fig.robe ? fig.robe : skin)) + ell(hand, 2, 2.2, glove);
    if (!armFam && !fig.bareArms && !fig.robe) g = line(shp, elb, 4.7, armC) + line(elb, mix(elb, hand, .45), 3.9, armC) + line(mix(elb, hand, .45), hand, 3.6, skin) + ell(hand, 2, 2.2, glove);
    if (armFam) g += texture(shp, elb, armFam, armC) + texture(elb, hand, armFam, armC) + (metal(armFam) ? ell(add(shp, v(0, 0, 1)), 3, 2.4, shade(armC, 1.08), .6) : '');
    put(depth(shp) * 1.5 + depth(hand) * .6 + (k * s[1] > .05 ? 2 : -2), g);
  }
  // torso: four planes coloured by the chest layer, then the front details
  const torsoFam = ARM[fig.torso] ? fig.torso : null, tc = torsoFam ? fig.torsoCol : fig.robe ? fig.robe : fig.torsoCol || cloth;
  const top = (x, y) => add(p.sh, v(x, y, 0)), bottom = (x, y) => add(p.hip, v(x, y, 0));
  const planes = [[[top(-w, -2.8), top(w, -2.8), bottom(w * hipW, -2.5), bottom(-w * hipW, -2.5)], .74, v(0, -2.8, 0)], [[top(-w, 2.8), top(w, 2.8), bottom(w * hipW, 2.5), bottom(-w * hipW, 2.5)], 1, v(0, 2.8, 0)],
    [[top(-w, -2.8), top(-w, 2.8), bottom(-w * hipW, 2.5), bottom(-w * hipW, -2.5)], 1.14, v(-w, 0, 0)], [[top(w, -2.8), top(w, 2.8), bottom(w * hipW, 2.5), bottom(w * hipW, -2.5)], .83, v(w, 0, 0)]];
  let tor = planes.sort((a, b) => depth(a[2]) - depth(b[2])).map(([ps, k]) => poly(ps, shade(tc, k))).join('');
  const fy = front ? 3 : -3, F = (x, z, base) => add(base || p.sh, v(x, fy, z));
  if (torsoFam === 'chain' || torsoFam === 'ringmail') for (let z = -2; z >= -16; z -= 3) tor += raw(F(-w + 1, z), F(w - 1, z), 1.5, shade(tc, 1.35), ' stroke-dasharray="' + (torsoFam === 'chain' ? '.6 .9' : '.2 1.5') + '"');
  if (torsoFam === 'studded') for (let z = -3; z >= -16; z -= 4) tor += raw(F(-w + 1.5, z), F(w - 1.5, z), 1.2, '#d8cfae', ' stroke-dasharray=".2 2.4"');
  if (torsoFam === 'leather' || torsoFam === 'studded') tor += raw(F(0, -1), F(0, -17), .6, shade(tc, .6));
  if (torsoFam === 'plate' || torsoFam === 'dragon') { tor += raw(F(0, -1.5), F(0, -16), 1.1, shade(tc, 1.5)) + raw(F(-w + 1, -9), F(w - 1, -9), .7, shade(tc, .7));
    put(depth(top(-w, 0)) * 1.5 + 2.5, ell(top(-w - .5, 0), 3.4, 2.6, shade(tc, 1.05), .6)); put(depth(top(w, 0)) * 1.5 + 2.5, ell(top(w + .5, 0), 3.4, 2.6, shade(tc, 1.05), .6)); }
  if (torsoFam === 'bone') for (let z = -3; z >= -15; z -= 4) tor += raw(F(-w + 1, z), F(w - 1, z), 1.3, shade(tc, .75));
  if (fig.stripes && !torsoFam) for (let z = -3; z >= -15; z -= 4) tor += raw(F(-w + .8, z), F(w - .8, z), 1.2, shade(cloth, 1.35));
  if (fig.vest && front) tor += poly([F(-w + .6, -.5), F(-1.2, -1), F(-1.5, -17, p.sh), F(-w * hipW + .5, 1, p.hip)], shade(cloth, .55)) + poly([F(w - .6, -.5), F(1.2, -1), F(1.5, -17, p.sh), F(w * hipW - .5, 1, p.hip)], shade(cloth, .55));
  if (fig.gorget) tor += line(F(-2.5, -1), F(2.5, -1), 2.4, fig.gorget);
  // skirts and over-garments: robe to the ankles, coat tails, apron, tabard
  if (fig.robe) tor += poly([F(-w * hipW, 1, p.hip), F(w * hipW, 1, p.hip), F(w + 2.5, -25, p.hip), F(-w - 2.5, -25, p.hip)], shade(fig.robe, .9)) + raw(F(0, 0, p.hip), F(0, -24, p.hip), .6, shade(fig.robe, .65));
  if (fig.coat) tor += poly([F(-w * hipW, 1, p.hip), F(w * hipW, 1, p.hip), F(w + 1.5, -15, p.hip), F(-w - 1.5, -15, p.hip)], shade(cloth, .8));
  else if (!fig.robe && !torsoFam) tor += poly([F(-w * hipW, 1, p.hip), F(w * hipW, 1, p.hip), F(w * hipW + 1, -5, p.hip), F(-w * hipW - 1, -5, p.hip)], shade(tc, .92));   // tunic skirt
  if (fig.apron && front) tor += poly([F(-3, -4), F(3, -4), F(5, -14, p.hip), F(-5, -14, p.hip)], fig.apron) + raw(F(-3, -4), F(-w + .5, -1), .7, shade(fig.apron, .6)) + raw(F(3, -4), F(w - .5, -1), .7, shade(fig.apron, .6));
  if (fig.tabard) tor += poly([F(-3.2, -.5), F(3.2, -.5), F(3.6, -12, p.hip), F(-3.6, -12, p.hip)], fig.tabard) + raw(F(0, -4), F(0, -10), 1.2, shade(fig.tabard, 1.6)) + raw(F(-1.6, -6.5), F(1.6, -6.5), 1.2, shade(fig.tabard, 1.6));
  tor += line(add(p.hip, v(-w * hipW, fy, 2)), add(p.hip, v(w * hipW, fy, 2)), 2.1, '#5a3f2a');   // belt
  if (front && !fig.tabard && !fig.apron) tor += ell(add(p.hip, v(0, 3, 2)), 1.4, 1, '#b19b69', .5);
  if (front && !torsoFam && !fig.robe && !fig.tabard && !fig.apron && !fig.vest) tor += raw(add(p.sh, v(-2, 3, -1)), add(p.sh, v(0, 3, -6)), 1, shade(tc, .57)) + raw(add(p.sh, v(2, 3, -1)), add(p.sh, v(0, 3, -6)), 1, shade(tc, 1.23));
  put(.3, tor);
  // head: neck, face, hair (hidden under full helmets and hoods), beard, helmet
  const h = p.head, full = ['closedhelm', 'greathelm'].includes(fig.helm), covered = full || fig.hood || fig.helm === 'coif';
  let ha = line(add(h, v(0, 0, -7)), add(h, v(0, 0, -3)), 3.8, fig.helm === 'coif' ? fig.helmCol : skin) + ell(h, female ? 4.7 : 5.1, 6.1, skin);
  if (!covered && style !== 'bald') {
    if (['long', 'braid', 'ponytail'].includes(style)) ha = ell(add(h, v(0, -2, -4)), 4.5, 8, hair) + ha;
    if (['bun', 'ponytail'].includes(style)) ha = ell(add(h, v(0, -4, 1)), 2.8, 3.2, hair) + ha;
    ha += ell(add(h, v(0, -.8, 2.8)), 5, style === 'cropped' ? 2 : 3.3, hair) + raw(add(h, v(-3, -.5, 3)), add(h, v(2, -.5, 4.6)), .9, shade(hair, 1.35));
    if (!front) ha += ell(add(h, v(0, -1, -.8)), 4.7, 4.6, hair);
    if (style === 'parted' && front) ha += line(add(h, v(-2, 2, 4)), add(h, v(0, 2, 1)), 1.6, hair);
    if (style === 'braid') ha += line(add(h, v(2, -3, -1)), add(h, v(2, -4, -12)), 2.6, hair);
  }
  if (front && !full) {
    ha += ell(add(h, v(-1.6, 3, .1)), .5, .5, dark, 0) + ell(add(h, v(1.6, 3, .1)), .5, .5, dark, 0) + raw(add(h, v(0, 3, -1)), add(h, v(0, 4, -2)), .8, shade(skin, 1.15));
    if (fig.beard && fig.beard !== 'none' && !covered) ha += ell(add(h, v(0, 3, -3)), fig.beard === 'goatee' ? 1.5 : fig.beard === 'stubble' ? 3 : 3.1, fig.beard === 'full' ? 3 : fig.beard === 'stubble' ? 1.2 : 1.6, fig.beard === 'stubble' ? shade(hair, 1.1) : shade(hair, .82), fig.beard === 'stubble' ? 0 : .7);
  }
  if (fig.hood) { const hc = shade(cloth, .78); ha = ell(add(h, v(0, -1.2, -1.5)), 6.4, 8.2, hc) + ha; ha += ell(add(h, v(0, -.6, 2.6)), 5.8, 3.8, hc); if (!front) ha += ell(add(h, v(0, -1, -.5)), 5.8, 6.6, hc); }
  if (fig.helm) { const c = fig.helmCol || '#828b8d';
    if (fig.helm === 'cap' || fig.helm === 'leathercap') ha += ell(add(h, v(0, -.5, 3.4)), fig.helm === 'cap' ? 5.3 : 5.6, fig.helm === 'cap' ? 2.8 : 3.4, c);
    else if (fig.helm === 'coif') { ha = ell(add(h, v(0, -1, -1)), 6.2, 8, c) + ha.replace(/^/, ''); ha += ell(add(h, v(0, -.6, 2.4)), 5.7, 3.9, c) + raw(add(h, v(-4.5, -.5, 1)), add(h, v(4.5, -.5, 1)), 1.2, shade(c, 1.35), ' stroke-dasharray=".6 .9"'); }
    else if (fig.helm === 'openhelm') ha += ell(add(h, v(0, 0, 3)), 5.6, 3.5, c) + (front ? line(add(h, v(0, 2, 4)), add(h, v(0, 3, -1)), 1.4, edge) : '');
    else if (fig.helm === 'bonehelm') ha += ell(add(h, v(0, 0, 3)), 5.8, 3.8, c) + line(add(h, v(-4, 0, 4)), add(h, v(-6, 0, 8)), 1.4, shade(c, .9)) + line(add(h, v(4, 0, 4)), add(h, v(6, 0, 8)), 1.4, shade(c, .9));
    else { ha += ell(add(h, v(0, 0, .5)), 5.7, 7, c) + ell(add(h, v(0, 0, 3.5)), 5.2, 3, shade(c, 1.12), .4); if (front) ha += raw(add(h, v(-3, 3.2, .6)), add(h, v(3, 3.2, .6)), 1, dark) + raw(add(h, v(0, 3.4, -1)), add(h, v(0, 3.4, -5)), .6, shade(c, .6)); if (fig.helm === 'greathelm') ha += ell(add(h, v(0, 0, -4.5)), 5.5, 2.2, shade(c, .9), .5); }
  }
  put(30 + depth(h), ha);
  // weapon (bows in the off hand), shield on the off arm
  const wp = fig.weapon;
  if (wp && wp !== 'fist' && !['death', 'corpse'].includes(ac)) {
    const bow = BOWS.includes(wp), g = bow ? p.hands[0] : p.hands[1], a = p.axis, at = k => add(g, scale(a, k)), c = unit(v(-a[2], .1, a[0] || .3)); let art = '';
    if (bow) { const L = wp === 'longbow' ? 18 : 14, ba = ac === 'bow' ? v(0, 0, 1) : a, top2 = add(g, scale(ba, L)), bot = add(g, scale(ba, -L)), mid = add(g, v(0, 3, 0)), draw = ac === 'bow' ? p.hands[1] : g;
      art = line(top2, mid, 1.7, wood) + line(mid, bot, 1.7, wood) + raw(top2, draw, .65, '#d1c5a5') + raw(draw, bot, .65, '#d1c5a5'); if (ac === 'bow' && t < .62) art += line(draw, add(g, v(0, 12, 0)), .8, edge); }
    else if (XBOWS.includes(wp)) { const H = wp === 'heavycrossbow', L = H ? 12 : 8; art = line(at(-6), at(H ? 15 : 13), H ? 4 : 3.2, wood) + line(add(at(7), v(-L, 0, 0)), at(10), H ? 2.4 : 1.9, steel) + line(at(10), add(at(7), v(L, 0, 0)), H ? 2.4 : 1.9, steel) + raw(add(at(7), v(-L, 0, 0)), at(0), .7, edge) + raw(at(0), add(at(7), v(L, 0, 0)), .7, edge) + (H ? line(at(1), at(-3), 2.2, steel) : ''); }
    else if (['dagger', 'knife', 'kryss', 'sword', 'broadsword', 'katana', 'rapier', 'greatsword'].includes(wp)) { const L = { dagger: 9, knife: 8, kryss: 15, sword: 20, broadsword: 21, katana: 23, rapier: 22, greatsword: 29 }[wp], b = wp === 'rapier' || wp === 'kryss' ? 1 : wp === 'broadsword' ? 2.5 : wp === 'knife' ? 2.1 : 1.7;
      art = line(at(wp === 'greatsword' ? -9 : -5), at(3), 2.1, wood) + (wp === 'knife' ? '' : line(add(at(3), scale(c, -4)), add(at(3), scale(c, 4)), 1.7, steel)) + poly([add(at(4), scale(c, -b)), at(L), add(at(4), scale(c, b))], steel) + raw(at(5), at(L - 1), .7, edge); }
    else { const L = { axe: 17, battleaxe: 24, doubleaxe: 24, mace: 16, warhammer: 24, maul: 24, club: 18, spear: 33, shortspear: 23, halberd: 31, bardiche: 30, staff: 30, quarterstaff: 28, wand: 13, pickaxe: 20, hatchet: 15, smithhammer: 13, fishingpole: 36 }[wp] || 18;
      art = line(at(-Math.min(12, L * .38)), at(L), wp === 'wand' ? 1.3 : 2.2, wood);
      if (['axe', 'battleaxe', 'doubleaxe', 'halberd', 'bardiche', 'hatchet', 'pickaxe'].includes(wp)) { const tip = at(L - 2), wing = wp === 'pickaxe' ? 8 : ['battleaxe', 'doubleaxe'].includes(wp) ? 7 : 5;
        art += wp === 'pickaxe' ? line(add(tip, scale(c, wing)), add(tip, scale(c, -wing)), 2, steel) : poly([at(L - 7), add(tip, scale(c, wing)), add(at(L + 1), scale(c, wing)), at(L + 1)], steel);
        if (wp === 'doubleaxe') art += poly([at(L - 7), add(tip, scale(c, -wing)), add(at(L + 1), scale(c, -wing)), at(L + 1)], steel); }
      if (['spear', 'shortspear', 'halberd', 'bardiche'].includes(wp)) art += poly([add(at(L - 6), scale(c, -2.3)), at(L + 4), add(at(L - 6), scale(c, 2.3))], edge);
      if (['mace', 'club', 'maul', 'warhammer', 'smithhammer'].includes(wp)) art += line(add(at(L - 2), scale(c, -3.3)), add(at(L - 2), scale(c, 3.3)), wp === 'maul' || wp === 'warhammer' ? 6 : 4.7, wp === 'club' ? wood : steel) + (wp === 'mace' ? ell(at(L), 2.6, 2.6, steel, .6) : '');
      if (['staff', 'wand'].includes(wp)) art += ell(at(L), 1.8, 2.1, '#b9a16c');
      if (wp === 'fishingpole') art += raw(at(L), add(at(L), v(0, 4, -14)), .6, '#b7b2a1'); }
    put(depth(g) + 7, art);
  }
  if (fig.shield && !['death', 'corpse', 'bow', 'crossbow', 'hcrossbow', 'slash2h', 'chop2h', 'blunt2h', 'thrust2h', 'polearm', 'staff', 'caststaff', 'mine', 'chopwood'].includes(ac) && !p.twoGrip && !p.offGrip) {
    const g = add(p.hands[0], v(-1, 2, 0)), sc = fig.shieldCol || '#7f6845', fx = x => add(g, v(x, 0, 0)), Z = (x, z) => add(g, v(x, 1, z));
    let art;
    if (fig.shield === 'buckler') art = ell(g, 3.6, 3.9, sc) + ell(g, 1.3, 1.4, steel, .5);
    else if (fig.shield === 'kite') art = poly([Z(-4.5, 6), Z(4.5, 6), Z(4, -2), Z(0, -11), Z(-4, -2)], sc) + raw(Z(0, 5), Z(0, -9), 1, shade(sc, 1.4));
    else if (fig.shield === 'heater') art = poly([Z(-5, 6), Z(5, 6), Z(4.6, -1.5), Z(0, -8), Z(-4.6, -1.5)], sc) + raw(Z(-3.5, 4.8), Z(3.5, 4.8), 1, shade(sc, 1.4)) + raw(Z(0, 5.5), Z(0, -6.5), 1, shade(sc, 1.4));
    else art = ell(fx(0), 5.6, 7.2, shade(sc, .8)) + ell(fx(0), 4.4, 5.9, sc) + ell(fx(0), 1.7, 1.9, steel);
    put(depth(g) + (front ? 8 : -8), art);
  }
  if (ac === 'bandage') put(20, ell(p.hands[0], 2.7, 2.1, '#d8cbb1'));
  const sc = fig.scale && fig.scale !== 1 ? fig.scale : 1, body = shapes.sort((a, b) => a[0] - b[0]).map(x => x[1]).join('');
  const inner = sc === 1 ? body : '<g transform="translate(' + CELL.anchorX + ' ' + CELL.anchorY + ') scale(' + sc + ') translate(' + (-CELL.anchorX) + ' ' + (-CELL.anchorY) + ')">' + body + '</g>';
  return o.inner ? inner : '<svg xmlns="http://www.w3.org/2000/svg" width="' + CELL.width + '" height="' + CELL.height + '" viewBox="0 0 ' + CELL.width + ' ' + CELL.height + '">' + inner + '</svg>';
}
/* one direction of one action: n frames side by side, rendered at k × the cell size (the game draws them 1:1) */
function stripSVG(f, action, direction, k, o) {
  const ac = ANIMATIONS[action] ? action : 'idle', n = ANIMATIONS[ac]; k = k || 1; let parts = '';
  for (let i = 0; i < n; i++) parts += '<g transform="translate(' + (i * CELL.width) + ' 0)">' + frameSVG(f, Object.assign({}, o || {}, { action: ac, frame: i, direction, inner: true })) + '</g>';
  const W = Math.ceil(n * CELL.width * k), H = Math.ceil(CELL.height * k);
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + (n * CELL.width) + ' ' + CELL.height + '" shape-rendering="geometricPrecision">' + parts + '</svg>';
}
/* atlas in the pack's layout (columns = frames; rows = 8 directions) for one figure and action — the export the painted art replaces */
function atlasSVG(f, action) { const ac = ANIMATIONS[action] ? action : 'idle', n = ANIMATIONS[ac]; let parts = ''; for (let r = 0; r < 8; r++) for (let i = 0; i < n; i++) parts += '<g transform="translate(' + (i * CELL.width) + ' ' + (r * CELL.height) + ')">' + frameSVG(f, { action: ac, frame: i, direction: r, inner: true }) + '</g>'; return '<svg xmlns="http://www.w3.org/2000/svg" width="' + n * CELL.width + '" height="' + 8 * CELL.height + '">' + parts + '</svg>'; }
/* frame index for a phase t ∈ [0,1] (one-shot actions) or a time in seconds (looped actions) */
function frameAt(action, t, seconds) { const n = ANIMATIONS[action] || 1; if (LOOPED.includes(action)) return Math.floor((seconds || 0) * (FPS[action] || 8)) % n; return Math.max(0, Math.min(n - 1, Math.floor((t == null ? 1 : t) * n * .999))); }
const RIG = { VERSION: '2.1.0', DIRECTIONS, CELL, ANIMATIONS, LOOPED, FPS, frameSVG, stripSVG, atlasSVG, frameAt, pose };
root.SFRIG = RIG;
if (typeof module !== 'undefined' && module.exports) module.exports = RIG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
</script>
