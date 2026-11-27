<script>
/* Shardfall layered human rig (SF.HRIG) v1.0 — appearance only.
   Source: asset-packs/layered-armor-v1 (classic-human-rig-armor-v1.mjs + armor-layers.mjs, built on classic-humans-v2):
   112×100 cell, ground anchor (56,86), 8 screen directions S SW W NW N NE E SE, 29 animations. Every limb segment is drawn
   with the armor of its own slot and sorted by depth for the current direction and pose, so armor follows the joints and
   occludes per direction instead of being pasted over a finished body.
   Pure: no DOM, no timers, no randomness. It reads SF.ITEMS / SF.matOf / SF.EQ.matColor / SF.WEAPONS and never writes them.
   Procedural prototype art, not the final painted atlas (asset-packs/layered-armor-v1/README.md §6). */
(function (root) {
'use strict';
const SF = root.SF; if (!SF || !SF.EQ) throw new Error('human-rig.js needs the rules (SF) and equipment (SF.EQ) modules first');
const EQ = SF.EQ;
const DIRECTIONS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'], CELL = { width: 112, height: 100, anchorX: 56, anchorY: 86 };
const ANIMATIONS = { idle: 4, walk: 8, run: 8, ready: 4, unarmed: 8, slash1h: 8, slash2h: 8, chop1h: 8, chop2h: 8, blunt1h: 8, blunt2h: 8, thrust1h: 8, thrust2h: 8, polearm: 8, staff: 8, bow: 8, crossbow: 8, cast1h: 8, cast2h: 8, caststaff: 8, block: 6, hit: 4, death: 8, corpse: 1, mine: 8, chopwood: 8, smith: 8, bandage: 8, fish: 8 };
// every SF.WEAPONS id (src/rules.js) → [attack animation, drawn shape]; tools used while gathering have their own shapes
const WEAPON_MAP = { unarmed: ['unarmed', 'fist'], sword: ['slash1h', 'sword'], glaive: ['polearm', 'halberd'], battleaxe: ['chop2h', 'battleaxe'], hatchet: ['chop2h', 'hatchet'], knife: ['slash1h', 'dagger'], pickaxe: ['chop1h', 'pickaxe'], hammer: ['blunt2h', 'warhammer'], mace: ['blunt1h', 'mace'], waraxe: ['chop1h', 'axe'], dagger: ['thrust1h', 'dagger'], kryss: ['thrust1h', 'kryss'], spear: ['thrust2h', 'spear'], shortbow: ['bow', 'bow'], crossbow: ['crossbow', 'crossbow'], heavycrossbow: ['crossbow', 'heavycrossbow'] };
const TWO_HAND_ACTIONS = ['bow', 'crossbow', 'slash2h', 'chop2h', 'blunt2h', 'thrust2h', 'polearm', 'staff', 'caststaff'];
const HAIR_VISIBLE = ['cloth_cap', 'leather_cap', 'bascinet', 'open_helm', 'norse_helm'];   // helmets that leave the hair showing
const SKIN = { fair: '#ca9a72', tan: '#ac7854', olive: '#937450', brown: '#815338', deep: '#684333' };
const HAIR = { black: '#302a25', brown: '#65452e', darkBrown: '#493327', blond: '#b69a58', auburn: '#914a32', grey: '#8b8981', white: '#c5c1b6' };
const CLOTH = { linen: '#ac9776', brown: '#78513a', charcoal: '#50504b', navy: '#3b5676', forest: '#4d6845', burgundy: '#823e38', purple: '#6d5279', ochre: '#a17b39', cream: '#c6bda5', teal: '#436b69', rust: '#95573c' };
const HAIRSTYLES = ['bald', 'cropped', 'short', 'parted', 'long', 'ponytail', 'bun', 'braid'], BEARDS = ['none', 'stubble', 'goatee', 'short', 'full'];
const RENDER_SLOTS = ['head', 'neck', 'chest', 'arms', 'hands', 'legs', 'feet', 'shield', 'cloak', 'shirt', 'trousers', 'robe', 'tunic', 'belt', 'ring', 'bracelet', 'necklace'];
const FAMILY_OK = { cloth: 1, leather: 1, studded: 1, bone: 1, ringmail: 1, chain: 1, plate: 1, helm: 1, dragon: 1, shield: 1, jewelry: 1 };

/* ---------- equipment → drawable gear, from the authoritative item definitions and materials ---------- */
const hexOk = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const colorOf = m => { const c = EQ.matColor(m); return hexOk(c) ? c : '#9aa0a8'; };
/* resolveGear(equip) → { slot: { id, family, material, color, sec, secColor, broken } } for the armor/clothing/accessory slots,
   plus unsupported: [ids]. Material is the item's own (fixed material, else SF.matOf); studs use the item's secondary metal. */
function resolveGear(equip) {
  const out = {}, unsupported = [];
  for (const slot of RENDER_SLOTS) {
    const it = equip && equip[slot]; if (!it) continue; const d = SF.ITEMS[it.id];
    if (!d) { unsupported.push(it.id); continue; }
    if (it.id === 'garment') { out[slot] = { id: 'tabard', family: 'cloth', material: 'cloth', color: colorOf('cloth'), sec: null, secColor: null, broken: false }; continue; }   // the respawn tunic
    if (!d.fam || !FAMILY_OK[d.fam] || (d.slot && d.slot !== slot)) { unsupported.push(it.id); continue; }
    const material = d.fixedMat || SF.matOf(it) || 'iron', sec = d.sec ? (it.sec || 'iron') : null;
    out[slot] = { id: it.id, family: d.fam, material, color: colorOf(material), sec, secColor: sec ? colorOf(sec) : null, broken: it.cond === 0 };
  }
  return { gear: out, unsupported };
}
/* weaponOf(item) → { id, attack, shape, two } using the item registry's own two-handed flag */
function weaponOf(it) {
  if (!it) return { id: 'unarmed', attack: 'unarmed', shape: 'fist', two: false };
  const w = SF.WEAPONS[it.id], m = WEAPON_MAP[it.id];
  if (!w || !m) return { id: it.id, attack: 'unarmed', shape: 'fist', two: false, unsupported: true };
  return { id: it.id, attack: m[0], shape: m[1], two: !!w.two };
}
const gearKey = g => RENDER_SLOTS.map(s => { const x = g[s]; return x ? x.id + ':' + x.material + (x.sec ? '/' + x.sec : '') + (x.broken ? 'x' : '') : ''; }).join(',');

/* ---------- geometry ---------- */
const v = (x, y, z) => [x, y, z], add = (a, b) => a.map((x, i) => x + b[i]), scale = (a, k) => a.map(x => x * k), mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t),
  unit = a => scale(a, 1 / (Math.hypot(...a) || 1)), seq = (a, t) => { const u = Math.max(0, Math.min(a.length - 1, t * (a.length - 1))), i = Math.floor(u); return mix(a[i], a[Math.min(i + 1, a.length - 1)], u - i); };
const shade = (c, k) => '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(c.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join(''), dark = '#302821', steel = '#a6aeb0', edge = '#e0e0d3', wood = '#775036';
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
    if (['slash2h', 'chop2h', 'blunt2h', 'thrust2h', 'polearm', 'staff', 'mine', 'chopwood', 'caststaff'].includes(ac)) { l = add(r, scale(unit(a), -8)); l[0] -= 3; }
    hands = [l, r]; axis = unit(a); el = [mix(v(-11, 1, 39), l, .30), mix(v(11, 1, 39), r, .30)];
  }
  return { hip, sh, head, feet, hands, el, axis };
}

