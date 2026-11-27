<script>
/* Shardfall equipment appearance (SF.GEAR), v0.32 — one description of what a character looks like in its equipment, shared by
   the paper doll, the world sprite, NPCs and corpses. Pure, renderer-free, network-free: runs in the browser after the rules,
   equipment and creation modules, and in node for tests (tests/gear.test.js).
   Source of truth: the character's equipment (SF.EQ slots and item instances), the item definitions, SF.matOf and EQ.matColor.
   This module never changes items, slots, materials, stats or saves; it only reads them.
   Art: asset-packs/medieval-equipment-art-v1 (painted static pieces, used on the paper doll) and the layered-armor-v1 rig
   (pose-aware world layers). docs/equipment/RENDERING.md explains both and lists what art is still missing. */
(function (root) {
'use strict';
const SF = root.SF; if (!SF || !SF.EQ) throw new Error('gear.js needs the rules (SF) and equipment (SF.EQ) modules first');
const EQ = SF.EQ, GEAR = {};
GEAR.VERSION = '1.0.0';

/* ---------------- material channels ----------------
   Every piece is painted with up to two independent material channels plus fixed paint (never recoloured).
   A channel names a material KIND (metal, wood, hide, cloth); the item's own materials fill them. */
const kindOf = m => !m ? null : SF.METAL[m] ? 'metal' : SF.WOOD && SF.WOOD[m] ? 'wood' : EQ.HIDES[m] ? 'hide' : EQ.FIXED[m] ? 'fixed' : null;
GEAR.kindOf = kindOf;
GEAR.DEFAULT = { metal: 'iron', wood: 'pine', hide: 'regular' };
// cloth has no material field; it wears the character's chosen clothing colour (cosmetic, Character Creation v2)
GEAR.CLOTH_HEX = '#c8bca0';
GEAR.CLOAK_HEX = '#2f6766';   // the traveller's own sea-teal cloak

/* the painted art piece for each gameplay item id (null: no art in the pack yet; see GEAR.missingArt) */
GEAR.ART = {
  robe: 'robe', cloak: 'cloak', belt: 'belt', boots: 'boots',
  leather_cap: 'leather_cap', leather_tunic: 'leather_tunic', leather_sleeves: 'leather_sleeves', leather_gloves: 'leather_gloves', leather_leggings: 'leather_leggings',
  studded_tunic: 'studded_tunic', studded_sleeves: 'studded_sleeves', studded_gloves: 'studded_gloves', studded_leggings: 'studded_leggings',
  bone_helm: 'bone_helm', bone_chest: 'bone_chest', bone_arms: 'bone_arms', bone_gloves: 'bone_gloves', bone_legs: 'bone_legs',
  ringmail_tunic: 'ringmail_tunic', ringmail_sleeves: 'ringmail_sleeves', ringmail_gloves: 'ringmail_gloves', ringmail_leggings: 'ringmail_leggings',
  chain_coif: 'chain_coif', chain_tunic: 'chain_tunic', chain_leggings: 'chain_leggings',
  plate_chest: 'plate_chest', plate_arms: 'plate_arms', plate_gauntlets: 'plate_gauntlets', plate_leggings: 'plate_leggings',
  bascinet: 'bascinet', open_helm: 'open_helm', norse_helm: 'norse_helm', closed_helm: 'closed_helm', plate_helm: 'plate_helm', great_helm: 'great_helm',
  dragon_helm: 'dragon_helm', dragon_chest: 'dragon_chest', dragon_arms: 'dragon_arms', dragon_gloves: 'dragon_gloves', dragon_legs: 'dragon_legs',
  wooden_shield: 'wooden_shield', metal_shield: 'metal_shield', kite_shield: 'kite_shield', heater_shield: 'heater_shield',
  sword: 'sword', waraxe: 'axe', hammer: 'warhammer', mace: 'mace', spear: 'spear', shortbow: 'bow', crossbow: 'crossbow' };

/* helmet occlusion: what of the hair and face still shows under each head piece */
GEAR.HEAD_COVER = {
  cloth_cap: { hair: 'trim', face: true }, leather_cap: { hair: 'trim', face: true }, bascinet: { hair: 'trim', face: true }, open_helm: { hair: 'trim', face: true },
  norse_helm: { hair: 'trim', face: true }, chain_coif: { hair: 'none', face: true },
  closed_helm: { hair: 'none', face: false }, plate_helm: { hair: 'none', face: false }, great_helm: { hair: 'none', face: false },
  bone_helm: { hair: 'none', face: false }, dragon_helm: { hair: 'none', face: false } };

const def = it => it && SF.ITEMS[it.id];
// weapon items name their rules entry with .wpn (SF.WEAPONS); tools in the main hand (hatchet, pickaxe, knife) are weapons too
const wpnId = it => { const d = def(it); return d ? (d.wpn || (SF.WEAPONS[it.id] ? it.id : null)) : null; };
const isWeapon = it => !!wpnId(it);
GEAR.wpnId = wpnId;
GEAR.twoHanded = it => { const w = SF.WEAPONS[wpnId(it)]; return !!(w && w.two); };

/* the materials an equipped item shows, by kind. Armor: its own material (or fixed material) and, for studded leather, the stud
   metal (it.sec). Weapons: the blade/head metal and the handle/shaft wood are independent channels; a weapon records one material,
   so the other channel keeps its default (iron fittings on a bow, pine handle on a sword) unless it.sec says otherwise. */
GEAR.materials = it => {
  const d = def(it); if (!d) return {};
  const out = {}, m = d.fixedMat || SF.matOf(it), k = kindOf(m);
  if (k && k !== 'fixed') out[k] = m; else if (k === 'fixed') out.fixed = m;
  const s = it.sec, sk = kindOf(s); if (sk && sk !== 'fixed' && !out[sk]) out[sk] = s;
  if (d.sec === 'metal' && !out.metal) out.metal = 'iron';
  if (isWeapon(it) || d.slot === 'shield') { if (!out.metal) out.metal = 'iron'; if (!out.wood) out.wood = 'pine'; }
  return out;
};

const hexOf = m => EQ.matColor(m);
const lookHex = (list, id) => { const L = SF.CREATION && SF.CREATION[list]; if (!L) return null; const x = L.find(o => o.id === id); return x && x.hex || null; };
// a look may carry its own hex (an NPC's regional or role palette from SF.WARDROBE) in place of a creator colour id
GEAR.clothHex = look => (look && (look.clothHex || lookHex('CLOTHING', look.clothingColor))) || GEAR.CLOTH_HEX;
GEAR.cloakHex = look => (look && (look.cloakHex || (SF.CREATION && SF.CREATION.cloakHex(look)))) || GEAR.CLOAK_HEX;

/* one equipped piece as the renderers need it */
GEAR.piece = (slot, it, look) => {
  const d = def(it); if (!d) return null;
  const mats = GEAR.materials(it), hex = {};
  for (const k of ['metal', 'wood', 'hide']) if (mats[k]) hex[k] = hexOf(mats[k]);
  if (mats.fixed === 'cloth' || d.fam === 'cloth' || it.id === 'garment') hex.cloth = slot === 'cloak' ? GEAR.cloakHex(look) : GEAR.clothHex(look);
  if (hex.cloth && typeof it.dye === 'string' && /^#[0-9a-f]{6}$/i.test(it.dye)) hex.cloth = it.dye;   // a cosmetic NPC piece dyed by SF.WARDROBE
  if (mats.fixed && mats.fixed !== 'cloth') hex.fixed = hexOf(mats.fixed);
  const fam = d.fam || (isWeapon(it) ? 'weapon' : null);
  // the colour of the piece's main surface (the rig paints one primary tone per segment) and its secondary tone
  const W = SF.WEAPONS[wpnId(it)], primKind = mats.fixed === 'cloth' ? 'cloth' : mats.fixed ? 'fixed' : d.prim || kindOf(SF.matOf(it)) || (W ? (W.ammo ? 'wood' : 'metal') : 'cloth');
  const color = hex[primKind] || hex.cloth || hex.fixed || hex.metal || hex.hide || hex.wood || GEAR.CLOTH_HEX;
  const secColor = d.sec === 'metal' ? hex.metal : isWeapon(it) ? (primKind === 'wood' ? hex.metal : hex.wood) : slot === 'shield' && primKind === 'wood' ? hex.metal : null;
  return { slot, id: it.id, wpn: wpnId(it), uid: it.uid, fam, family: fam === 'cloth' && it.id === 'garment' ? 'cloth' : fam, layer: EQ.SLOT_LAYER[slot] || null,
    z: EQ.RENDER_LAYERS.indexOf(EQ.SLOT_LAYER[slot]), art: GEAR.ART[it.id] || null, mats, hex, primKind, color, secColor,
    broken: it.cond === 0, two: GEAR.twoHanded(it) };
};

/* resolve(equip, look) → the whole appearance: pieces by slot, draw order, occlusion and a stable key.
   equip: the character's slot → item map (actual state, read after a validated command succeeded). */
GEAR.resolve = (equip, look) => {
  const slots = {}, order = [];
  for (const s of EQ.SLOT_IDS) { const it = equip && equip[s]; if (!it) continue; const p = GEAR.piece(s, it, look); if (p) { slots[s] = p; order.push(p); } }
  order.sort((a, b) => a.z - b.z);
  const occ = GEAR.occlusion(slots);
  return { slots, order, occ, body: (look && look.body) === 'female' ? 'female' : 'male', key: GEAR.key(slots, look) };
};

/* occlusion rules (identical for paper doll, world and corpse):
   - a two-handed weapon hides the off hand in every animation state (the slot may still hold an item in old saves);
   - head pieces hide or trim hair and may cover the face (closed helms hide beards);
   - a robe covers the torso armor and most of the legs; a cloak sits behind the body when facing the viewer. */
GEAR.occlusion = slots => {
  const w = slots.weapon, h = slots.head, hc = h ? (GEAR.HEAD_COVER[h.id] || { hair: 'none', face: true }) : { hair: 'all', face: true };
  return { offhand: !(w && w.two), hair: hc.hair, face: hc.face, robe: !!slots.robe, cloak: !!slots.cloak };
};

/* a stable key: changes exactly when something visible changes (item, any material channel, wear-out, cosmetic look) */
GEAR.key = (slots, look) => {
  const parts = [];
  for (const s of EQ.SLOT_IDS) { const p = slots[s]; if (!p) { parts.push('-'); continue; } const h = p.hex; parts.push(p.id + ':' + [h.metal, h.wood, h.hide, h.cloth, h.fixed].map(x => x || '').join(',') + (p.broken ? 'x' : '')); }
  if (look) parts.push(['body', 'skinTone', 'hairStyle', 'hairColor', 'facialHairStyle', 'facialHairColor', 'clothingColor', 'cloak'].map(k => look[k] || '').join(','));
  return parts.join('|');
};
GEAR.ofChar = ch => GEAR.resolve(ch && ch.equip, ch && ch.look);

/* corpses keep the appearance their owner died in: a frozen copy taken before the death transaction moves the items.
   It is visual only (never consulted for loot) and is not re-posed from the live actor. */
const deepFreeze = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k in o) deepFreeze(o[k]); } return o; };
GEAR.snapshot = ch => { const look = ch && ch.look ? Object.assign({}, ch.look) : null; const r = GEAR.resolve(ch && ch.equip, look); return deepFreeze({ v: 1, look, slots: r.slots, occ: r.occ, body: r.body, key: r.key, order: r.order }); };
/* a saved snapshot (plain JSON) back into a frozen appearance; anything malformed gives null and the old corpse art is used */
GEAR.restore = s => { if (!s || s.v !== 1 || !s.slots || typeof s.key !== 'string') return null; const order = Object.values(s.slots).filter(p => p && p.id).sort((a, b) => a.z - b.z); return deepFreeze({ v: 1, look: s.look || null, slots: s.slots, occ: s.occ || GEAR.occlusion(s.slots), body: s.body === 'female' ? 'female' : 'male', key: s.key, order }); };

