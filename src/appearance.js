<script>
/* Shardfall appearance module (SF.LOOK) — the one resolved appearance descriptor every human renderer reads.
   Paperdoll v1.0 (docs/handoffs/paperdoll-v1.md, docs/equipment/PAPERDOLL.md). Pure, renderer-free, network-free: runs in
   the browser after the rules, equipment, stats and creation modules, and in node for tests (tests/paperdoll.test.js).

   resolve(actor) reads only what the actor already has — actor.look (Character Creation v2 ids) and actor.equip (the 18
   EQ slots) — and returns a plain descriptor: body, skin, hair, beard, clothing and cloak colours, plus one entry per worn
   item with its exact item id, slot, visual key, primary material, secondary material (studs), broken flag and visibility.
   It never writes to the actor, never invents an item and never keys a picture on an item UID. The creator, the paper doll,
   the world sprite and human NPCs all go through it, and wire()/fromWire() carry the same thing between peers later, so a
   multiplayer client never needs a second copy of anyone's appearance state. */
(function (root) {
'use strict';
const SF = root.SF; if (!SF || !SF.EQ || !SF.CREATION) throw new Error('appearance.js needs SF, SF.EQ and SF.CREATION first');
const EQ = SF.EQ, CR = SF.CREATION, L = {};
const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);

/* the art contract (paperdoll-v1.md §Art contract). REV changes whenever any layer's drawing changes, so cached pictures
   built from an older revision are never reused. */
L.VERSION = '1.0.0';
L.REV = 'pd-1.0.0-procedural';
L.CANVAS = { w: 384, h: 512, baseline: 496, scale: 2 };     // drawn at 192×256 logical pixels, shown at ×2 nearest-neighbour
// back to front. Hair and cloak have back and front parts; the main hand is split so a grip can pass in front of the fist.
L.ORDER = ['cloak_back', 'hair_back', 'body', 'face', 'under', 'legs', 'feet', 'torso', 'neck', 'arms', 'hands', 'outer', 'belt', 'jewelry',
  'beard', 'hair_front', 'head', 'cloak_front', 'off', 'main'];
/* the registered anchors of both bodies, in logical pixels (×2 for the 384×512 canvas). Every layer of a body shares them:
   painted layers must keep the same head, shoulder, hand and foot positions so they stack without offsets. Side −1 is the
   character's right (the viewer's left, the main hand); the off hand mirrors it about cx. */
L.ANCHORS = {
    male: { cx: 96, headTop: 20, chin: 51, headW: 11.5, brow: 31, eyeY: 36, neckW: 6.5, neckBot: 60, shY: 62, shX: 27, armpitY: 80, chestY: 86, chestX: 21, waistY: 118, waistX: 18, hipY: 134, hipX: 22, crotch: 143,
      knee: 190, kneeO: 15, kneeI: 3.5, ankle: 234, ankleO: 10.5, ankleI: 3.5, foot: 248,
      arm: { sh: [69, 68], el: [63, 112], wr: [60, 149], hd: [60, 160] }, upR: 7, foreR: 5.6, wristR: 4, handR: 5 },
    female: { cx: 96, headTop: 25, chin: 53, headW: 10.5, brow: 34, eyeY: 38, neckW: 5.5, neckBot: 62, shY: 64, shX: 23, armpitY: 82, chestY: 90, chestX: 20, waistY: 116, waistX: 14.5, hipY: 136, hipX: 24, crotch: 145,
      knee: 190, kneeO: 15, kneeI: 3.5, ankle: 234, ankleO: 10, ankleI: 3, foot: 248,
      arm: { sh: [74, 70], el: [68, 112], wr: [66, 147], hd: [66, 157] }, upR: 6, foreR: 4.8, wristR: 3.4, handR: 4.4 } };
L.SLOT_LAYER = { shirt: 'under', trousers: 'under', legs: 'legs', feet: 'feet', chest: 'torso', neck: 'neck', arms: 'arms', hands: 'hands',
  robe: 'outer', tunic: 'outer', belt: 'belt', ring: 'jewelry', bracelet: 'jewelry', necklace: 'jewelry', head: 'head', cloak: 'cloak_back', weapon: 'main', shield: 'off' };

/* ---------------- material channels ---------------- */
L.matKind = m => !m ? null : SF.METAL[m] ? 'metal' : EQ.HIDES[m] ? 'hide' : (SF.WOOD && SF.WOOD[m]) ? 'wood' : EQ.FIXED[m] ? m : null;
// what each weapon's primary channel is made of when the item carries no material (tools and bows have none until crafted)
L.WEAPON_PRIM = { sword: 'metal', glaive: 'metal', battleaxe: 'metal', hatchet: 'metal', knife: 'metal', pickaxe: 'metal', hammer: 'metal', mace: 'metal',
  waraxe: 'metal', dagger: 'metal', kryss: 'metal', spear: 'metal', shortbow: 'wood', crossbow: 'wood', heavycrossbow: 'wood', unarmed: null };
const DEFAULT_OF = { metal: 'iron', hide: 'regular', wood: 'pine' };
/* helmets that hide hair or a beard. hair: 'top' leaves hair below the brim (long hair, ponytails); 'all' hides every strand.
   beard: what of a beard still shows — 'all', 'mustache' (the coif's face opening) or 'none' (a closed face). */
L.OCCLUDE = {
  cloth_cap: { hair: 'top', beard: 'all' }, leather_cap: { hair: 'top', beard: 'all' }, chain_coif: { hair: 'all', beard: 'mustache' },
  bascinet: { hair: 'top', beard: 'all' }, open_helm: { hair: 'top', beard: 'all' }, norse_helm: { hair: 'top', beard: 'all' },
  closed_helm: { hair: 'all', beard: 'none' }, plate_helm: { hair: 'all', beard: 'none' }, great_helm: { hair: 'all', beard: 'none' },
  bone_helm: { hair: 'all', beard: 'none' }, dragon_helm: { hair: 'all', beard: 'none' } };

/* every item a character can wear, from the live registry (SF.ITEMS after the equipment module): the paperdoll needs exactly
   one visual per id. Legacy one-piece suits are not wearable any more (they convert on load) and are excluded. */
L.wearables = () => Object.keys(SF.ITEMS).filter(id => { const d = SF.ITEMS[id]; return d && d.slot && !d.legacy && EQ.SLOT[d.slot]; }).sort();
/* the visual registry entry for one item id: which drawing, which channels */
L.visualOf = id => {
  const d = SF.ITEMS[id]; if (!d || !d.slot || d.legacy) return null;
  if (d.slot === 'weapon') { const w = d.wpn; if (!w || !SF.WEAPONS[w]) return null; const pk = L.WEAPON_PRIM[w];
    return { id, key: 'wpn.' + id, slot: 'weapon', layer: 'main', kind: 'weapon', wpn: w, fam: SF.WEAPONS[w].fam, two: !!SF.WEAPONS[w].two, prim: pk, sec: null, fixed: pk === 'wood' ? ['string', 'leather'] : ['wood', 'leather'] }; }
  const prim = d.fixedMat ? 'fixed' : d.prim || (d.slot === 'shield' ? 'wood' : d.slot === 'tunic' ? 'fixed' : null);
  return { id, key: 'eq.' + id, slot: d.slot, layer: L.SLOT_LAYER[d.slot], kind: d.slot === 'shield' ? 'shield' : d.fam === 'jewelry' ? 'jewelry' : 'armor', fam: d.fam || (d.slot === 'tunic' ? 'cloth' : null),
    prim, fixedMat: d.fixedMat || (prim === 'fixed' ? 'cloth' : null), sec: d.sec || null, fixed: d.slot === 'shield' && prim === 'wood' ? ['metal'] : [], occl: L.OCCLUDE[id] || null };
};
/* the material a worn item shows: the item's own field first (crafted metal, hide or wood), else its definition's default */
L.itemMat = it => {
  const v = L.visualOf(it.id); if (!v) return null; if (v.fixedMat && !it.material) return v.fixedMat;
  const m = SF.matOf(it); if (m && L.matKind(m)) return m;
  return v.prim && DEFAULT_OF[v.prim] || null;
};

/* ---------------- colour ramps (pure: a hex in, a ramp of hexes out; the painter maps grey shading onto them) ---------------- */
const hx = h => { const n = parseInt(String(h).slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const toHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// one ramp per material kind: metals keep a cold specular top and deep shadow; hide, wood and cloth stay matte
L.RAMP_STYLE = { metal: { n: 7, lo: .22, hi: .60, spec: 1 }, hide: { n: 6, lo: .30, hi: .34 }, wood: { n: 6, lo: .32, hi: .36 }, cloth: { n: 6, lo: .38, hi: .32 },
  bone: { n: 6, lo: .42, hi: .45 }, dragonscale: { n: 7, lo: .25, hi: .40, spec: .5 }, skin: { n: 6, lo: .55, hi: .26 }, hair: { n: 6, lo: .35, hi: .40 }, gem: { n: 5, lo: .3, hi: .6 } };
L.ramp = (hex, style) => {
  const S = L.RAMP_STYLE[style] || L.RAMP_STYLE.cloth, c = hx(hex), shadow = [22, 14, 24], light = [255, 248, 228], out = [];
  const lum = (c[0] * .3 + c[1] * .59 + c[2] * .11) / 255, hi = S.hi * (1 - lum * .55);     // pale colours (mithril, flaxen) keep their hue in the light
  for (let i = 0; i < S.n; i++) { const t = i / (S.n - 1); let col;
    if (t < .5) col = mix(mix(c, shadow, 1 - S.lo), c, t * 2); else col = mix(c, light, (t - .5) * 2 * hi);
    if (S.spec && i === S.n - 1) col = mix(col, [250, 252, 255], .55 * S.spec);
    out.push(toHex(col)); }
  return out;
};
L.rampFor = m => { const k = L.matKind(m); return L.ramp(EQ.matColor(m), k === 'metal' ? 'metal' : k === 'hide' ? 'hide' : k === 'wood' ? 'wood' : k === 'bone' ? 'bone' : k === 'dragonscale' ? 'dragonscale' : 'cloth'); };

/* ---------------- the descriptor ---------------- */
const lookOf = a => CR.normalizeLook(a && a.look);
const colOf = (list, id, dflt) => { const x = list.find(o => o.id === id); return x && x.hex || dflt; };
/* resolve(actor, opts) → descriptor. actor: { look, equip, ghost? }; opts.preview: an equip map shown without being worn
   (the creator), opts.corpse: true for a body left on the ground. Never mutates the actor. */
L.resolve = (actor, opts) => {
  opts = opts || {}; const raw = actor && actor.look, rawCloak = raw && typeof raw.cloak === 'string' && /^#[0-9a-f]{6}$/i.test(raw.cloak) ? raw.cloak : null, lk = lookOf(actor), equip = opts.preview || (actor && actor.equip) || {}, ghost = !!(actor && actor.ghost) && !opts.corpse;
  const d = { v: 1, rev: L.REV, body: lk.body, ghost, corpse: !!opts.corpse,
    skin: { id: lk.skinTone, hex: colOf(CR.SKIN, lk.skinTone, '#d0a080') },
    hair: { style: lk.hairStyle, hex: colOf(CR.HAIR_COLORS, lk.hairColor, '#3b2618') },
    beard: { style: lk.body === 'female' ? 'none' : lk.facialHairStyle, hex: colOf(CR.HAIR_COLORS, lk.facialHairColor, '#3b2618') },
    cloth: { id: lk.clothingColor, hex: colOf(CR.CLOTHING, lk.clothingColor, '#a89878') },
    cloak: null, items: [], missing: [], hide: { hair: null, beard: 'all', offhand: false } };
  for (const s of EQ.SLOT_IDS) {
    const it = equip[s]; if (!it || !SF.ITEMS[it.id]) continue; const v = L.visualOf(it.id);
    if (!v) { d.missing.push({ slot: s, id: it.id }); continue; }
    const mat = L.itemMat(it), sec = v.sec ? (it.sec && SF.METAL[it.sec] ? it.sec : 'iron') : null;
    d.items.push({ slot: s, id: it.id, visual: v.key, layer: v.layer, kind: v.kind, fam: v.fam || null, mat, matKind: L.matKind(mat), matHex: mat ? EQ.matColor(mat) : null,
      sec, secHex: sec ? EQ.matColor(sec) : null, quality: it.quality || 'normal', broken: EQ.broken(it), two: !!v.two, hidden: false });
  }
  const by = s => d.items.find(x => x.slot === s);
  const w = by('weapon'), sh = by('shield'), hd = by('head');
  if (w && w.two && sh) { sh.hidden = true; d.hide.offhand = true; }                      // the rules forbid it; a stale save must still never show both
  if (hd) { const o = L.OCCLUDE[hd.id]; if (o) { d.hide.hair = o.hair; d.hide.beard = o.beard; } }
  // the cloak: a worn cloak item wins; otherwise the creator's cosmetic cloak choice (no cloak item is invented)
  const ck = by('cloak'); if (ck) d.cloak = { source: 'item', hex: ck.matHex, id: ck.id };
  else if (rawCloak) d.cloak = { source: 'look', hex: rawCloak, id: rawCloak };              // an NPC role colour (or an unconverted legacy hex)
  else if (lk.cloak !== 'none') d.cloak = { source: 'look', hex: CR.cloakHex(lk) || '#2f6766', id: lk.cloak };
  if (ghost) { for (const x of d.items) if (x.id !== 'garment') x.hidden = true; d.cloak = null; }   // a ghost wears only the death robe
  d.key = L.key(d);
  return d;
};
/* the cache key of a resolved look: every visual field and the art revision, never an item UID */
L.key = d => [d.rev, d.body, d.skin.id, d.hair.style, d.hair.hex, d.beard.style, d.beard.hex, d.cloth.id, d.cloak ? d.cloak.source + d.cloak.hex : '-', d.ghost ? 'G' : '', d.corpse ? 'C' : '',
  d.items.map(x => [x.slot, x.id, x.mat || '', x.sec || '', x.broken ? 'b' : '', x.hidden ? 'h' : ''].join(':')).join(','), d.missing.map(x => x.slot + ':' + x.id).join(',')].join('|');
/* the visual-only signature of an actor (cheap; changes exactly when the picture changes) */
L.signature = (actor, opts) => L.resolve(actor, opts).key;

/* ---------------- one record, many renderers ---------------- */
/* what the world sprite can show today: skin tone and a cloak colour (the traveller sheets are male and hooded; see
   assets/character/missing-character-art.json). Returns a look the existing tint code accepts. */
L.worldLook = d => ({ body: d.body, skinTone: d.skin.id, cloak: d.cloak && d.cloak.source === 'item' ? d.cloak.hex : d.cloak ? d.cloak.id : 'none' });
/* human NPCs: a stable look from a persistent seed (the NPC's id or name) and its role colour. Cosmetic only; never used
   for an NPC that carries real equipment, whose own equip map is resolved instead. */
const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
L.npcLook = (seed, roleHex) => {
  const h = hash(seed), pick = (list, k) => list[(h >>> k) % list.length], body = h & 1 ? 'female' : 'male';
  const look = CR.normalizeLook({ body, skinTone: pick(CR.SKIN, 3).id, hairStyle: pick(CR.hairFor(body), 7).id, hairColor: pick(CR.HAIR_COLORS, 11).id,
    facialHairStyle: body === 'male' && (h >>> 15) % 3 === 0 ? pick(CR.FACIAL, 17).id : 'none', facialHairColor: pick(CR.HAIR_COLORS, 11).id, clothingColor: pick(CR.CLOTHING, 21).id, cloak: 'teal' });
  if (roleHex) look.cloak = roleHex;      // the role colour stays the NPC's cloak, as before
  return look;
};
L.forNpc = e => L.resolve({ look: e.look || L.npcLook(e.id || e.name || 'npc', e.roleHex), equip: e.equip || {}, ghost: e.ghost });
/* the compact form a server would send: the look ids and, per worn item, [slot, id, material, secondary, broken].
   fromWire() rebuilds an actor-shaped record that resolve() turns into the identical descriptor. */
L.wire = actor => { const lk = lookOf(actor); return { l: CR.LOOK_KEYS.map(k => lk[k]), e: EQ.SLOT_IDS.filter(s => actor.equip && actor.equip[s]).map(s => { const it = actor.equip[s]; return [s, it.id, it.material || 0, it.sec || 0, EQ.broken(it) ? 1 : 0]; }), g: actor.ghost ? 1 : 0 }; };
L.fromWire = w => { const look = {}; CR.LOOK_KEYS.forEach((k, i) => { look[k] = w.l[i]; }); const equip = {};
  for (const [s, id, m, sec, b] of w.e) { const it = { id }; if (m) it.material = m; if (sec) it.sec = sec; if (b) { it.cond = 0; it.maxc = 1; } equip[s] = it; }
  return { look, equip, ghost: !!w.g }; };

/* ---------------- art coverage (validated against assets/character/paperdoll-v1/manifest.json by the tests) ---------------- */
// procedural layers drawn by src/paperdoll.js; painted PNG layers will replace them id by id (same keys, same anchors)
L.BODY_PARTS = () => {
  const out = []; for (const b of CR.BODIES) { out.push('body.' + b.id);
    for (const h of CR.hairFor(b.id)) if (h.id !== 'bald') out.push('hair.' + b.id + '.' + h.id);
    if (b.id === 'male') for (const f of CR.FACIAL) if (f.id !== 'none') out.push('beard.male.' + f.id); }
  out.push('cloak.look'); return out;
};
L.coverage = () => ({ items: L.wearables().map(id => ({ id, visual: (L.visualOf(id) || {}).key || null })), body: L.BODY_PARTS() });
/* manifest() → the paperdoll layer registry (assets/character/paperdoll-v1/manifest.json is this, written by
   tools/paperdoll_manifest.js and checked by tests/paperdoll.test.js). Every layer is 'procedural' until a painted RGBA PNG
   with the same id, canvas and anchors replaces it; then source becomes 'painted' and file names the PNG (one per body). */
L.manifest = () => {
  const layer = (id, o) => Object.assign({ id, bodies: ['male', 'female'], source: 'procedural', files: null }, o);
  const out = [];
  for (const b of CR.BODIES) { out.push(layer('body.' + b.id, { kind: 'body', bodies: [b.id], channels: ['skin', 'underwear'] })); out.push(layer('face.' + b.id, { kind: 'face', bodies: [b.id], channels: ['skin', 'eyes', 'lips', 'brows'] })); }
  for (const id of L.BODY_PARTS()) { if (id.startsWith('body.')) continue; const [k] = id.split('.');
    out.push(layer(id, { kind: k, bodies: k === 'cloak' ? ['male', 'female'] : [id.split('.')[1]], channels: [k === 'cloak' ? 'cloth' : 'hair'], parts: k === 'hair' ? ['back', 'front'] : k === 'cloak' ? ['back', 'front'] : undefined })); }
  for (const id of L.wearables()) { const v = L.visualOf(id);
    out.push(layer(v.key, { kind: v.kind, item: id, slot: v.slot, layer: v.layer, fam: v.fam || null, primary: v.kind === 'weapon' ? v.prim : v.prim === 'fixed' ? 'fixed:' + v.fixedMat : v.prim,
      secondary: v.sec || null, fixedChannels: v.fixed || [], occludes: v.occl || undefined, twoHanded: v.kind === 'weapon' ? v.two : undefined })); }
  return { version: L.VERSION, rev: L.REV, status: 'procedural: original code-drawn layers (src/paperdoll.js); no painted production overlay exists yet',
    canvas: { width: L.CANVAS.w, height: L.CANVAS.h, format: 'RGBA PNG', baseline: L.CANVAS.baseline, logical: [L.CANVAS.w / L.CANVAS.scale, L.CANVAS.h / L.CANVAS.scale], scale: L.CANVAS.scale },
    anchors: L.ANCHORS, order: L.ORDER, slotLayer: L.SLOT_LAYER,
    channels: { primary: 'the item\'s material ramp (metal, hide, wood, or a fixed material)', secondary: 'studs: their own metal ramp', fixed: 'non-tint parts: wood haft, leather grip, string, iron fittings, brass, gems' },
    layers: out };
};

SF.LOOK = L;
if (typeof module !== 'undefined' && module.exports) module.exports = L;
})(typeof globalThis !== 'undefined' ? globalThis : this);
</script>