/* ---------- armor painter (per-piece palettes: outlines, joints, highlights and trims keep their own colours) ---------- */
function armorPainter({ line, ell, poly, depth, front, p, w }) {
  const at = (a, x, y, z) => add(a, v(x, y, z)), between = (a, b, t) => mix(a, b, t), trim = '#49382d';
  const details = (a, b, g, width) => {
    const c = g.color, f = g.family; let s = '';
    if (f === 'plate' || f === 'helm') { for (const t of [.22, .52, .78]) { const k = between(a, b, t); s += ell(k, width * .49, 1.05, shade(c, .7)) + ell(at(k, -.35, 0, .4), width * .43, .48, shade(c, 1.35)); } }
    else if (f === 'chain' || f === 'ringmail') { for (let i = 1; i <= 5; i++) { const k = between(a, b, i / 6); for (const x of [-.9, .9]) s += ell(at(k, x, 0, 0), .78, .65, shade(c, i % 2 ? 1.32 : .58)); } }
    else if (f === 'studded') { for (let i = 1; i <= 4; i++) s += ell(between(a, b, i / 5), .67, .67, g.secColor); }
    else if (f === 'bone') { for (const t of [.23, .52, .8]) s += ell(between(a, b, t), width * .42, 1.35, shade(c, 1.08)); }
    else if (f === 'dragon') { for (let i = 1; i <= 4; i++) s += ell(between(a, b, i / 5), width * .38, 1.4, shade(c, i % 2 ? 1.28 : .67)); }
    else s += line(between(a, b, .12), between(a, b, .88), .65, shade(c, .65));
    return s;
  };
  const limb = (a, b, g, width) => g ? line(a, b, width, g.color) + details(a, b, g, width) : '';
  function torso(g) {
    if (!g) return ''; const c = g.color, f = g.family, top = (x, y) => at(p.sh, x, y, 0), bottom = (x, y) => at(p.hip, x, y, 0), y = front ? 3.5 : -3.5;
    const W = w + (f === 'plate' ? 1.0 : .15), planes = [[[top(-W, -3.3), top(W, -3.3), bottom(W * .72, -3), bottom(-W * .72, -3)], .66, v(0, -3.3, 0)], [[top(-W, 3.3), top(W, 3.3), bottom(W * .72, 3), bottom(-W * .72, 3)], 1, v(0, 3.3, 0)], [[top(-W, -3.3), top(-W, 3.3), bottom(-W * .72, 3), bottom(-W * .72, -3)], 1.13, v(-W, 0, 0)], [[top(W, -3.3), top(W, 3.3), bottom(W * .72, 3), bottom(W * .72, -3)], .82, v(W, 0, 0)]];
    let s = planes.sort((a, b) => depth(a[2]) - depth(b[2])).map(([q, k]) => poly(q, shade(c, k))).join('');
    const a = at(p.sh, 0, y, -2), b = at(p.hip, 0, y, 1);
    if (f === 'plate') { s += poly([at(a, -W * .77, 0, -1), at(a, 0, .4, -5), at(a, W * .77, 0, -1), at(b, W * .57, 0, 4), at(b, 0, .4, 1), at(b, -W * .57, 0, 4)], shade(c, 1.16)) + line(at(a, 0, .5, -5), at(b, 0, .5, 4), .8, shade(c, 1.5)); for (let i = 0; i < 3; i++) { const k = at(b, 0, 0, i * 2); s += line(at(k, -W * .64, 0, 0), at(k, W * .64, 0, 0), .85, shade(c, .63)); } }
    else if (['ringmail', 'chain', 'studded', 'dragon', 'bone'].includes(f)) { for (let i = 0; i < 5; i++) for (let j = -2; j <= 2; j++) { const k = at(between(a, b, (i + .5) / 5), j * W / 3, 0, 0); if (f === 'bone') s += line(at(k, -.8, 0, 0), at(k, .8, 0, 0), 1.25, shade(c, 1.14)); else s += ell(k, f === 'ringmail' ? 1.05 : .75, f === 'dragon' ? 1.2 : .68, f === 'studded' ? g.secColor : shade(c, (i + j) % 2 ? 1.32 : .63)); } }
    else s += line(at(a, -W * .7, 0, 0), at(b, W * .55, 0, 0), 1.05, shade(c, .62));
    return s + line(at(b, -W * .7, 0, 0), at(b, W * .7, 0, 0), 1.9, trim);
  }
  function head(g, h) {
    if (!g) return ''; const c = g.color, id = g.id, y = front ? 3.9 : -3.9; let s = '';
    if (g.family === 'cloth' || g.family === 'leather') return ell(at(h, 0, 0, 3), 5.5, 3.9, c) + line(at(h, -4, y, 2), at(h, 4, y, 2), 1.1, shade(c, .65));
    if (id === 'chain_coif') { s = ell(h, 5.75, 6.6, c); for (let z = -4; z <= 5; z += 2) for (let x = -3; x <= 3; x += 2) s += ell(at(h, x, y, z), .65, .66, shade(c, (x + z) % 4 ? 1.28 : .66)); if (front) s += ell(at(h, 0, 4, -.7), 2.65, 2.7, '#aa7853'); return s; }
    const full = ['closed_helm', 'plate_helm', 'great_helm', 'bone_helm', 'dragon_helm'].includes(id);
    s = ell(at(h, 0, 0, 1.8), id === 'great_helm' ? 6.4 : 5.7, full ? 6.6 : 4.7, c) + line(at(h, -4, y, 4.2), at(h, 4, y, 4.2), 1.1, shade(c, 1.38));
    if (full) { s += poly([at(h, -4.7, y, 2), at(h, 4.7, y, 2), at(h, 4.0, y, -4.6), at(h, -4.0, y, -4.6)], shade(c, .91)); if (front) { s += line(at(h, -3.4, y + .2, .6), at(h, 3.4, y + .2, .6), 1.35, dark); for (let i = -1; i <= 1; i++) s += ell(at(h, i * 1.35, y + .3, -2.4), .38, .68, dark); } }
    else if (front) { s += line(at(h, -4.7, y, 0), at(h, -4.2, y, -3), 1.8, c) + line(at(h, 4.7, y, 0), at(h, 4.2, y, -3), 1.8, c); if (id === 'norse_helm' || id === 'bascinet') s += line(at(h, 0, y, 3), at(h, 0, y, -1.7), 1.65, c); }
    if (id === 'norse_helm' || id === 'dragon_helm') s += line(at(h, 0, 0, 5), at(h, 0, 0, 7), 1.2, shade(c, 1.22));
    return s;
  }
  function shield(g, h) {
    if (!g) return ''; const c = g.color, id = g.id, y = front ? 1 : -1, q = (x, z) => at(h, x, y, z); let s;
    if (id === 'kite_shield' || id === 'heater_shield') { const pts = id === 'kite_shield' ? [q(-5, 7), q(5, 7), q(5, 1), q(0, -12), q(-5, 1)] : [q(-6, 7), q(6, 7), q(5, -3), q(0, -9), q(-5, -3)]; s = poly(pts, shade(c, .77)) + poly(pts.map(k => between(h, k, .78)), c); }
    else s = ell(h, id === 'buckler' ? 4.5 : 6.5, id === 'buckler' ? 4.5 : 7, c) + ell(h, id === 'buckler' ? 3.5 : 5.1, id === 'buckler' ? 3.5 : 5.7, shade(c, .81));
    return s + ell(h, 1.5, 1.6, shade(c, 1.45));
  }
  function outer(g) { if (!g) return ''; const c = g.color, y = front ? 4 : -4; return poly([at(p.sh, -w * .75, y, -1), at(p.sh, w * .75, y, -1), at(p.hip, w * .65, y, -2), at(p.hip, -w * .65, y, -2)], c) + (g.id === 'robe' ? poly([at(p.hip, -w * .65, y, 0), at(p.hip, w * .65, y, 0), at(p.hip, w + 2, y, -21), at(p.hip, -w - 2, y, -21)], shade(c, .87)) : ''); }
  function cloak(g) { if (!g) return ''; const c = g.color, y = -4; return poly([at(p.sh, -w, y, 0), at(p.sh, w, y, 0), at(p.hip, w + 3, y - 3, -22), at(p.hip, -w - 3, y - 3, -22)], shade(c, .85)) + line(at(p.sh, -w * .6, y, 0), at(p.hip, -w * .55, y - 2, -20), 1, shade(c, 1.22)); }
  return { limb, torso, head, shield, outer, cloak };
}

