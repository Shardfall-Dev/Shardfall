<script>
/* Shardfall layered human compositor (SF.HUMANART) — human atlas contract v1.0 (docs/humans/CONTRACT.md).
   Pure: no DOM, no randomness. Plans which painted layers make up one person in one body / action / direction, then blends
   RGBA pixel arrays (tint masks, occlusion, per-direction draw order, shared anchor). The game wraps it with canvases
   (src/humans.js); node tests drive it with synthetic layers.
   Every equipment overlay is an independent registry entry keyed by its real item id and slot layer, so any combination
   (valorite plate chest + leather gloves + iron chain leggings + mithril helm) composes piece by piece. Entries share the
   body's action, direction, frame index and ground anchor. Nothing is baked into a full suit; nothing is invented:
   a piece with no registered art is reported in plan.missing and not drawn. */
(function (root) {
'use strict';
const SF = root.SF || (root.SF = {});
const C = { VERSION: '1.0.0' };
C.DIRECTIONS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];
C.BODIES = ['male', 'female'];
// one shared canvas per frame: every layer is placed so its own anchor lands on this anchor
C.CANVAS = { width: 96, height: 92, anchorX: 48, anchorY: 86 };
// actions: the rig's 29 states (the animation contract); painted art exists for idle (8 dirs) and walk/cast (SE, SW) only
C.ACTIONS = ['idle', 'walk', 'run', 'ready', 'unarmed', 'slash1h', 'slash2h', 'chop1h', 'chop2h', 'blunt1h', 'blunt2h', 'thrust1h', 'thrust2h', 'polearm', 'staff', 'bow', 'crossbow',
  'cast1h', 'cast2h', 'caststaff', 'block', 'hit', 'death', 'corpse', 'mine', 'chopwood', 'smith', 'bandage', 'fish'];
// the painted v2 'cast' rows are the one-hand gesture
C.ACTION_ALIAS = { cast1h: 'cast' };
/* ---- layers, back to front for a figure facing the viewer. Equipment layers reuse EQ.SLOT_LAYER (verified by validate()). ---- */
C.LAYERS = ['cloak_back', 'main_far', 'off_far', 'hair_back', 'body', 'under', 'legs', 'feet', 'torso', 'neck', 'arms', 'hands', 'outer', 'belt', 'beard', 'hair_front', 'head', 'cloak_front', 'main', 'off'];
// EQ.SLOT_LAYER value → contract layer (cloak, main and off are split by direction below)
C.FROM_EQ = { body: 'body', under: 'under', legs: 'legs', feet: 'feet', torso: 'torso', arms: 'arms', hands: 'hands', outer: 'outer', head: 'head', cloak: 'cloak', main: 'main', off: 'off' };
C.SLOT_OVERRIDE = { neck: 'neck', belt: 'belt' };   // finer than EQ.SLOT_LAYER (which folds neck into torso and belt into outer)
// hand depth per screen direction: the right (main) hand is near the viewer when the facing's right side points down-screen
C.NEAR = {}; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, f = [-Math.sin(a), Math.cos(a)], r = [-f[1], f[0]];   // f: facing in screen space (S = down)
  C.NEAR[C.DIRECTIONS[i]] = { main: r[1] > .1 || (Math.abs(r[1]) <= .1 && f[1] > 0), off: -r[1] > .1 || (Math.abs(r[1]) <= .1 && f[1] > 0), back: f[1] < -.1 }; }
C.order = dir => { const n = C.NEAR[dir] || C.NEAR.S, L = C.LAYERS.slice();
  const drop = []; if (n.back) drop.push('cloak_back'); else drop.push('cloak_front');
  if (n.main) drop.push('main_far'); else drop.push('main'); if (n.off) drop.push('off_far'); else drop.push('off');
  let o = L.filter(l => !drop.includes(l));
  if (n.back) { o = o.filter(l => l !== 'hair_back'); o.splice(o.indexOf('head'), 0, 'hair_back'); }   // seen from behind, the back hair covers the neck and torso
  return o; };
C.layerOf = (slot, dir) => { const n = C.NEAR[dir] || C.NEAR.S, EQ = SF.EQ;
  const base = C.SLOT_OVERRIDE[slot] || C.FROM_EQ[EQ && EQ.SLOT_LAYER ? EQ.SLOT_LAYER[slot] : slot] || null;
  if (base === 'cloak') return n.back ? 'cloak_front' : 'cloak_back';
  if (base === 'main') return n.main ? 'main' : 'main_far';
  if (base === 'off') return n.off ? 'off' : 'off_far';
  return base; };