/* ---------------- NPC appearance ----------------
   NPCs with no equipment wear cosmetic presets made of real item ids (never added to any inventory, never dropped as loot).
   Their body and hair come from a seed (the actor's stable id), so the same NPC looks the same every visit. */
const set = (o, mat, sec) => { const out = {}; for (const s in o) out[s] = { id: o[s], uid: 'npc', material: undefined }; for (const s in out) { const d = SF.ITEMS[out[s].id]; if (!d) { delete out[s]; continue; } if (mat && d.prim === 'metal') out[s].material = mat.metal; if (mat && d.prim === 'hide') out[s].material = mat.hide; if (d.sec) out[s].sec = sec || 'iron'; } return out; };
GEAR.PRESETS = {
  guard:      () => set({ head: 'chain_coif', chest: 'ringmail_tunic', arms: 'ringmail_sleeves', legs: 'ringmail_leggings', feet: 'boots', tunic: 'tabard', weapon: 'glaive' }),
  trainer:    () => set({ chest: 'studded_tunic', arms: 'studded_sleeves', legs: 'studded_leggings', feet: 'boots', weapon: 'sword', shield: 'buckler' }),
  smith:      () => set({ shirt: 'shirt', trousers: 'trousers', hands: 'leather_gloves', feet: 'boots', belt: 'belt', weapon: 'hammer' }),
  qsmith:     () => set({ shirt: 'shirt', trousers: 'trousers', hands: 'leather_gloves', feet: 'boots', belt: 'belt' }),
  miner:      () => set({ shirt: 'shirt', trousers: 'trousers', feet: 'boots', head: 'leather_cap', weapon: 'pickaxe' }),
  woodcutter: () => set({ shirt: 'shirt', trousers: 'trousers', feet: 'boots', weapon: 'hatchet' }),
  healer:     () => set({ robe: 'robe', feet: 'shoes' }),
  apothecary: () => set({ robe: 'robe', feet: 'shoes', belt: 'belt' }),
  student:    () => set({ robe: 'robe', feet: 'shoes' }),
  banker:     () => set({ shirt: 'shirt', trousers: 'trousers', tunic: 'tabard', feet: 'shoes' }),
  outlaw:     () => set({ chest: 'leather_tunic', legs: 'leather_leggings', feet: 'boots', weapon: 'dagger', cloak: 'cloak' }),
  smuggler:   () => set({ chest: 'leather_tunic', arms: 'leather_sleeves', legs: 'leather_leggings', feet: 'boots', weapon: 'sword', head: 'leather_cap' }),
  captain:    () => set({ chest: 'chain_tunic', legs: 'chain_leggings', feet: 'boots', weapon: 'sword', cloak: 'cloak', head: 'open_helm' }, { metal: 'shadow_iron' }),
  villager:   () => set({ shirt: 'shirt', trousers: 'trousers', feet: 'shoes' }) };
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
GEAR.npcLook = (seed, o) => {
  const C = SF.CREATION, h = hash(String(seed)), pick = (L, k) => L[(h >>> k) % L.length].id;
  const body = (o && o.body) || ((h & 7) < 3 ? 'female' : 'male');
  const styles = C ? C.HAIR_STYLES.filter(x => !x.body || x.body === body).map(x => x.id) : ['short'];
  return { body, skinTone: C ? pick(C.SKIN, 3) : 'light', hairStyle: styles[(h >>> 7) % styles.length], hairColor: C ? pick(C.HAIR_COLORS, 11) : 'brown',
    facialHairStyle: body === 'male' && C ? pick(C.FACIAL, 15) : 'none', facialHairColor: C ? pick(C.HAIR_COLORS, 11) : 'brown',
    clothingColor: (o && o.cloth) || (C ? pick(C.CLOTHING, 19) : 'oatmeal'), cloak: (o && o.cloak) || 'none' };
};