/* ---------- one frame as an SVG string ----------
   o: { body: 'male'|'female', dir: 0–7 or 'S'…, action, frame, gear (resolveGear().gear), weapon (weaponOf()), shape (tool shape override),
        skin, hair, cloth (hex), style, beard, cloak (hex: a cosmetic cloak colour when no cloak item is worn) } */
function frameOps(o) {
  o = o || {}; const gear0 = o.gear || {}, wp0 = o.weapon || weaponOf(null);
  const ac = ANIMATIONS[o.action] ? o.action : 'idle', n = ANIMATIONS[ac], f = Math.max(0, Math.min(n - 1, Math.floor(o.frame || 0))), t = n > 1 ? f / (n - 1) : 1;
  const di = typeof o.dir === 'number' ? ((o.dir % 8) + 8) % 8 : Math.max(0, DIRECTIONS.indexOf(o.dir)), angle = di * Math.PI / 4, d = [-Math.sin(angle), Math.cos(angle)], s = [d[1], -d[0]];
  const female = o.body === 'female', w = female ? 5.8 : 7.2, p = pose(ac, t);
  const cloth = hexOk(o.cloth) ? o.cloth : CLOTH.linen, hair = hexOk(o.hair) ? o.hair : HAIR.brown, skin = hexOk(o.skin) ? o.skin : SKIN.fair, style = HAIRSTYLES.includes(o.style) ? o.style : 'short';
  const wp = o.shape || wp0.shape || 'fist', two = !!wp0.two;
  const gear = {}; for (const k in gear0) { const g = gear0[k]; gear[k] = g.broken ? Object.assign({}, g, { color: shade(g.color, .72) }) : g; }
  if (!gear.cloak && hexOk(o.cloak)) gear.cloak = { id: 'cloak', family: 'cloth', color: o.cloak };
  const proj = a => [CELL.anchorX + a[0] * s[0] + a[1] * d[0], CELL.anchorY - a[2] + .45 * (a[0] * s[1] + a[1] * d[1])], depth = a => .45 * (a[0] * s[1] + a[1] * d[1]), r = x => Math.round(x * 10) / 10, pt = a => proj(a).map(r).join(',');
  // primitives emit a compact draw list ("l x y X Y w c;", "p c x,y …;", "e x y rx ry c;"); opsToSVG and drawOps turn it into pixels
  const line = (a, b, wd, c) => { const [x, y] = proj(a).map(r), [X, Y] = proj(b).map(r); return 'l ' + x + ' ' + y + ' ' + X + ' ' + Y + ' ' + wd + ' ' + c + ';'; };
  const poly = (ps, c) => 'p ' + c + ' ' + ps.map(pt).join(' ') + ';', ell = (a, x, y, c) => { const [X, Y] = proj(a).map(r); return 'e ' + X + ' ' + Y + ' ' + x + ' ' + y + ' ' + c + ';'; };
  const front = d[1] >= 0, faceY = front ? 3 : -3, A = armorPainter({ line, ell, poly, depth, front, p, w });
  const shapes = [], put = (z, a) => shapes.push([z, a]);
  if (gear.cloak) put(front ? -24 : 24, A.cloak(gear.cloak));                          // behind the body when facing the viewer, over it from behind
  for (let i = 0; i < 2; i++) {
    const k = i ? 1 : -1, h = add(p.hip, v(k * 3.2, 0, 0)), ft = p.feet[i], knee = mix(h, ft, .53); knee[1] += 2;
    const pants = gear.trousers ? gear.trousers.color : shade(cloth, .53), boot = gear.feet ? gear.feet.color : '#49382a', shl = add(p.sh, v(k * (w + .5), 0, -1)), el = p.el[i], hand = p.hands[i];
    put(-12 + depth(h), line(h, knee, female ? 5 : 5.8, pants) + line(knee, add(ft, v(0, 0, 4)), 4.8, shade(pants, .88)) + line(add(ft, v(0, 0, 4)), ft, 4.7, boot) + line(ft, add(ft, v(0, 3, 0)), 5, boot)
      + A.limb(h, knee, gear.legs, 6.5) + A.limb(knee, add(ft, v(0, 0, 4)), gear.legs, 5.6) + (gear.feet ? A.limb(add(ft, v(0, 0, 5)), ft, gear.feet, 5.4) + line(ft, add(ft, v(0, 3, 0)), 5.4, gear.feet.color) : ''));
    put(depth(shl) * 1.5 + depth(hand) * .6 + (k * s[1] > .05 ? 2 : -2), line(shl, el, 4.7, gear.shirt ? gear.shirt.color : shade(cloth, .91)) + line(el, hand, 3.8, skin) + ell(hand, 2, 2.2, skin)
      + A.limb(shl, el, gear.arms, 6.0) + A.limb(el, mix(el, hand, .85), gear.arms, 5.1) + (gear.hands ? A.limb(mix(el, hand, .77), hand, gear.hands, 4.7) + ell(hand, 2.2, 2.35, gear.hands.color) : '')
      + (gear.bracelet && i === 0 ? ell(mix(el, hand, .75), 2.2, .7, gear.bracelet.color) : '') + (gear.ring && i === 1 ? ell(hand, .75, .75, gear.ring.color) : ''));
  }
  const top = (x, y) => add(p.sh, v(x, y, 0)), bottom = (x, y) => add(p.hip, v(x, y, 0));
  const planes = [[[top(-w, -2.8), top(w, -2.8), bottom(w * .72, -2.5), bottom(-w * .72, -2.5)], .74, v(0, -2.8, 0)], [[top(-w, 2.8), top(w, 2.8), bottom(w * .72, 2.5), bottom(-w * .72, 2.5)], 1, v(0, 2.8, 0)], [[top(-w, -2.8), top(-w, 2.8), bottom(-w * .72, 2.5), bottom(-w * .72, -2.5)], 1.14, v(-w, 0, 0)], [[top(w, -2.8), top(w, 2.8), bottom(w * .72, 2.5), bottom(w * .72, -2.5)], .83, v(w, 0, 0)]];
  let tor = planes.sort((a, b) => depth(a[2]) - depth(b[2])).map(([ps, k]) => poly(ps, shade(gear.shirt ? gear.shirt.color : cloth, k))).join('');
  if (front) tor += line(add(p.sh, v(-2, 3, -1)), add(p.sh, v(0, 3, -7)), 1, shade(cloth, .57)) + line(add(p.sh, v(2, 3, -1)), add(p.sh, v(0, 3, -7)), 1, shade(cloth, 1.23));
  tor += A.torso(gear.chest) + A.outer(gear.robe) + A.outer(gear.tunic);
  if (gear.neck) tor += line(add(p.sh, v(-w * .5, faceY, 0)), add(p.sh, v(w * .5, faceY, 0)), 3.1, gear.neck.color);
  if (gear.necklace && front) tor += line(add(p.sh, v(-2, 3, -1)), add(p.sh, v(0, 3, -5)), .8, gear.necklace.color) + line(add(p.sh, v(2, 3, -1)), add(p.sh, v(0, 3, -5)), .8, gear.necklace.color);
  if (gear.belt) tor += line(add(p.hip, v(-w * .7, faceY, 2)), add(p.hip, v(w * .7, faceY, 2)), 2.3, gear.belt.color);
  put(.3, tor);
  const h = p.head; let ha = line(add(h, v(0, 0, -7)), add(h, v(0, 0, -3)), 3.8, skin) + ell(h, female ? 4.7 : 5.1, 6.1, skin);
  const hairShows = style !== 'bald' && (!gear.head || HAIR_VISIBLE.includes(gear.head.id));
  if (hairShows) {
    if (['long', 'braid', 'ponytail'].includes(style)) ha = ell(add(h, v(0, -2, -4)), 4.5, 8, hair) + ha;
    if (['bun', 'ponytail'].includes(style)) ha = ell(add(h, v(0, -4, 1)), 2.8, 3.2, hair) + ha;
    ha += ell(add(h, v(0, -.8, 2.8)), 5, style === 'cropped' ? 2 : 3.3, hair) + line(add(h, v(-3, -.5, 3)), add(h, v(2, -.5, 4.6)), .9, shade(hair, 1.35));
    if (!front) ha += ell(add(h, v(0, -1, -.8)), 4.7, 4.6, hair);
    if (style === 'parted' && front) ha += line(add(h, v(-2, 2, 4)), add(h, v(0, 2, 1)), 1.6, hair);
    if (style === 'braid') ha += line(add(h, v(2, -3, -1)), add(h, v(2, -4, -12)), 2.6, hair);
  }
  const faceCovered = gear.head && ['closed_helm', 'plate_helm', 'great_helm', 'bone_helm', 'dragon_helm'].includes(gear.head.id);
  if (front && !faceCovered) {
    ha += ell(add(h, v(-1.6, 3, .1)), .5, .5, dark) + ell(add(h, v(1.6, 3, .1)), .5, .5, dark) + line(add(h, v(0, 3, -1)), add(h, v(0, 4, -2)), .8, shade(skin, 1.15));
    if (BEARDS.includes(o.beard) && o.beard !== 'none' && !female) ha += ell(add(h, v(0, 3, -3)), o.beard === 'goatee' ? 1.5 : 3.1, o.beard === 'full' ? 3 : 1.6, shade(hair, .82));
  }
  ha += A.head(gear.head, h); put(30 + depth(h), ha);
  if (wp !== 'fist' && !['death', 'corpse', 'bandage'].includes(ac)) {
    const g = ac === 'bow' ? p.hands[0] : p.hands[1], a = unit(p.axis), at = n2 => add(g, scale(a, n2)), c = unit(v(-a[2], .1, a[0] || .3)); let art = '';
    if (wp === 'bow' || wp === 'longbow') { const L = wp === 'longbow' ? 18 : 14, tp = add(g, v(0, -2, L)), bt = add(g, v(0, -2, -L)), mid = add(g, v(0, 3, 0)), draw = ac === 'bow' ? p.hands[1] : g; art = line(tp, mid, 1.7, wood) + line(mid, bt, 1.7, wood) + line(tp, draw, .65, '#d1c5a5') + line(draw, bt, .65, '#d1c5a5'); if (ac === 'bow' && t < .65) art += line(draw, add(g, v(0, 12, 0)), .8, edge); }
    else if (wp === 'crossbow' || wp === 'heavycrossbow') { const L = wp === 'heavycrossbow' ? 12 : 8; art = line(at(-6), at(13), 3.2, wood) + line(add(at(7), v(-L, 0, 0)), at(10), 1.9, steel) + line(at(10), add(at(7), v(L, 0, 0)), 1.9, steel) + line(add(at(7), v(-L, 0, 0)), at(0), .7, edge) + line(at(0), add(at(7), v(L, 0, 0)), .7, edge); }
    else if (['dagger', 'kryss', 'sword', 'broadsword', 'katana', 'rapier', 'greatsword'].includes(wp)) { const L = { dagger: 9, kryss: 15, sword: 20, broadsword: 21, katana: 23, rapier: 22, greatsword: 29 }[wp], b = wp === 'rapier' ? 1 : wp === 'broadsword' ? 2.5 : 1.7; art = line(at(-5), at(3), 2.1, wood) + line(add(at(3), scale(c, -4)), add(at(3), scale(c, 4)), 1.7, steel) + poly([add(at(4), scale(c, -b)), at(L), add(at(4), scale(c, b))], steel) + line(at(5), at(L - 1), .7, edge); }
    else {
      const L = { axe: 17, battleaxe: 24, doubleaxe: 24, mace: 16, warhammer: 24, maul: 24, club: 18, spear: 33, shortspear: 23, halberd: 31, bardiche: 30, staff: 30, quarterstaff: 28, wand: 13, pickaxe: 20, hatchet: 15, smithhammer: 13, fishingpole: 36 }[wp] || 18;
      art = line(at(-Math.min(12, L * .38)), at(L), wp === 'wand' ? 1.3 : 2.2, wood);
      if (['axe', 'battleaxe', 'doubleaxe', 'halberd', 'bardiche', 'hatchet', 'pickaxe'].includes(wp)) { const tip = at(L - 2), wing = wp === 'pickaxe' ? 8 : ['battleaxe', 'doubleaxe'].includes(wp) ? 7 : 5; art += poly([at(L - 7), add(tip, scale(c, wing)), add(at(L + 1), scale(c, wing)), at(L + 1)], steel); if (['doubleaxe', 'pickaxe'].includes(wp)) art += poly([at(L - 7), add(tip, scale(c, -wing)), add(at(L + 1), scale(c, -wing)), at(L + 1)], steel); }
      if (['spear', 'shortspear', 'halberd', 'bardiche'].includes(wp)) art += poly([add(at(L - 6), scale(c, -2.3)), at(L + 4), add(at(L - 6), scale(c, 2.3))], edge);
      if (['mace', 'club', 'maul', 'warhammer', 'smithhammer'].includes(wp)) art += line(add(at(L - 2), scale(c, -3.3)), add(at(L - 2), scale(c, 3.3)), wp === 'maul' ? 6 : 4.7, wp === 'club' ? wood : steel);
      if (wp === 'staff' || wp === 'wand') art += ell(at(L), 1.8, 2.1, '#b9a16c'); if (wp === 'fishingpole') art += line(at(L), add(at(L), v(0, 4, -14)), .6, '#b7b2a1');
    }
    put(depth(g) + 7, art);
  }
  // off hand: never with a two-handed weapon (the item's own flag), in every animation; never while lying dead or using both hands
  if (gear.shield && !two && !['death', 'corpse'].includes(ac) && !TWO_HAND_ACTIONS.includes(ac) && !['mine', 'chopwood', 'fish', 'bandage'].includes(ac)) { const g = p.hands[0]; put(depth(g) + 8, A.shield(gear.shield, g)); }
  if (ac === 'bandage') put(20, ell(p.hands[0], 2.7, 2.1, '#d8cbb1'));
  return shapes.sort((a, b) => a[0] - b[0]).map(x => x[1]).join('');
}
/* the draw list as SVG elements (previews, tests, atlas export) */
function opsToSVG(ops) {
  let out = '';
  for (const op of ops.split(';')) { if (!op) continue; const q = op.split(' ');
    if (q[0] === 'l') { const w = +q[5], c = q[6], g = '<line x1="' + q[1] + '" y1="' + q[2] + '" x2="' + q[3] + '" y2="' + q[4] + '" stroke-linecap="round" stroke="'; out += g + dark + '" stroke-width="' + (w + 1.5) + '"/>' + g + c + '" stroke-width="' + w + '"/>' + g + shade(c, 1.22) + '" stroke-width="' + Math.max(.5, w * .23) + '" transform="translate(-.45 -.45)"/>'; }
    else if (q[0] === 'p') out += '<polygon points="' + q.slice(2).join(' ') + '" fill="' + q[1] + '" stroke="' + dark + '" stroke-width=".8" stroke-linejoin="round"/>';
    else if (q[0] === 'e') out += '<ellipse cx="' + q[1] + '" cy="' + q[2] + '" rx="' + q[3] + '" ry="' + q[4] + '" fill="' + q[5] + '" stroke="' + dark + '" stroke-width=".7"/>'; }
  return out;
}
/* the draw list straight onto a 2D canvas context at (ox, oy): no SVG parsing or image decoding in the game */
function drawOps(g, ops, ox, oy) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const op of ops.split(';')) { if (!op) continue; const q = op.split(' ');
    if (q[0] === 'l') { const x = +q[1] + ox, y = +q[2] + oy, X = +q[3] + ox, Y = +q[4] + oy, w = +q[5], c = q[6];
      g.beginPath(); g.moveTo(x, y); g.lineTo(X, Y); g.strokeStyle = dark; g.lineWidth = w + 1.5; g.stroke(); g.strokeStyle = c; g.lineWidth = w; g.stroke();
      g.beginPath(); g.moveTo(x - .45, y - .45); g.lineTo(X - .45, Y - .45); g.strokeStyle = shade(c, 1.22); g.lineWidth = Math.max(.5, w * .23); g.stroke(); }
    else if (q[0] === 'p') { g.beginPath(); for (let i = 2; i < q.length; i++) { const [x, y] = q[i].split(','); if (i === 2) g.moveTo(+x + ox, +y + oy); else g.lineTo(+x + ox, +y + oy); } g.closePath(); g.fillStyle = q[1]; g.fill(); g.strokeStyle = dark; g.lineWidth = .8; g.stroke(); }
    else if (q[0] === 'e') { g.beginPath(); g.ellipse(+q[1] + ox, +q[2] + oy, +q[3], +q[4], 0, 0, Math.PI * 2); g.fillStyle = q[5]; g.fill(); g.strokeStyle = dark; g.lineWidth = .7; g.stroke(); } }
}
const svgWrap = (w, body) => '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + CELL.height + '" viewBox="0 0 ' + w + ' ' + CELL.height + '">' + body + '</svg>';
function frameSVG(o) { return svgWrap(CELL.width, opsToSVG(frameOps(o))); }
/* one direction × one animation onto a canvas context (columns = frames); returns the frame count */
function drawStrip(g, o) { const ac = ANIMATIONS[o.action] ? o.action : 'idle', n = ANIMATIONS[ac]; for (let f = 0; f < n; f++) drawOps(g, frameOps(Object.assign({}, o, { action: ac, frame: f })), f * CELL.width, 0); return n; }
/* one direction of one animation as a horizontal strip (columns = frames) */
function stripSVG(o) {
  const ac = ANIMATIONS[o.action] ? o.action : 'idle', n = ANIMATIONS[ac], parts = [];
  for (let f = 0; f < n; f++) { const svg = frameSVG(Object.assign({}, o, { action: ac, frame: f })); parts.push('<g transform="translate(' + f * CELL.width + ' 0)">' + svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>')) + '</g>'); }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + n * CELL.width + '" height="' + CELL.height + '" viewBox="0 0 ' + n * CELL.width + ' ' + CELL.height + '">' + parts.join('') + '</svg>';
}
/* every armor/clothing/accessory/shield/weapon definition the renderer knows about, and the ones it cannot draw */
function coverage() {
  const ok = [], missing = [];
  for (const id in SF.ITEMS) { const d = SF.ITEMS[id]; if (!d.slot) continue; if (d.slot === 'weapon') (WEAPON_MAP[id] && SF.WEAPONS[id] ? ok : missing).push(id); else if (RENDER_SLOTS.includes(d.slot)) (d.fam && FAMILY_OK[d.fam] || id === 'garment' ? ok : missing).push(id); }
  return { ok, missing };
}
SF.HRIG = { VERSION: '1.0.0', DIRECTIONS, CELL, ANIMATIONS, WEAPON_MAP, RENDER_SLOTS, SKIN, HAIR, CLOTH, HAIRSTYLES, BEARDS, resolveGear, weaponOf, gearKey, frameSVG, frameOps, opsToSVG, drawOps, drawStrip, stripSVG, pose, coverage, shade };
})(typeof globalThis !== 'undefined' ? globalThis : this);
</script>