// occlusion: what a worn piece hides (by item family / id), applied after the plan is built
C.OCCLUDE = { helmFull: ['hair_front', 'hair_back', 'beard'], helmOpen: ['hair_front'], hood: ['hair_front', 'hair_back'] };
C.FULL_HELMS = ['closed_helm', 'plate_helm', 'great_helm', 'bone_helm', 'dragon_helm'];
C.OPEN_HELMS = ['bascinet', 'open_helm', 'norse_helm', 'chain_coif', 'leather_cap', 'cloth_cap'];
// approved fallbacks while painted states are missing: the figure keeps the painted body in the nearest painted pose.
// 'bob' = the step bob the classic atlas already used for walking; 'lunge' = the existing strike nudge. Never a procedural frame.
C.FALLBACK = { walk: ['idle', 'bob'], run: ['walk', 'idle', 'bob'], ready: ['idle'], cast2h: ['cast', 'idle'], caststaff: ['cast', 'idle'], cast: ['idle'], hit: ['idle'], block: ['idle'],
  bandage: ['idle'], mine: ['idle'], chopwood: ['idle'], smith: ['idle'], fish: ['idle'] };
for (const a of ['unarmed', 'slash1h', 'slash2h', 'chop1h', 'chop2h', 'blunt1h', 'blunt2h', 'thrust1h', 'thrust2h', 'polearm', 'staff', 'bow', 'crossbow']) C.FALLBACK[a] = ['idle', 'lunge'];
// death and corpse have no fallback: the caller keeps the previous corpse drawing (prior renderer for unsupported states)

/* ---------------- registry ---------------- */
// entry: { layer, key, body, action, dir, atlas, x, y, w, h, ax, ay, frames, mask?: { atlas, x, y }, style, socket?: [[x, y] per frame] }
// key: 'body' for bodies; item id for equipment ('plate_chest', 'sword'); 'hair:<style>' / 'beard:<style>' for hair.
C.newRegistry = function () {
  const by = new Map(), all = [];
  const k = (layer, key, body, action, dir) => layer + '|' + key + '|' + body + '|' + action + '|' + dir;
  return {
    all,
    add(e) { if (!C.LAYERS.includes(e.layer) && !['cloak', 'main', 'off'].includes(e.layer)) throw new Error('unknown layer ' + e.layer); all.push(e); by.set(k(e.layer, e.key || 'body', e.body, e.action, e.dir), e); return e; },
    get(layer, key, body, action, dir) { const L = layer.replace(/_(far|back|front)$/, ''); return by.get(k(layer, key, body, action, dir)) || by.get(k(L, key, body, action, dir)) || null; },
    has(layer, key) { return all.some(e => (e.layer === layer || e.layer === layer.replace(/_(far|back|front)$/, '')) && (key === undefined || e.key === key)); },
    actions(body, dir) { return [...new Set(all.filter(e => e.layer === 'body' && e.body === body && e.dir === dir).map(e => e.action))]; } };
};
C.fromManifest = function (man, reg) {
  reg = reg || C.newRegistry();
  for (const e of man.entries) reg.add(Object.assign({ key: 'body', style: man.style, baked: man.bakedApparel || [] }, e));
  return reg;
};