/* ---------------- animation ----------------
   The world rig (classic-humans-v2 contract: 112×100 cells, anchor 56,86, rows S SW W NW N NE E SE, 29 animations) plays
   whatever the simulation says; this only translates. Weapon → attack animation uses the existing weapon metadata. */
GEAR.RIG_ANIMS = { idle: 4, walk: 8, run: 8, ready: 4, unarmed: 8, slash1h: 8, slash2h: 8, chop1h: 8, chop2h: 8, blunt1h: 8, blunt2h: 8, thrust1h: 8, thrust2h: 8,
  polearm: 8, staff: 8, bow: 8, crossbow: 8, cast1h: 8, cast2h: 8, caststaff: 8, block: 6, hit: 4, death: 8, corpse: 1, mine: 8, chopwood: 8, smith: 8, bandage: 8, fish: 8 };
// gameplay weapon id → [attack animation, weapon geometry]; every SF.WEAPONS id is mapped (tests check it)
GEAR.WEAPON_RIG = { unarmed: ['unarmed', 'fist'], sword: ['slash1h', 'sword'], glaive: ['polearm', 'halberd'], battleaxe: ['chop2h', 'battleaxe'], hatchet: ['chop2h', 'hatchet'],
  knife: ['slash1h', 'dagger'], pickaxe: ['chop1h', 'pickaxe'], hammer: ['blunt2h', 'warhammer'], mace: ['blunt1h', 'mace'], waraxe: ['chop1h', 'axe'], dagger: ['thrust1h', 'dagger'],
  kryss: ['thrust1h', 'kryss'], spear: ['thrust2h', 'spear'], shortbow: ['bow', 'bow'], crossbow: ['crossbow', 'crossbow'], heavycrossbow: ['crossbow', 'heavycrossbow'] };
