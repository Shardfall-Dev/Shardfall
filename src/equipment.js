<script>
/* Shardfall equipment module (SF.EQ) — equipment slots, armor families, material variants, weight and encumbrance,
   effective attributes, body-region armor, durability, and the validated item commands the UI calls.
   Pure, renderer-free, network-free: runs in the browser after the rules (SF) and Magery modules, and in node for tests.
   Spec: docs/equipment/STATUS.md (Equipment, Paper Doll, Inventory & Armor System v1.0). All numbers below are tuning data. */
(function (root) {
'use strict';
const SF = root.SF; if (!SF) throw new Error('equipment.js needs the rules module (SF) first');
const EQ = {};
const clamp = SF.clamp, r1 = v => Math.round(v * 10) / 10;

/* ---------------- slots and body regions ---------------- */
// weapon = main hand, shield = off hand (the keys stay so every existing caller keeps working)
EQ.SLOTS = [
  { id: 'head', n: 'Head', grp: 'armor', regions: ['head'] },
  { id: 'neck', n: 'Neck', grp: 'armor', regions: ['neck'] },
  { id: 'chest', n: 'Chest', grp: 'armor', regions: ['torso'] },
  { id: 'arms', n: 'Arms', grp: 'armor', regions: ['arms'] },
  { id: 'hands', n: 'Hands', grp: 'armor', regions: ['hands'] },
  { id: 'legs', n: 'Legs', grp: 'armor', regions: ['legs'] },
  { id: 'feet', n: 'Feet', grp: 'armor', regions: [] },
  { id: 'weapon', n: 'Main hand', grp: 'weapon', regions: [] },
  { id: 'shield', n: 'Off hand', grp: 'weapon', regions: [] },
  { id: 'cloak', n: 'Cloak', grp: 'accessory', regions: [] },
  { id: 'ring', n: 'Ring', grp: 'accessory', regions: [] },
  { id: 'bracelet', n: 'Bracelet', grp: 'accessory', regions: [] },
  { id: 'necklace', n: 'Necklace', grp: 'accessory', regions: [] },
  { id: 'belt', n: 'Belt', grp: 'accessory', regions: [] },
  { id: 'shirt', n: 'Shirt', grp: 'clothing', regions: ['torso', 'arms'] },
  { id: 'trousers', n: 'Trousers', grp: 'clothing', regions: ['legs'] },
  { id: 'robe', n: 'Robe', grp: 'clothing', regions: ['torso', 'arms', 'legs'] },
  { id: 'tunic', n: 'Tunic / tabard', grp: 'clothing', regions: ['torso'] }];
EQ.SLOT = {}; for (const s of EQ.SLOTS) EQ.SLOT[s.id] = s;
EQ.SLOT_IDS = EQ.SLOTS.map(s => s.id);
EQ.FUTURE_SLOTS = ['mount', 'quiver', 'hair', 'beard', 'cosmetic'];     // reserved keys, not shown or used in V1
// hit distribution (configurable). A blow lands on one region; only armor covering it mitigates. Sums to 1.
EQ.REGIONS = { torso: .40, legs: .20, arms: .15, head: .15, hands: .07, neck: .03 };
EQ.REGION_N = { torso: 'torso', legs: 'legs', arms: 'arms', head: 'head', hands: 'hands', neck: 'neck' };
EQ.coverage = slot => (EQ.SLOT[slot] ? EQ.SLOT[slot].regions : []).reduce((a, g) => a + (EQ.REGIONS[g] || 0), 0);
EQ.pickRegion = rng => { const x = (rng || Math.random)(); let acc = 0; for (const g in EQ.REGIONS) { acc += EQ.REGIONS[g]; if (x < acc - 1e-12) return g; } return 'neck'; };

/* future layered sprites (not drawn in V1): back to front */
EQ.RENDER_LAYERS = ['body', 'under', 'legs', 'feet', 'torso', 'arms', 'hands', 'outer', 'head', 'cloak', 'main', 'off'];
EQ.SLOT_LAYER = { shirt: 'under', trousers: 'under', legs: 'legs', feet: 'feet', chest: 'torso', neck: 'torso', arms: 'arms', hands: 'hands', robe: 'outer', tunic: 'outer', belt: 'outer', head: 'head', cloak: 'cloak', weapon: 'main', shield: 'off' };

/* ---------------- armor families (full-suit AR is spread by body coverage) ---------------- */
// ar: AR of a region covered by this family (= full-suit AR); med: meditation interference of a full suit (0–1);
// spd: movement slowdown of a full suit; dur: base maximum durability; repair: the skill that repairs it
EQ.FAMILIES = {
  cloth:    { n: 'Cloth', ar: 2, med: 0, spd: 0, dur: 25, repair: 'tailoring' },
  leather:  { n: 'Leather', ar: 12, med: 0, spd: 0, dur: 35, repair: 'tailoring' },
  studded:  { n: 'Studded leather', ar: 16, med: .10, spd: 0, dur: 40, repair: 'tailoring' },
  bone:     { n: 'Bone', ar: 22, med: .15, spd: .01, dur: 45, repair: 'tailoring' },
  ringmail: { n: 'Ringmail', ar: 20, med: .15, spd: .02, dur: 45, repair: 'blacksmithy' },
  chain:    { n: 'Chainmail', ar: 23, med: .20, spd: .03, dur: 50, repair: 'blacksmithy' },
  plate:    { n: 'Platemail', ar: 30, med: .35, spd: .06, dur: 50, repair: 'blacksmithy' },
  helm:     { n: 'Helmet', ar: 24, med: .30, spd: 0, dur: 45, repair: 'blacksmithy' },
  dragon:   { n: 'Dragon scale', ar: 35, med: .25, spd: .03, dur: 60, repair: 'blacksmithy' },
  shield:   { n: 'Shield', ar: 0, med: 0, spd: 0, dur: 50, repair: 'blacksmithy' },
  jewelry:  { n: 'Jewelry', ar: 0, med: 0, spd: 0, dur: 0, repair: null } };

/* ---------------- materials ---------------- */
// metals reuse SF.METAL (ores, ingots, smelting, mining gates); these are their ARMOR multipliers (spec §8 initial balance)
EQ.METAL_ARMOR = {
  iron:        { wt: 1.00, prot: 1.00, dur: 1.00, val: 1.0 },
  dull_copper: { wt: 1.00, prot: 1.02, dur: 1.10, val: 1.2 },
  shadow_iron: { wt: 1.05, prot: 1.05, dur: 1.25, val: 1.4 },
  copper:      { wt: 0.95, prot: 1.08, dur: 1.05, val: 1.5 },
  bronze:      { wt: 0.98, prot: 1.12, dur: 1.20, val: 1.8 },
  golden:      { wt: 1.30, prot: 1.10, dur: 0.90, val: 2.5 },
  agapite:     { wt: 0.90, prot: 1.18, dur: 1.25, val: 3.0 },
  verite:      { wt: 0.88, prot: 1.24, dur: 1.35, val: 3.5 },
  valorite:    { wt: 1.10, prot: 1.32, dur: 1.50, val: 4.5 },
  mithril:     { wt: 0.45, prot: 1.22, dur: 1.30, val: 6.0 } };
// hides and organics for Tailoring. item: the resource consumed; gate: Tailoring needed to work it; res: future elemental resistance
EQ.HIDES = {
  regular: { n: 'Regular', item: 'hide', gate: 0, wt: 1.00, prot: 1.00, dur: 1.00, val: 1.0, col: '#9a6a40' },
  thick:   { n: 'Thick', item: 'hide_thick', gate: 30, wt: 1.10, prot: 1.06, dur: 1.15, val: 1.3, col: '#6e4a2c' },
  wolf:    { n: 'Wolf', item: 'hide_wolf', gate: 40, wt: 0.92, prot: 1.05, dur: 1.05, val: 1.4, col: '#8c8a80', res: { cold: .05 } },
  spined:  { n: 'Spined', item: 'hide_spined', gate: 55, wt: 0.95, prot: 1.12, dur: 1.10, val: 1.8, col: '#5a7a4a', res: { poison: .05 } },
  horned:  { n: 'Horned', item: 'hide_horned', gate: 65, wt: 1.00, prot: 1.18, dur: 1.20, val: 2.3, col: '#a0603a', res: { fire: .05 } },
  troll:   { n: 'Troll', item: 'hide_troll', gate: 70, wt: 1.15, prot: 1.20, dur: 1.35, val: 2.6, col: '#5e6e52' },
  barbed:  { n: 'Barbed', item: 'hide_barbed', gate: 80, wt: 1.00, prot: 1.24, dur: 1.25, val: 3.2, col: '#6a3a5a', res: { energy: .05 } },
  dragon:  { n: 'Dragon', item: 'hide_dragon', gate: 95, wt: 0.85, prot: 1.35, dur: 1.50, val: 6.0, col: '#8a2a22', res: { fire: .10 }, rare: true } };
EQ.FIXED = {
  cloth:       { n: 'Cloth', wt: 1, prot: 1, dur: 1, val: 1, col: '#c8bca0' },
  bone:        { n: 'Bone', wt: 1, prot: 1, dur: 1, val: 1, col: '#e0d6bc' },
  dragonscale: { n: 'Dragon scale', wt: 1, prot: 1, dur: 1, val: 1, col: '#9a2c24', rare: true } };
EQ.hideItem = m => (EQ.HIDES[m] || EQ.HIDES.regular).item;
/* one multiplier record for any material key: metal, hide, wood or fixed */
EQ.mat = m => {
  if (!m) return { wt: 1, prot: 1, dur: 1, val: 1 };
  if (EQ.METAL_ARMOR[m]) return EQ.METAL_ARMOR[m];
  if (EQ.HIDES[m]) return EQ.HIDES[m];
  if (EQ.FIXED[m]) return EQ.FIXED[m];
  if (SF.WOOD && SF.WOOD[m]) return { wt: SF.WOOD[m].mass, prot: 1, dur: SF.WOOD[m].dur, val: 1 + (SF.WOOD[m].work || 0) / 40 };
  return { wt: 1, prot: 1, dur: 1, val: 1 };
};
EQ.matColor = m => (SF.METAL[m] && SF.METAL[m].col) || (EQ.HIDES[m] && EQ.HIDES[m].col) || (EQ.FIXED[m] && EQ.FIXED[m].col) || (SF.WOOD && SF.WOOD[m] && SF.WOOD[m].col) || '#9aa0a8';
EQ.matLabel = m => SF.METAL[m] ? SF.METAL[m].n : EQ.HIDES[m] ? (m === 'regular' ? 'Regular leather' : EQ.HIDES[m].n + (m === 'wolf' || m === 'troll' || m === 'dragon' ? ' hide' : ' leather')) : EQ.FIXED[m] ? EQ.FIXED[m].n : SF.matName(m) || '';
// crafting quality (configurable): exceptional pieces protect and last a little more; never so much that normal work is trash
EQ.QUALITY = { low: { n: 'Poor', prot: .92, dur: .85, val: .7 }, normal: { n: 'Normal', prot: 1, dur: 1, val: 1 }, exceptional: { n: 'Exceptional', prot: 1.08, dur: 1.10, val: 1.5 } };
EQ.qual = it => EQ.QUALITY[it && it.quality] || EQ.QUALITY.normal;

/* ---------------- resources ---------------- */
for (const k in EQ.HIDES) if (k !== 'regular') {
  const H = EQ.HIDES[k], nm = k === 'wolf' || k === 'troll' || k === 'dragon' ? H.n + ' hide' : H.n + ' leather';
  SF.ITEMS[H.item] = { id: H.item, n: nm, kg: .6, stack: 1, cat: 'hide', hide: k, trade: true }; SF.PRICES[H.item] = Math.round(4 * H.val);
}
Object.assign(SF.ITEMS.hide, { hide: 'regular' });
SF.ITEMS.bone = { id: 'bone', n: 'Bone', kg: .4, stack: 1, cat: 'hide', trade: true }; SF.PRICES.bone = 3;
SF.ITEMS.dragonscale = { id: 'dragonscale', n: 'Dragon scale', kg: .3, stack: 1, cat: 'hide', trade: true, rare: true }; SF.PRICES.dragonscale = 120;

/* ---------------- equipment definitions ---------------- */
// p(id, fam, slot, name, wt (weight units), str, dex, val, extra). AR comes from the family and the slot's coverage unless extra.ar is set.
const look = (id, slot) => ({ asset: 'eq.' + id, layer: EQ.SLOT_LAYER[slot] || null, tint: true, bodies: ['human'], dirs: 8, anims: ['idle', 'walk', 'run', 'attack', 'cast', 'die'] });
const DEFS = [];
const p = (id, fam, slot, n, wt, str, dex, val, x) => DEFS.push(Object.assign({ id, fam, slot, base: n, n: n[0].toUpperCase() + n.slice(1), wt, str: str || 0, dex: dex || 0, val }, x || {}));
// Cloth (Tailoring): minimal protection, no meditation penalty
p('cloth_cap', 'cloth', 'head', 'cloth cap', 1, 0, 0, 8, { prim: 'fixed', mat: 'cloth', cat: 'armor' });
p('shirt', 'cloth', 'shirt', 'shirt', 1, 0, 0, 10, { prim: 'fixed', mat: 'cloth', cat: 'clothing', icon: 'clothvest' });
p('trousers', 'cloth', 'trousers', 'trousers', 1, 0, 0, 10, { prim: 'fixed', mat: 'cloth', cat: 'clothing' });
p('robe', 'cloth', 'robe', 'robe', 2, 0, 0, 24, { prim: 'fixed', mat: 'cloth', cat: 'clothing' });
p('cloak', 'cloth', 'cloak', 'cloak', 2, 0, 0, 22, { prim: 'fixed', mat: 'cloth', cat: 'clothing' });
p('cloth_gloves', 'cloth', 'hands', 'cloth gloves', .5, 0, 0, 8, { prim: 'fixed', mat: 'cloth', cat: 'armor' });
p('tabard', 'cloth', 'tunic', 'tabard', 1, 0, 0, 16, { prim: 'fixed', mat: 'cloth', cat: 'clothing' });
// Leather (Tailoring, any hide): low weight, no meditation or Dexterity penalty
p('leather_cap', 'leather', 'head', 'leather cap', 1, 0, 0, 14, { prim: 'hide', cat: 'armor' });
p('leather_gorget', 'leather', 'neck', 'leather gorget', 1, 0, 0, 14, { prim: 'hide', cat: 'armor' });
p('leather_tunic', 'leather', 'chest', 'leather tunic', 6, 0, 0, 40, { prim: 'hide', cat: 'armor', icon: 'leather' });
p('leather_sleeves', 'leather', 'arms', 'leather sleeves', 2, 0, 0, 26, { prim: 'hide', cat: 'armor' });
p('leather_gloves', 'leather', 'hands', 'leather gloves', 1, 0, 0, 16, { prim: 'hide', cat: 'armor' });
p('leather_leggings', 'leather', 'legs', 'leather leggings', 3, 0, 0, 30, { prim: 'hide', cat: 'armor' });
p('boots', 'leather', 'feet', 'boots', 2, 0, 0, 18, { prim: 'hide', cat: 'clothing' });
p('shoes', 'leather', 'feet', 'shoes', 1, 0, 0, 10, { prim: 'hide', cat: 'clothing' });
p('belt', 'leather', 'belt', 'belt', .5, 0, 0, 8, { prim: 'hide', cat: 'clothing' });
// Studded leather (Tailoring, hide + metal rivets as studs): moderate meditation interference
p('studded_gorget', 'studded', 'neck', 'studded gorget', 1.5, 10, 0, 22, { prim: 'hide', sec: 'metal', cat: 'armor' });
p('studded_tunic', 'studded', 'chest', 'studded tunic', 8, 20, 0, 60, { prim: 'hide', sec: 'metal', cat: 'armor' });
p('studded_sleeves', 'studded', 'arms', 'studded sleeves', 4, 15, 0, 38, { prim: 'hide', sec: 'metal', cat: 'armor' });
p('studded_gloves', 'studded', 'hands', 'studded gloves', 1, 10, 0, 22, { prim: 'hide', sec: 'metal', cat: 'armor' });
p('studded_leggings', 'studded', 'legs', 'studded leggings', 5, 15, 0, 44, { prim: 'hide', sec: 'metal', cat: 'armor' });
// Bone (Tailoring, bones + leather): monster-derived
p('bone_helm', 'bone', 'head', 'bone helmet', 3, 20, 0, 34, { prim: 'fixed', mat: 'bone', cat: 'armor' });
p('bone_chest', 'bone', 'chest', 'bone chest armor', 6, 40, -1, 80, { prim: 'fixed', mat: 'bone', cat: 'armor' });
p('bone_arms', 'bone', 'arms', 'bone arms', 2, 30, 0, 48, { prim: 'fixed', mat: 'bone', cat: 'armor' });
p('bone_gloves', 'bone', 'hands', 'bone gloves', 2, 25, 0, 30, { prim: 'fixed', mat: 'bone', cat: 'armor' });
p('bone_legs', 'bone', 'legs', 'bone leggings', 3, 35, 0, 54, { prim: 'fixed', mat: 'bone', cat: 'armor' });
// Ringmail (Blacksmithing): affordable metal between studded leather and chainmail
p('ringmail_tunic', 'ringmail', 'chest', 'ringmail tunic', 10, 30, -1, 55, { prim: 'metal', cat: 'armor' });
p('ringmail_sleeves', 'ringmail', 'arms', 'ringmail sleeves', 4, 20, 0, 35, { prim: 'metal', cat: 'armor' });
p('ringmail_gloves', 'ringmail', 'hands', 'ringmail gloves', 2, 20, 0, 22, { prim: 'metal', cat: 'armor' });
p('ringmail_leggings', 'ringmail', 'legs', 'ringmail leggings', 6, 25, 0, 40, { prim: 'metal', cat: 'armor' });
// Chainmail (Blacksmithing)
p('chain_coif', 'chain', 'head', 'chainmail coif', 2, 20, 0, 30, { prim: 'metal', cat: 'armor' });
p('chain_tunic', 'chain', 'chest', 'chainmail tunic', 12, 40, -2, 80, { prim: 'metal', cat: 'armor', icon: 'chain' });
p('chain_leggings', 'chain', 'legs', 'chainmail leggings', 8, 35, -1, 60, { prim: 'metal', cat: 'armor' });
// Platemail (Blacksmithing): very high protection, Strength requirements, Dexterity penalties
p('plate_gorget', 'plate', 'neck', 'plate gorget', 2, 30, 0, 35, { prim: 'metal', cat: 'armor' });
p('plate_chest', 'plate', 'chest', 'plate chest', 14, 45, -2, 95, { prim: 'metal', cat: 'armor', icon: 'plate' });
p('plate_arms', 'plate', 'arms', 'plate arms', 5, 40, -1, 60, { prim: 'metal', cat: 'armor' });
p('plate_gauntlets', 'plate', 'hands', 'plate gauntlets', 2, 30, -1, 40, { prim: 'metal', cat: 'armor' });
p('plate_leggings', 'plate', 'legs', 'plate leggings', 7, 45, -1, 70, { prim: 'metal', cat: 'armor' });
// Helmets (Blacksmithing): each its own head AR, weight and meditation interference
p('bascinet', 'helm', 'head', 'bascinet', 3, 10, 0, 30, { prim: 'metal', cat: 'armor', ar: 18, med: .02 });
p('open_helm', 'helm', 'head', 'open helm', 4, 25, 0, 38, { prim: 'metal', cat: 'armor', ar: 22, med: .03 });
p('norse_helm', 'helm', 'head', 'norse helm', 5, 35, 0, 44, { prim: 'metal', cat: 'armor', ar: 26, med: .04 });
p('closed_helm', 'helm', 'head', 'closed helm', 5, 40, -1, 48, { prim: 'metal', cat: 'armor', ar: 28, med: .05 });
p('plate_helm', 'helm', 'head', 'plate helm', 5, 40, -1, 50, { prim: 'metal', cat: 'armor', ar: 30, med: .05 });
p('great_helm', 'helm', 'head', 'great helm', 7, 50, -1, 60, { prim: 'metal', cat: 'armor', ar: 32, med: .06 });
// Dragon scale (Blacksmithing, dragon scales + leather straps): prepared for dragon hunting; never sold by vendors
p('dragon_helm', 'dragon', 'head', 'dragon helm', 4, 35, 0, 220, { prim: 'fixed', mat: 'dragonscale', cat: 'armor', rare: true });
p('dragon_chest', 'dragon', 'chest', 'dragon chest', 10, 50, -1, 520, { prim: 'fixed', mat: 'dragonscale', cat: 'armor', rare: true });
p('dragon_arms', 'dragon', 'arms', 'dragon arms', 4, 40, 0, 300, { prim: 'fixed', mat: 'dragonscale', cat: 'armor', rare: true });
p('dragon_gloves', 'dragon', 'hands', 'dragon gloves', 2, 30, 0, 180, { prim: 'fixed', mat: 'dragonscale', cat: 'armor', rare: true });
p('dragon_legs', 'dragon', 'legs', 'dragon leggings', 6, 45, -1, 360, { prim: 'fixed', mat: 'dragonscale', cat: 'armor', rare: true });
// Shields (Parrying): carpentry for wood, blacksmithing for metal. ar = shield AR before material and wear
p('wooden_shield', 'shield', 'shield', 'wooden shield', 5, 20, 0, 35, { prim: 'wood', cat: 'shield', ar: 8, repair: 'carpentry' });
p('metal_shield', 'shield', 'shield', 'metal shield', 6, 30, 0, 60, { prim: 'metal', cat: 'shield', ar: 11 });
p('kite_shield', 'shield', 'shield', 'kite shield', 7, 40, -1, 90, { prim: 'metal', cat: 'shield', ar: 14 });
p('heater_shield', 'shield', 'shield', 'heater shield', 8, 50, -1, 120, { prim: 'metal', cat: 'shield', ar: 18 });
// Accessories: no statistics in V1 (no affixes); weight and value only
p('ring', 'jewelry', 'ring', 'ring', .1, 0, 0, 20, { prim: 'metal', cat: 'jewelry' });
p('bracelet', 'jewelry', 'bracelet', 'bracelet', .2, 0, 0, 24, { prim: 'metal', cat: 'jewelry' });
p('necklace', 'jewelry', 'necklace', 'necklace', .2, 0, 0, 26, { prim: 'metal', cat: 'jewelry' });
for (const d of DEFS) {
  const F = EQ.FAMILIES[d.fam];
  Object.assign(d, { kg: d.wt / SF.WU, trade: true, look: look(d.id, d.slot), dur: d.dur || F.dur });
  if (d.prim === 'fixed') { d.fixedMat = d.mat; delete d.prim; }
  if (d.med === undefined) d.med = F.med * EQ.coverage(d.slot);
  d.spd = F.spd * EQ.coverage(d.slot);
  SF.ITEMS[d.id] = d; SF.PRICES[d.id] = d.val;
}
EQ.DEFS = DEFS;
// the existing pine buckler joins the shield family
Object.assign(SF.ITEMS.buckler, { fam: 'shield', ar: 7, str: 0, dex: 0, val: 40, dur: 100, wt: SF.ITEMS.buckler.kg * SF.WU, look: look('buckler', 'shield'), repair: 'carpentry' });
// the respawn tunic is outer clothing now (the old single armor slot is gone)
Object.assign(SF.ITEMS.garment, { slot: 'tunic' }); delete SF.ITEMS.garment.armor;
// weapons go in the main hand and carry future appearance data
for (const k in SF.ITEMS) { const d = SF.ITEMS[k]; if (d.slot === 'weapon' && !d.look) d.look = look(k, 'weapon'); }
// v0.24 one-piece suits: kept so old saves, chests and corpses can be read and converted; no longer worn, sold or crafted
EQ.LEGACY = { clothvest: ['shirt', 'trousers'], leather: ['leather_cap', 'leather_gorget', 'leather_tunic', 'leather_sleeves', 'leather_gloves', 'leather_leggings'],
  chain: ['chain_coif', 'chain_tunic', 'chain_leggings'], plate: ['plate_gorget', 'plate_chest', 'plate_arms', 'plate_gauntlets', 'plate_leggings'] };
for (const k in EQ.LEGACY) { const d = SF.ITEMS[k]; d.legacy = true; delete d.slot; d.n = d.n + ' (old)'; if (d.base) d.base = d.base + ' (old)'; }
SF.WEARABLE = id => !!SF.ITEMS[id] && ['weapon', 'shield', 'armor', 'clothing'].includes(SF.ITEMS[id].cat) && SF.ITEMS[id].trade;
SF.QUALITY_CATS.clothing = 1;

/* ---------------- material-aware names ---------------- */
const baseMatOf = SF.matOf;
SF.matOf = it => { if (!it) return null; const d = SF.ITEMS[it.id]; if (d && d.fam && !it.material) return d.prim === 'metal' ? 'iron' : d.prim === 'hide' ? 'regular' : d.prim === 'wood' ? 'pine' : d.fixedMat || null; return baseMatOf(it); };
const baseMatName = SF.matName;
SF.matName = m => EQ.HIDES[m] ? (m === 'regular' ? '' : EQ.HIDES[m].n) : EQ.FIXED[m] ? EQ.FIXED[m].n : baseMatName(m);
const baseItemName = SF.itemName;
SF.itemName = it => {
  const d = SF.ITEMS[it.id]; if (!d || !d.fam) return baseItemName(it);
  if (d.fixedMat || !d.prim) return d.n;
  const m = SF.matOf(it), pre = SF.matName(m); const s = (pre ? pre + ' ' : '') + d.base; return s[0].toUpperCase() + s.slice(1);
};
EQ.fullName = it => { const q = it.quality === 'exceptional' ? 'Exceptional ' : it.quality === 'low' ? 'Poor ' : ''; return q + SF.itemName(it); };

/* ---------------- instances: one definition, many individual items ---------------- */
EQ.isGear = id => !!(SF.ITEMS[id] && SF.ITEMS[id].fam);
EQ.maxDur = (id, mat, quality) => { const d = SF.ITEMS[id]; if (!d.dur) return undefined; return Math.max(1, Math.round(d.dur * EQ.mat(mat).dur * (EQ.QUALITY[quality] || EQ.QUALITY.normal).dur)); };
/* every field an equipment instance carries: definition id, material, secondary material, quality, durability, crafter, origin */
EQ.fields = (id, o) => {
  o = o || {}; const d = SF.ITEMS[id]; const f = { quality: o.quality || 'normal', origin: o.origin || 'unknown' };
  const m = o.material || (d.fixedMat ? null : SF.matOf({ id })); if (m && !d.fixedMat) f.material = m;
  if (d.sec) f.sec = o.sec || 'iron';
  const M = EQ.mat(d.fixedMat || m); if (M.wt !== 1) f.kgMul = M.wt;
  const om = EQ.maxDur(id, d.fixedMat || m, f.quality); if (om) { f.omax = om; f.maxc = om; f.cond = o.cond !== undefined ? Math.min(om, o.cond) : om; }
  if (o.creatorName) { f.creatorId = o.creatorId || o.creatorName; f.creatorName = o.creatorName; }
  return f;
};
EQ.make = (id, o) => {
  const d = SF.ITEMS[id]; if (!d) throw new Error('unknown item ' + id);
  if (d.fam) return SF.newItem(id, 1, EQ.fields(id, o));
  if (SF.WEARABLE(id) && !d.stack) return SF.newItem(id, 1, { cond: 100, maxc: 100, omax: 100, origin: (o && o.origin) || 'unknown' });
  return SF.newItem(id, (o && o.qty) || 1);
};

/* ---------------- per-piece numbers ---------------- */
const broken = it => it.cond !== undefined && it.cond <= 0;
EQ.broken = broken;
/* AR of a region this piece covers, before wear */
EQ.baseRegionAR = it => { const d = SF.ITEMS[it.id]; if (!d || !d.fam || d.cat === 'shield' || d.cat === 'jewelry') return 0; const a = d.ar !== undefined ? d.ar : EQ.FAMILIES[d.fam].ar; return a * EQ.mat(d.fixedMat || SF.matOf(it)).prot * EQ.qual(it).prot; };
/* after wear: broken gives nothing; under 20 % condition the badly-worn −15 % (SF.condFactor) */
EQ.regionAR = it => broken(it) ? 0 : EQ.baseRegionAR(it) * SF.condFactor(it.cond, it.maxc) + (it.magic && it.magic.k === 'def' ? it.magic.l : 0);   // + a magic piece's defense level
/* the piece's share of the suit: what the tooltip calls its protection (region AR × body coverage) */
EQ.protection = it => { const d = SF.ITEMS[it.id]; return d && d.slot ? EQ.regionAR(it) * EQ.coverage(d.slot) : 0; };
EQ.baseProtection = it => { const d = SF.ITEMS[it.id]; return d && d.slot ? EQ.baseRegionAR(it) * EQ.coverage(d.slot) : 0; };
EQ.shieldAR = it => { if (!it || broken(it)) return 0; const d = SF.ITEMS[it.id]; const a = d.ar !== undefined ? d.ar : (SF.SHIELD_AR[it.id] || 7); return a * EQ.mat(SF.matOf(it)).prot * EQ.qual(it).prot * SF.condFactor(it.cond, it.maxc); };
EQ.strReq = it => { const d = SF.ITEMS[it.id]; if (!d) return 0; if (d.wpn) return SF.WEAPONS[d.wpn].str || 0; return d.str || 0; };
EQ.value = it => { const d = SF.ITEMS[it.id]; if (!d) return 0; const base = d.val || SF.PRICES[it.id] || 1; if (!d.fam) return base * (it.qty || 1);
  const c = it.cond === undefined ? 1 : .5 + .5 * clamp(0, 1, it.cond / (it.maxc || 1)); return Math.round(base * EQ.mat(d.fixedMat || SF.matOf(it)).val * EQ.qual(it).val * c); };
SF.itemWt = it => SF.itemKg(it) * SF.WU;
SF.repairSkill = id => { const d = SF.ITEMS[id]; if (d.repair) return d.repair; if (d.fam && EQ.FAMILIES[d.fam].repair) return EQ.FAMILIES[d.fam].repair;
  if (d.wpn === 'shortbow' || d.wpn === 'crossbow' || d.wpn === 'heavycrossbow') return 'bowcraft'; if (d.armor === 'cloth' || d.armor === 'leather') return 'tailoring'; return 'blacksmithy'; };

/* ---------------- character totals ---------------- */
EQ.equipKg = ch => { let k = 0; for (const s in ch.equip || {}) if (ch.equip[s]) k += SF.itemKg(ch.equip[s]) + (ch.equip[s].items ? SF.containerKg(ch.equip[s]) : 0); return k; };
EQ.totalWt = ch => (SF.containerKg(ch.pack) + EQ.equipKg(ch)) * SF.WU;
EQ.capWt = ch => SF.carryCap(ch);
/* the pack's room left (kg) for addItem/transfer: equipped weight is counted, so moving gear in or out never changes the total */
EQ.capFor = ch => ({ slots: Infinity, kg: SF.carryKg(ch) - EQ.equipKg(ch) });
EQ.ENCUMBRANCE = [
  { upTo: .75, n: 'Unburdened', stam: 1, speed: 1, run: true },
  { upTo: 1.00, n: 'Burdened', stam: 1.5, speed: 1, run: true },            // more stamina per sprinted second
  { upTo: 1.25, n: 'Overloaded', stam: 1.5, speed: .6, run: false },        // slower, no running
  { upTo: Infinity, n: 'Immobile', stam: 1.5, speed: 0, run: false }];      // drop something to move
EQ.encumbrance = ch => { const wt = EQ.totalWt(ch), cap = EQ.capWt(ch), ratio = cap > 0 ? wt / cap : Infinity; let i = 0; while (ratio > EQ.ENCUMBRANCE[i].upTo + 1e-9) i++; return Object.assign({ wt, cap, ratio, stage: i }, EQ.ENCUMBRANCE[i]); };
EQ.wouldFit = (ch, addKg) => EQ.totalWt(ch) + addKg * SF.WU <= EQ.capWt(ch) + 1e-9;

/* effective attributes and armor, computed fresh from base attributes and what is worn (never written into the base values) */
EQ.effective = ch => {
  const e = { str: ch.str, dex: ch.dex, int: ch.int, dexMod: 0, med: 0, spd: 0, ar: 0, eqWt: EQ.equipKg(ch) * SF.WU, region: {}, regionItem: {}, broken: [] };
  for (const g in EQ.REGIONS) { e.region[g] = 0; e.regionItem[g] = null; }
  for (const s in ch.equip || {}) {
    const it = ch.equip[s]; if (!it) continue; const d = SF.ITEMS[it.id]; if (!d) continue;
    e.dexMod += d.dex || 0; e.med += d.med || 0; e.spd += d.spd || 0;          // penalties stay while a piece is worn, broken or not
    if (broken(it)) { e.broken.push(s); continue; }
    const a = EQ.regionAR(it); if (!a || !EQ.SLOT[s]) continue;
    for (const g of EQ.SLOT[s].regions) if (a > e.region[g]) { e.region[g] = a; e.regionItem[g] = it; }   // layers: the strongest piece over a region counts, never the sum
  }
  for (const g in EQ.REGIONS) e.ar += EQ.REGIONS[g] * e.region[g];
  e.dex = Math.max(1, ch.dex + e.dexMod); e.med = clamp(0, 1, e.med); e.spd = clamp(0, .5, e.spd); e.ar = r1(e.ar);
  return e;
};
/* the armor a blow meets on one region: whole-number AR for the mitigation roll, and the piece that takes the wear */
EQ.regionArmor = (ch, g) => { let best = 0, item = null; for (const s in ch.equip || {}) { const it = ch.equip[s]; if (!it || !EQ.SLOT[s] || !EQ.SLOT[s].regions.includes(g)) continue; const a = EQ.regionAR(it); if (a > best) { best = a; item = it; } } return { ar: Math.round(best), item, region: g }; };
/* transient modifiers the rest of the game reads; recomputed every time, so loading a save can never stack them */
EQ.refresh = ch => { const e = EQ.effective(ch); ch.eqDex = e.dexMod; if (ch.stam !== undefined) ch.stam = Math.min(ch.stam, SF.maxStam(ch)); return e; };
/* appearance for the future layered sprite renderer: ordered layers and a signature that changes only when the look does */
EQ.appearance = ch => { const out = []; for (const s in ch.equip || {}) { const it = ch.equip[s]; if (!it) continue; const d = SF.ITEMS[it.id]; const lk = d && d.look; if (!lk || !lk.layer) continue; out.push({ slot: s, layer: lk.layer, z: EQ.RENDER_LAYERS.indexOf(lk.layer), asset: lk.asset, tint: lk.tint ? EQ.matColor(d.fixedMat || SF.matOf(it)) : null, uid: it.uid }); } return out.sort((a, b) => a.z - b.z); };
EQ.signature = ch => EQ.SLOT_IDS.map(s => { const it = ch.equip && ch.equip[s]; return it ? it.uid + (broken(it) ? 'x' : '') : '-'; }).join('|');

/* ---------------- validated commands (atomic; the shape an authoritative server would accept) ---------------- */
// Each command takes the actor state and plain arguments and returns { ok, reason, ... }. On any failure the actor's pack and
// equipment are restored exactly (same item objects, same quantities), so nothing is lost or duplicated.
EQ.snapshot = ch => ({ items: ch.pack.items.slice(), qty: ch.pack.items.map(i => i.qty), equip: Object.assign({}, ch.equip), ver: ch.pack.ver });
EQ.restore = (ch, s) => { ch.pack.items.splice(0, ch.pack.items.length, ...s.items); s.items.forEach((it, i) => { it.qty = s.qty[i]; }); for (const k of Object.keys(ch.equip)) delete ch.equip[k]; Object.assign(ch.equip, s.equip); ch.pack.ver = s.ver + 1; };
EQ.tx = (ch, fn) => {
  const s = EQ.snapshot(ch); let r;
  try { r = fn(); } catch (e) { r = { ok: false, reason: 'internal error: ' + e.message }; }
  if (r && r.ok) { const a = EQ.audit(ch); if (!a.ok) r = { ok: false, reason: 'duplicate item ' + a.dups.join(',') }; }
  if (!r || !r.ok) { EQ.restore(ch, s); return r || { ok: false, reason: 'failed' }; }
  ch.pack.ver++; return r;
};
/* every item instance exists exactly once across pack (nested), bank and equipment */
EQ.audit = (ch, extra) => {
  const seen = new Set(), dups = []; const see = it => { if (!it) return; if (seen.has(it.uid)) dups.push(it.uid); seen.add(it.uid); if (it.items) it.items.forEach(see); };
  (ch.pack ? ch.pack.items : []).forEach(see); (ch.bank ? ch.bank.items : []).forEach(see); for (const s in ch.equip || {}) see(ch.equip[s]); for (const c of extra || []) c.items.forEach(see);
  return { ok: !dups.length, dups };
};
EQ.find = (ch, uid) => { uid = +uid; const i = ch.pack.items.findIndex(it => it.uid === uid); if (i >= 0) return { where: 'pack', item: ch.pack.items[i], index: i }; for (const s in ch.equip || {}) if (ch.equip[s] && ch.equip[s].uid === uid) return { where: 'equip', slot: s, item: ch.equip[s] }; return null; };
EQ.canEquip = (ch, it, slot) => {
  const d = it && SF.ITEMS[it.id]; if (!d) return { ok: false, reason: 'unknown item' };
  if (!d.slot) return { ok: false, reason: (d.legacy ? 'that old suit has to be converted first' : SF.itemName(it) + ' cannot be worn') };
  slot = slot || d.slot; if (!EQ.SLOT[slot]) return { ok: false, reason: 'no such equipment slot' };
  if (slot !== d.slot) return { ok: false, reason: `${SF.itemName(it)} does not go in the ${EQ.SLOT[slot].n.toLowerCase()} slot` };
  const need = EQ.strReq(it); if (need > ch.str) return { ok: false, reason: `you are not strong enough (${SF.itemName(it)} needs ${need} Strength)` };
  return { ok: true, slot };
};
const twoHanded = it => { const w = it && SF.weaponOf(it); return !!(w && w.two); };
EQ.twoHanded = twoHanded;
/* equipItem: from the pack into its slot. Displaced pieces (the slot's occupant; the shield for a two-handed weapon; a two-handed
   weapon for a shield) go back to the pack. Weight never changes, so no capacity check is needed. */
EQ.equipItem = (ch, a) => EQ.tx(ch, () => {
  const f = EQ.find(ch, a.uid); if (!f || f.where !== 'pack') return { ok: false, reason: 'that item is not in your backpack' };
  const it = f.item, v = EQ.canEquip(ch, it, a.slot); if (!v.ok) return v; const slot = v.slot, out = [];
  if (slot === 'weapon' && twoHanded(it) && ch.equip.shield) out.push('shield');
  if (slot === 'shield' && twoHanded(ch.equip.weapon)) out.push('weapon');
  if (ch.equip[slot]) out.push(slot);
  ch.pack.items.splice(ch.pack.items.indexOf(it), 1);
  const displaced = [];
  for (const s of out) { const o = ch.equip[s]; ch.equip[s] = null; ch.pack.items.push(o); displaced.push({ slot: s, uid: o.uid }); }
  ch.equip[slot] = it;
  return { ok: true, slot, displaced };
});
EQ.unequipItem = (ch, a) => EQ.tx(ch, () => { const it = ch.equip[a.slot]; if (!it) return { ok: false, reason: 'nothing is worn there' }; ch.equip[a.slot] = null; ch.pack.items.push(it); return { ok: true, uid: it.uid, slot: a.slot }; });
/* moveItem / pickupItem: container to container through the conserving transfer, with the carrying-capacity check when cap is given */
EQ.moveItem = (from, to, a) => SF.transfer(from, to, +a.uid, a.qty, { cap: a.cap, fromVer: a.fromVer });
EQ.pickupItem = (ch, from, a) => { if (a.qty !== undefined && !(a.qty > 0)) return { ok: false, reason: 'nothing to take' }; return SF.transfer(from, ch.pack, +a.uid, a.qty, { cap: EQ.capFor(ch) }); };
/* dropItem: out of the pack or a slot; place(item) puts it in the world and must return true, or the drop is undone */
EQ.dropItem = (ch, a, place) => EQ.tx(ch, () => {
  const f = EQ.find(ch, a.uid); if (!f) return { ok: false, reason: 'item is gone' }; const it = f.item, d = SF.ITEMS[it.id];
  if (!d.trade) return { ok: false, reason: 'that cannot be dropped' };
  const q = Math.min(it.qty, Math.max(1, Math.floor(a.qty || it.qty))); let out = it;
  if (q < it.qty) { out = SF.newItem(it.id, q, EQ.copyFields(it)); it.qty -= q; }
  else if (f.where === 'pack') ch.pack.items.splice(ch.pack.items.indexOf(it), 1); else ch.equip[f.slot] = null;
  if (place && place(out) === false) return { ok: false, reason: 'there is no room to drop it here' };
  return { ok: true, item: out, qty: q, from: f.where === 'equip' ? f.slot : 'pack' };
});
EQ.copyFields = it => { const o = {}; for (const k in it) if (k !== 'uid' && k !== 'qty') o[k] = it[k] && typeof it[k] === 'object' ? JSON.parse(JSON.stringify(it[k])) : it[k]; return o; };
/* splitStack / mergeStacks inside one container */
EQ.splitStack = (c, a) => { const it = c.items.find(i => i.uid === +a.uid); const q = Math.floor(a.qty); if (!it) return { ok: false, reason: 'item is gone' }; if (!SF.ITEMS[it.id].stack || !(q >= 1 && q < it.qty)) return { ok: false, reason: 'cannot split that' };
  const n = SF.newItem(it.id, q, EQ.copyFields(it)); it.qty -= q; c.items.splice(c.items.indexOf(it) + 1, 0, n); c.ver++; return { ok: true, uid: n.uid }; };
EQ.mergeStacks = (c, a) => { const f = c.items.find(i => i.uid === +a.from), t = c.items.find(i => i.uid === +a.into); if (!f || !t || f === t) return { ok: false, reason: 'item is gone' }; if (!SF.canStack(f, t)) return { ok: false, reason: 'those do not stack' };
  t.qty += f.qty; c.items.splice(c.items.indexOf(f), 1); c.ver++; return { ok: true, uid: t.uid, qty: t.qty }; };
/* tidy: merge every pair of stacks that could stack (after splits) */
EQ.mergeAll = c => { let n = 0; for (let i = 0; i < c.items.length; i++) for (let j = c.items.length - 1; j > i; j--) if (SF.canStack(c.items[i], c.items[j])) { c.items[i].qty += c.items[j].qty; c.items.splice(j, 1); n++; } if (n) c.ver++; return n; };
EQ.craftItem = (ch, a) => { const r = SF.RECIPE[a.rid]; if (!r) return { ok: false, reason: 'unknown recipe' }; const plan = SF.craftPlan(ch, ch.pack, r, a.mat, a.sec); return SF.craftAttempt(ch, ch.pack, plan, a.rng, a.cap || EQ.capFor(ch), a.opt || {}); };
EQ.repairItem = (ch, a) => { const f = EQ.find(ch, a.uid); if (!f) return { ok: false, reason: 'item is gone' }; if (!SF.WEARABLE(f.item.id)) return { ok: false, reason: 'that cannot be repaired' }; return SF.repair(f.item, { skill: a.skill, rng: a.rng }); };
EQ.COMMANDS = ['equipItem', 'unequipItem', 'moveItem', 'dropItem', 'pickupItem', 'splitStack', 'mergeStacks', 'craftItem', 'repairItem'];

/* ---------------- crafting: material variants from the shared registries ---------------- */
const baseWorkGate = SF.workGate;
SF.workGate = (r, m) => r.prim === 'hide' ? (EQ.HIDES[m] ? EQ.HIDES[m].gate : 0) : baseWorkGate(r, m);
const baseLineItem = SF.lineItem;
SF.lineItem = (ln, m, s) => ln.form === 'hide' ? { id: EQ.hideItem(m), mat: null } : ln.matchSec ? { id: ln.item, mat: s || 'iron' } : baseLineItem(ln, m);
EQ.recipeMats = r => r.prim === 'metal' ? SF.METALS.map(a => a[0]) : r.prim === 'hide' ? Object.keys(EQ.HIDES) : r.prim === 'wood' ? SF.WOODS.map(a => a[0]) : null;
EQ.recipeSecs = r => r.sec === 'metal' ? SF.METALS.map(a => a[0]) : null;
const baseOutputs = SF.craftOutputs;
SF.craftOutputs = (ch, plan, exceptional, opt, sim) => {
  const r = plan.r, d = SF.ITEMS[r.out]; if (!d.fam || d.stack) return baseOutputs(ch, plan, exceptional, opt, sim);
  const f = EQ.fields(r.out, { material: plan.mat, sec: plan.sec, quality: exceptional ? 'exceptional' : 'normal', origin: 'crafted', creatorId: ch.id || ch.pid || ch.name, creatorName: ch.name });
  if (exceptional && opt && opt.mark && plan.sk >= 100) f.maker = ch.name;
  const M = SF.METAL[plan.mat]; if (M && d.prim === 'metal') { const b = SF.ingotBasis(plan); if (b) f.salvage = { metal: plan.mat, num: b, den: 1 }; }
  return [sim ? Object.assign({ uid: 0, id: r.out, qty: r.qty }, f) : SF.newItem(r.out, r.qty, f)];
};
SF.craftTime = r => r.time || ({ weapon: 2, shield: 2.5, armor: 3, clothing: 2, jewelry: 2 }[SF.ITEMS[r.out].cat] || SF.CRAFT_TIME);
// recipes: [out, skill min, primary qty, extra lines]
const R = [];
const rec = (sub, out, skill, min, station, tool, lines, x) => R.push(Object.assign({ id: out, name: SF.ITEMS[out].n, out, qty: 1, skill, min, station, tool, cat: 'Armor', sub, lines }, x || {}));
const tailorCloth = (out, min, n) => rec('Cloth', out, 'tailoring', min, 'bench', 'sewkit', [{ item: 'cloth', qty: n }], { fixedMat: 'cloth' });
const tailorHide = (sub, out, min, n, extra) => rec(sub, out, 'tailoring', min, 'bench', 'sewkit', [{ form: 'hide', qty: n }].concat(extra || []), { prim: 'hide', defMat: 'regular' });
const smith = (sub, out, min, n, extra) => rec(sub, out, 'blacksmithy', min, 'anvil', 'tongs', [{ form: 'ingot', qty: n }].concat(extra || []), { prim: 'metal', defMat: 'iron' });
tailorCloth('cloth_cap', 0, 2); tailorCloth('shirt', 0, 4); tailorCloth('trousers', 0, 4); tailorCloth('cloth_gloves', 5, 2); tailorCloth('tabard', 10, 5); tailorCloth('cloak', 15, 7); tailorCloth('robe', 20, 8);
tailorHide('Leather', 'leather_cap', 10, 2); tailorHide('Leather', 'leather_gloves', 15, 3); tailorHide('Leather', 'leather_gorget', 20, 4); tailorHide('Leather', 'leather_sleeves', 25, 8);
tailorHide('Leather', 'leather_leggings', 30, 10); tailorHide('Leather', 'leather_tunic', 35, 12); tailorHide('Leather', 'shoes', 5, 2); tailorHide('Leather', 'boots', 15, 4); tailorHide('Leather', 'belt', 5, 2);
for (const [out, min, h, n] of [['studded_gorget', 40, 6, 2], ['studded_gloves', 42, 8, 2], ['studded_sleeves', 48, 10, 4], ['studded_leggings', 52, 12, 4], ['studded_tunic', 55, 14, 6]])
  tailorHide('Studded leather', out, min, h, [{ item: 'rivet', qty: n, matchSec: true }]), Object.assign(R[R.length - 1], { sec: 'metal', defSec: 'iron' });
for (const [out, min, b, h] of [['bone_helm', 55, 4, 4], ['bone_gloves', 58, 4, 2], ['bone_arms', 60, 8, 4], ['bone_legs', 62, 6, 6], ['bone_chest', 65, 10, 6]])
  rec('Bone', out, 'tailoring', min, 'bench', 'sewkit', [{ item: 'bone', qty: b }, { item: 'hide', qty: h }], { fixedMat: 'bone' });
smith('Ringmail', 'ringmail_gloves', 15, 10); smith('Ringmail', 'ringmail_sleeves', 20, 14); smith('Ringmail', 'ringmail_leggings', 25, 16); smith('Ringmail', 'ringmail_tunic', 28, 18);
smith('Chainmail', 'chain_coif', 30, 10); smith('Chainmail', 'chain_leggings', 38, 18); smith('Chainmail', 'chain_tunic', 42, 20);
smith('Platemail', 'plate_gorget', 55, 10); smith('Platemail', 'plate_gauntlets', 58, 12); smith('Platemail', 'plate_arms', 66, 18); smith('Platemail', 'plate_leggings', 68, 20); smith('Platemail', 'plate_chest', 75, 25);
smith('Helmets', 'bascinet', 10, 15); smith('Helmets', 'open_helm', 30, 15); smith('Helmets', 'norse_helm', 40, 15); smith('Helmets', 'closed_helm', 45, 15); smith('Helmets', 'plate_helm', 63, 15); smith('Helmets', 'great_helm', 70, 18);
smith('Shields', 'metal_shield', 25, 14, [{ item: 'strap', qty: 1 }]); smith('Shields', 'kite_shield', 45, 16, [{ item: 'strap', qty: 1 }]); smith('Shields', 'heater_shield', 65, 18, [{ item: 'strap', qty: 2 }]);
rec('Shields', 'wooden_shield', 'carpentry', 10, 'bench', 'knife', [{ form: 'log', qty: 6 }, { item: 'strap', qty: 1 }], { prim: 'wood', defMat: 'pine' });
for (const [out, min, n] of [['dragon_gloves', 85, 8], ['dragon_helm', 87, 10], ['dragon_arms', 90, 14], ['dragon_legs', 92, 18], ['dragon_chest', 95, 22]])
  rec('Dragon scale', out, 'blacksmithy', min, 'anvil', 'tongs', [{ item: 'dragonscale', qty: n }, { item: 'strap', qty: Math.ceil(n / 4) }], { fixedMat: 'dragonscale' });
smith('Accessories', 'ring', 20, 1); smith('Accessories', 'bracelet', 25, 2); smith('Accessories', 'necklace', 30, 2);
// woods: the generic lineItem knows ingots and ores; logs follow the same pattern
const baseLine2 = SF.lineItem; SF.lineItem = (ln, m, s) => ln.form === 'log' ? { id: SF.logId(m), mat: null } : baseLine2(ln, m, s);
// the old one-piece leather suit recipe gives way to the pieces
for (let i = SF.RECIPES.length - 1; i >= 0; i--) if (SF.RECIPES[i].out === 'leather') SF.RECIPES.splice(i, 1);
SF.RECIPES.push(...R); SF.reindexRecipes();
EQ.ARMOR_SUBS = ['Cloth', 'Leather', 'Studded leather', 'Bone', 'Ringmail', 'Chainmail', 'Platemail', 'Helmets', 'Shields', 'Dragon scale', 'Accessories'];

/* ---------------- death: the respawn tunic goes in the tunic slot ---------------- */
SF.deathTransaction = (ch, now, pos) => {
  const corpse = SF.newContainer('corpse', ch.id); corpse.pos = pos; corpse.diedAt = now; corpse.expires = now + SF.CORPSE_LIFE; corpse.name = ch.name;
  const keep = [];
  for (const it of ch.pack.items) (SF.ITEMS[it.id].trade && !it.blessed ? corpse.items : keep).push(it);      // future: blessed items stay
  for (const s of Object.keys(ch.equip)) { const it = ch.equip[s]; if (!it) continue; if (SF.ITEMS[it.id].trade && !it.blessed) { corpse.items.push(it); ch.equip[s] = null; } }
  ch.pack.items = keep; ch.pack.ver++;
  if (!keep.some(i => i.id === 'garment') && !(ch.equip.tunic && ch.equip.tunic.id === 'garment')) { if (!ch.equip.tunic) ch.equip.tunic = SF.newItem('garment', 1); else keep.push(SF.newItem('garment', 1)); }
  if (!keep.some(i => i.id === 'journal')) keep.push(SF.newItem('journal', 1));
  return corpse;
};

/* ---------------- save migration: v0.24 one-slot armor → individual pieces ---------------- */
EQ.MIGRATION = 1;
/* one legacy suit item → its pieces, keeping material, quality, crafter, origin and the worn fraction */
EQ.expandLegacy = it => {
  const ids = EQ.LEGACY[it.id]; if (!ids) return [it];
  const frac = it.cond === undefined ? 1 : clamp(0, 1, it.cond / (it.maxc || 100));
  return ids.map((id, i) => { const d = SF.ITEMS[id]; const f = EQ.fields(id, { material: d.prim === 'metal' ? (it.material || 'iron') : undefined, quality: it.quality, origin: it.origin || 'legacy', creatorName: it.creatorName, creatorId: it.creatorId });
    if (f.omax) f.cond = Math.max(it.cond !== undefined && it.cond <= 0 ? 0 : 1, Math.round(f.omax * frac)); if (it.maker) f.maker = it.maker;
    const n = SF.newItem(id, 1, f); if (it.uid && d.slot === (ids.some(x => SF.ITEMS[x].slot === 'chest') ? 'chest' : SF.ITEMS[ids[0]].slot)) n.uid = it.uid; return n; });   // the chest piece keeps the suit's id
};
EQ.expandList = items => { if (!Array.isArray(items)) return 0; let n = 0; for (let i = items.length - 1; i >= 0; i--) if (EQ.LEGACY[items[i].id]) { const ps = EQ.expandLegacy(items[i]); items.splice(i, 1, ...ps); n++; } return n; };
/* char: a saved character or the ally save ({equip, pack: [] | {items}}). Idempotent. */
EQ.migrateActor = c => {
  if (!c || (c.eqMig || 0) >= EQ.MIGRATION) return { changed: false };
  const out = { changed: true, suits: 0 }; c.equip = c.equip || {};
  const packArr = Array.isArray(c.pack) ? c.pack : c.pack && c.pack.items ? c.pack.items : (c.pack = { items: [] }).items;
  const arm = c.equip.armor; delete c.equip.armor;
  if (arm) {
    if (arm.id === 'garment') { if (!c.equip.tunic) c.equip.tunic = arm; else packArr.push(arm); }
    else for (const pc of EQ.expandLegacy(arm)) { const s = SF.ITEMS[pc.id].slot; if (s && !c.equip[s]) c.equip[s] = pc; else packArr.push(pc); out.suits++; }
  }
  out.suits += EQ.expandList(packArr); if (c.bank && c.bank.items) out.suits += EQ.expandList(c.bank.items);
  for (const s of EQ.SLOT_IDS) if (c.equip[s] === undefined) c.equip[s] = null;
  c.eqMig = EQ.MIGRATION; return out;
};

SF.EQ = EQ;
if (typeof module !== 'undefined' && module.exports) module.exports = EQ;
})(typeof globalThis !== 'undefined' ? globalThis : this);
</script>