/* ---------------- planning ---------------- */
// which body action is drawn for a requested action, and with which presentation helper (bob / lunge)
C.resolveAction = function (reg, body, action, dir) {
  const want = C.ACTION_ALIAS[action] || action;
  if (reg.get('body', 'body', body, want, dir)) return { action: want, via: null };
  for (const f of C.FALLBACK[want] || []) { if (f === 'bob' || f === 'lunge') continue; if (reg.get('body', 'body', body, f, dir)) return { action: f, via: (C.FALLBACK[want] || []).find(x => x === 'bob' || x === 'lunge') || 'pose', wanted: want }; }
  return null;
};
// D: a wardrobe descriptor (SF.WARDROBE.resolve) — real equipment or cosmetic preset, palette, identity
C.plan = function (reg, D, action, dir) {
  const body = D.body === 'female' ? 'female' : 'male', ra = C.resolveAction(reg, body, action, dir);
  const P = { body, dir, action, drawn: null, fallback: null, layers: [], missing: [], frames: 1 };
  if (!ra) { P.missing.push('body ' + body + ' ' + action + ' ' + dir); return P; }
  P.drawn = ra.action; P.fallback = ra.via ? { via: ra.via, wanted: ra.wanted } : null;
  const B = reg.get('body', 'body', body, ra.action, dir); P.frames = B.frames || 1;
  const baked = new Set(B.baked || []), col = m => (SF.EQ && SF.EQ.matColor ? SF.EQ.matColor(m) : null);
  P.layers.push({ layer: 'body', key: 'body', entry: B, tint: null });
  // hair and beard: separate layers when painted; baked into the painted body otherwise
  if (!baked.has('hair')) for (const [layer, key] of [['hair_back', 'hair:' + D.style], ['hair_front', 'hair:' + D.style], ['beard', 'beard:' + D.beard]]) {
    if (key === 'beard:none' || key === 'hair:bald') continue; const e = reg.get(layer, key, body, ra.action, dir); if (e) P.layers.push({ layer, key, entry: e, tint: { p: D.hairColor || null } }); else P.missing.push(layer + ' ' + key); }
  else if (D.style && D.styleWanted) P.missing.push('hair style ' + D.style + ' (hair is painted into the body)');
  let helm = null;
  for (const slot in D.pieces || {}) {
    const p = D.pieces[slot]; if (!p) continue; const layer = C.layerOf(slot, dir); if (!layer) { P.missing.push('no layer for slot ' + slot); continue; }
    if (slot === 'head') helm = p.id;
    if (baked.has(slot) && (p.id === 'shirt' || p.id === 'trousers' || p.id === 'shoes' || p.id === 'boots' || p.id === 'belt') && !p.dye) continue;   // the painted plain clothes stand in for undyed basics
    const e = reg.get(layer, p.id, body, ra.action, dir);
    if (!e) { P.missing.push(slot + ' ' + p.id + (p.material ? ' (' + p.material + ')' : '') + (p.dye ? ' dyed ' + p.dye : '')); continue; }
    P.layers.push({ layer, key: p.id, slot, entry: e, tint: { p: p.dye || col(p.material), s: p.sec ? col(p.sec) : null }, source: p.source });
  }
  for (const [slot, w] of [['weapon', D.weapon], ['shield', D.shield]]) {
    if (!w || w.id === 'unarmed') continue; const layer = C.layerOf(slot, dir), e = reg.get(layer, w.id, body, ra.action, dir);
    if (!e) { P.missing.push(slot + ' ' + w.id); continue; } P.layers.push({ layer, key: w.id, slot, entry: e, tint: { p: col(w.material), s: null }, source: w.source });
  }
  // occlusion
  const hide = new Set(helm && C.FULL_HELMS.includes(helm) ? C.OCCLUDE.helmFull : helm && C.OPEN_HELMS.includes(helm) ? C.OCCLUDE.helmOpen : []);
  if ((D.overlays || []).some(o => o.id === 'hood')) C.OCCLUDE.hood.forEach(l => hide.add(l));
  P.layers = P.layers.filter(l => !hide.has(l.layer)); P.hidden = [...hide];
  const ord = C.order(dir); P.layers.sort((a, b) => ord.indexOf(a.layer) - ord.indexOf(b.layer));
  P.key = [body, dir, ra.action, P.layers.map(l => l.layer + ':' + l.key + ':' + (l.tint ? (l.tint.p || '') + (l.tint.s || '') : '')).join(',')].join('|');
  return P;
};

/* ---------------- pixels ---------------- */
const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
// luminance-preserving tint ramp: mid grey (0.5) maps to the target colour, darker and lighter keep their shading
const ramp = (l, c) => [Math.min(255, c[0] * l * 2), Math.min(255, c[1] * l * 2), Math.min(255, c[2] * l * 2)];
/* draw one frame of one layer into dst (Uint8ClampedArray, C.CANVAS size). img/mask: { data, width }.
   mask channels: R = primary material weight, G = secondary weight, B = fixed (never tinted), A = coverage (source alpha). */