GEAR.attackAnim = wid => (GEAR.WEAPON_RIG[wid] || GEAR.WEAPON_RIG.unarmed)[0];
GEAR.castAnim = wid => { const w = SF.WEAPONS[wid]; return !w || wid === 'unarmed' ? 'cast2h' : w.two ? 'caststaff' : 'cast1h'; };
/* the player's clip (from the painted traveller sheets, src/game.js playerClip) → rig action and frame */
GEAR.fromClip = (clip, f, wid, speed) => {
  const n = c => GEAR.RIG_ANIMS[c], scale = (a, of) => Math.min(n(a) - 1, Math.floor(f * n(a) / Math.max(1, of)));
  if (clip === 'Idle') return ['idle', 0];
  if (clip === 'Walk' || /_Walk$/.test(clip)) { const a = speed > 5.6 ? 'run' : 'walk'; return [a, f % n(a)]; }
  if (/_Ready$/.test(clip)) return ['ready', 0];
  if (clip === 'CastPrepare') { const a = GEAR.castAnim(wid); return [a, Math.min(3, Math.floor(f * 4 / 6))]; }
  if (clip === 'CastHold') { const a = GEAR.castAnim(wid); return [a, 3]; }
  if (clip === 'CastRelease') { const a = GEAR.castAnim(wid); return [a, Math.min(7, 4 + Math.floor(f * 4 / 6))]; }
  if (/_Attack$/.test(clip)) { const a = clip === 'Unarmed_Attack' ? 'unarmed' : GEAR.attackAnim(wid); const of = { Unarmed_Attack: 8, Dagger_Attack: 8, Sword_Attack: 9 }[clip] || 10; return [a, scale(a, of)]; }
  return ['idle', 0];
};

/* the art each gameplay item still lacks (reported in docs and by the browser test) */
GEAR.missingArt = () => { const out = []; for (const id in SF.ITEMS) { const d = SF.ITEMS[id]; if (!d.trade || d.legacy) continue; if (!(d.slot && EQ.SLOT[d.slot]) && !SF.WEAPONS[id]) continue; if (!GEAR.ART[id]) out.push(id); } return out.sort(); };

SF.GEAR = GEAR;
if (typeof module !== 'undefined' && module.exports) module.exports = GEAR;
})(typeof globalThis !== 'undefined' ? globalThis : this);
</script>