C.blend = function (dst, img, e, frame, mask, tint) {
  const W = C.CANVAS.width, H = C.CANVAS.height, f = Math.min(frame || 0, (e.frames || 1) - 1), sx0 = e.x + f * e.w, sy0 = e.y;
  const ox = C.CANVAS.anchorX - e.ax, oy = C.CANVAS.anchorY - e.ay, P = tint && tint.p ? hexRGB(tint.p) : null, S = tint && tint.s ? hexRGB(tint.s) : null;
  const mx0 = mask ? (e.mask ? e.mask.x : sx0) + (e.mask ? f * e.w : 0) : 0, my0 = mask ? (e.mask ? e.mask.y : sy0) : 0;
  for (let y = 0; y < e.h; y++) { const dy = oy + y; if (dy < 0 || dy >= H) continue;
    for (let x = 0; x < e.w; x++) { const dx = ox + x; if (dx < 0 || dx >= W) continue;
      const si = ((sy0 + y) * img.width + sx0 + x) * 4, a = img.data[si + 3] / 255; if (!a) continue;
      let r = img.data[si], g = img.data[si + 1], b = img.data[si + 2];
      if (mask && (P || S)) { const mi = ((my0 + y) * mask.width + mx0 + x) * 4, wp = mask.data[mi] / 255, ws = mask.data[mi + 1] / 255;
        if (wp + ws > 0) { const l = (r * .3 + g * .59 + b * .11) / 255, rp = P ? ramp(l, P) : [r, g, b], rs = S ? ramp(l, S) : [r, g, b], k = 1 - wp - ws;
          r = r * k + rp[0] * wp + rs[0] * ws; g = g * k + rp[1] * wp + rs[1] * ws; b = b * k + rp[2] * wp + rs[2] * ws; } }
      const di = (dy * W + dx) * 4, da = dst[di + 3] / 255, oa = a + da * (1 - a);
      dst[di] = (r * a + dst[di] * da * (1 - a)) / oa; dst[di + 1] = (g * a + dst[di + 1] * da * (1 - a)) / oa; dst[di + 2] = (b * a + dst[di + 2] * da * (1 - a)) / oa; dst[di + 3] = oa * 255; } }
  return dst;
};
// a whole frame: images[atlas] = { data, width }, masks likewise (keyed by entry.mask.atlas)
C.composeFrame = function (P, frame, images, masks) {
  const dst = new Uint8ClampedArray(C.CANVAS.width * C.CANVAS.height * 4);
  for (const L of P.layers) { const img = images[L.entry.atlas]; if (!img) continue; C.blend(dst, img, L.entry, frame, L.entry.mask && masks ? masks[L.entry.mask.atlas] : null, L.tint); }
  return dst;
};

/* ---------------- availability (drives the character creator) and validation ---------------- */
C.availability = reg => ({ bodies: C.BODIES.filter(b => reg.all.some(e => e.layer === 'body' && e.body === b)),
  hairStyles: [...new Set(reg.all.filter(e => e.layer.startsWith('hair')).map(e => e.key.slice(5)))], beards: [...new Set(reg.all.filter(e => e.layer === 'beard').map(e => e.key.slice(6)))],
  skinTint: reg.all.some(e => e.layer === 'body' && e.mask), clothTint: reg.all.some(e => e.layer === 'under' && e.mask),
  baked: [...new Set(reg.all.filter(e => e.layer === 'body').flatMap(e => e.baked || []))] });
C.validate = function (reg) {
  const err = [], EQ = SF.EQ;
  if (EQ) { for (const l of EQ.RENDER_LAYERS) if (!C.FROM_EQ[l]) err.push('EQ render layer ' + l + ' has no contract layer');
    for (const s in EQ.SLOT_LAYER) if (!C.layerOf(s, 'S')) err.push('slot ' + s + ' maps to no layer'); for (const s of EQ.SLOT_IDS) if (!['ring', 'bracelet', 'necklace'].includes(s) && !C.layerOf(s, 'S')) err.push('slot ' + s + ' has no layer'); }
  for (const d of C.DIRECTIONS) { const o = C.order(d); if (new Set(o).size !== o.length) err.push('order ' + d + ' repeats'); if (o.indexOf('body') < 0) err.push('order ' + d + ' has no body'); }
  if (reg) for (const e of reg.all) {
    if (!C.BODIES.includes(e.body)) err.push('entry body ' + e.body); if (!C.DIRECTIONS.includes(e.dir)) err.push('entry dir ' + e.dir);
    if (!(C.ACTIONS.includes(e.action) || e.action === 'cast')) err.push('entry action ' + e.action);
    if (!(e.w > 0 && e.h > 0 && e.frames >= 1)) err.push('entry size ' + JSON.stringify(e));
    if (C.CANVAS.anchorX - e.ax < 0 || C.CANVAS.anchorY - e.ay < 0 || C.CANVAS.anchorX - e.ax + e.w > C.CANVAS.width || C.CANVAS.anchorY - e.ay + e.h > C.CANVAS.height) err.push('entry does not fit the shared canvas: ' + e.layer + ' ' + e.action + ' ' + e.dir);
    if (e.layer !== 'body' && SF.ITEMS && !e.key.startsWith('hair:') && !e.key.startsWith('beard:') && !SF.ITEMS[e.key] && !(SF.WEAPONS && SF.WEAPONS[e.key])) err.push('entry for unknown item ' + e.key);
  }
  return err;
};
SF.HUMANART = C;
if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof globalThis !== 'undefined' ? globalThis : this);
</script>
