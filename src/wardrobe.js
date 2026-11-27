<script>
/* Shardfall NPC wardrobe & faction appearance v1.0 (SF.WARDROBE) — docs/handoffs/npc-costume-design-v1.md, docs/wardrobe/STATUS.md.
   Pure data + a deterministic resolver. No DOM, no Math.random, no gameplay state: it never creates, moves or changes an item,
   a stat, a loot table, an AI rule or a save field other than the player's own appearance identity (look.body/skin/hair/…).
   One resolved descriptor feeds every human renderer (world NPCs, human mobs, the hireling, the player and the paper doll).
     · Actors with real equipment (player, Wren) show exactly what they wear: pieces come from actor.equip, materials from SF.matOf.
     · Actors without an equipment model (every NPC and human mob today) get a COSMETIC preset made of real item ids with real
       material ids, flagged source:'cosmetic'. It is never added to an inventory, a corpse or a loot roll and grants nothing.
     · Appearance is chosen once from the stable actor id and WARDROBE.SEED_REV, never from Math.random and never per frame. */
(function (root) {
'use strict';
const SF = root.SF; if (!SF || !SF.EQ) throw new Error('wardrobe.js needs the rules (SF) and equipment (SF.EQ) modules first');
const W = { VERSION: '1.0.0', SEED_REV: 1 };

/* ---------------- deterministic helpers ---------------- */
// FNV-1a 32-bit; a string in, a stable unsigned int out (same in node and every browser)
const hash32 = s => { let h = 0x811c9dc5; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
const roll = (seed, salt) => hash32(seed + '|' + salt) / 4294967296;
const pickW = (seed, salt, list) => { const ws = list.map(x => Array.isArray(x) ? x[1] : 1), tot = ws.reduce((a, b) => a + b, 0); let r = roll(seed, salt) * tot; for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r < 0) return Array.isArray(list[i]) ? list[i][0] : list[i]; } const l = list[list.length - 1]; return Array.isArray(l) ? l[0] : l; };
W.hash32 = hash32; W.roll = roll;

/* ---------------- dyes: muted natural colours for cloth and heraldry only (never a material, never a stat) ---------------- */
W.DYES = {
  linen: '#b9ab8c', cream: '#c6bda5', ivory: '#d2ccb8', oatmeal: '#b2a586', sand: '#ad9c78', tan: '#9c8462', fadedtan: '#968669', mutedtan: '#786746',
  charcoal: '#4a4845', stone: '#77746c', grey: '#75736d', warmgrey: '#857c72', slate: '#556068', sootblack: '#2f2c2c', ash: '#6a6e72',
  brown: '#6b4b34', darkbrown: '#49382a', dirt: '#6a5440', russet: '#7a4a32', rust: '#8f5236', ochre: '#a17b39', clay: '#94654a', pine: '#6e5236', goldbrown: '#94753e',
  moss: '#5d6a3e', olive: '#6b6a3a', sage: '#7d8a6b', forest: '#3e573a', seagreen: '#4f6f63', mutedteal: '#4f7470',
  dustyblue: '#66798c', mutedblue: '#4f6178', subduedblue: '#4a5d78', fadednavy: '#3f4f66', navy: '#2f405a', ashblue: '#5d6a7a', indigo: '#3c3f66',
  plum: '#634158', violet: '#5b4a73', wine: '#5e2d36', burgundy: '#6e3434', scarlet: '#8a3530', fadedred: '#783d37', bone: '#cfc6ad' };
const isHex = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
W.dye = c => isHex(c) ? c.toLowerCase() : (W.DYES[c] || null);

/* ---------------- regions, factions, heraldry (docs/handoffs/npc-costume-design-v1.md, regional palette table) ---------------- */
// colours are the spec's base sRGB dyes; heraldry is a separate cloth overlay; accent never implies a metal
W.REGIONS = {
  mynoc:     { n: 'Mynoc',       faction: 'mynoc',     p: '#bd913d', s: '#514033', a: '#858b8e', heraldry: 'crossed_hammers', zone: 'mynoc' },
  vespar:    { n: 'Vespar',      faction: 'vespar',    p: '#284663', s: '#d6d1bd', a: '#858f99', heraldry: 'river_bridge',    zone: 'vespar' },
  skara:     { n: 'Skara Bryn',  faction: 'skara',     p: '#3e573a', s: '#786746', a: '#49382a', heraldry: 'oak_arrow',       zone: 'skara' },
  moonglen:  { n: 'Moonglen',    faction: 'moonglen',  p: '#514269', s: '#c8c5d0', a: '#777e8c', heraldry: 'crescent',        zone: 'moonglen' },
  saltmarsh: { n: 'Saltmarsh Quay', faction: 'saltmarsh', p: '#783d37', s: '#655443', a: '#85827a', heraldry: 'anchor',      zone: 'quay' } };
// the game's own place ids → a wardrobe region (explicit; anything else has no regional palette)
W.REGION_ALIAS = { mynoc: 'mynoc', vespar: 'vespar', skara: 'skara', skaraland: 'skara', moonglen: 'moonglen', quay: 'saltmarsh', saltmarsh: 'saltmarsh' };

/* ---------------- guard uniforms: region × rank, real item ids and material ids only ---------------- */
// piece: [slot, itemId, material?, dye?]. dye is a region key (p/s/a) or a dye name; only cloth pieces are dyed.
// patrol is the standard kit; ranks change only what the spec says (recruit lighter kit and cap, sergeant headgear and trim,
// captain plate or regional equivalent, cloak and crest) and always keep the regional tabard/cloak colours.
const G = (base, ranks) => ({ base, ranks });
W.UNIFORMS = {
  mynoc: G({ pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 's'], ['chest', 'chain_tunic', 'iron'], ['legs', 'chain_leggings', 'iron'], ['hands', 'leather_gloves', 'regular'], ['feet', 'boots', 'thick'], ['head', 'open_helm', 'iron'], ['tunic', 'tabard', null, 'p'], ['belt', 'belt', 'thick']],
      arms: [{ weapon: 'mace', shield: 'metal_shield', shieldMat: 'iron' }] },
    { recruit: { set: [['chest', 'ringmail_tunic', 'iron'], ['legs', 'leather_leggings', 'regular'], ['head', 'cloth_cap', null, 's']], drop: ['hands'] },
      sergeant: { set: [['head', 'norse_helm', 'iron'], ['arms', 'ringmail_sleeves', 'iron']], overlays: ['trim'] },
      captain: { set: [['chest', 'plate_chest', 'iron'], ['arms', 'plate_arms', 'iron'], ['head', 'closed_helm', 'iron'], ['cloak', 'cloak', null, 'p']], overlays: ['trim', 'crest'] } }),
  vespar: G({ pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'navy'], ['chest', 'chain_tunic', 'iron'], ['arms', 'plate_arms', 'iron'], ['legs', 'chain_leggings', 'iron'], ['hands', 'plate_gauntlets', 'iron'], ['feet', 'boots', 'regular'], ['head', 'bascinet', 'iron'], ['tunic', 'tabard', null, 'p'], ['belt', 'belt', 'regular']],
      arms: [{ weapon: 'sword', shield: 'heater_shield', shieldMat: 'iron' }, { weapon: 'spear' }] },
    { recruit: { set: [['chest', 'ringmail_tunic', 'iron'], ['arms', 'leather_sleeves', 'regular'], ['legs', 'leather_leggings', 'regular'], ['hands', 'leather_gloves', 'regular'], ['head', 'cloth_cap', null, 'p']] },
      sergeant: { set: [['head', 'closed_helm', 'iron']], overlays: ['trim'] },
      captain: { set: [['chest', 'plate_chest', 'iron'], ['legs', 'plate_leggings', 'iron'], ['neck', 'plate_gorget', 'iron'], ['head', 'plate_helm', 'iron'], ['cloak', 'cloak', null, 'p']], overlays: ['trim', 'crest'] } }),
  skara: G({ pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'mutedtan'], ['chest', 'studded_tunic', 'regular', null, 'iron'], ['arms', 'studded_sleeves', 'regular', null, 'iron'], ['legs', 'studded_leggings', 'regular', null, 'iron'], ['hands', 'leather_gloves', 'regular'], ['feet', 'boots', 'regular'], ['head', 'leather_cap', 'regular'], ['cloak', 'cloak', null, 'p'], ['belt', 'belt', 'regular']],
      arms: [{ weapon: 'shortbow' }, { weapon: 'sword' }] },
    { recruit: { set: [['chest', 'leather_tunic', 'regular'], ['arms', 'leather_sleeves', 'regular'], ['legs', 'leather_leggings', 'regular'], ['head', 'cloth_cap', null, 'p']] },
      sergeant: { set: [['neck', 'studded_gorget', 'regular', null, 'iron'], ['head', 'leather_cap', 'thick']], overlays: ['trim'] },
      captain: { set: [['chest', 'studded_tunic', 'thick', null, 'iron'], ['neck', 'studded_gorget', 'thick', null, 'iron'], ['head', 'bascinet', 'iron']], overlays: ['trim', 'crest'] } }),
  moonglen: G({ pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'charcoal'], ['chest', 'chain_tunic', 'iron'], ['legs', 'chain_leggings', 'iron'], ['hands', 'leather_gloves', 'regular'], ['feet', 'boots', 'regular'], ['head', 'chain_coif', 'iron'], ['tunic', 'tabard', null, 'p'], ['belt', 'belt', 'regular']],
      arms: [{ weapon: 'glaive' }] },
    { recruit: { set: [['chest', 'ringmail_tunic', 'iron'], ['legs', 'leather_leggings', 'regular'], ['head', 'cloth_cap', null, 'p']] },
      sergeant: { set: [['head', 'bascinet', 'iron'], ['arms', 'plate_arms', 'iron']], overlays: ['trim'] },
      captain: { set: [['chest', 'plate_chest', 'iron'], ['arms', 'plate_arms', 'iron'], ['head', 'plate_helm', 'iron'], ['cloak', 'cloak', null, 'p']], overlays: ['trim', 'crest'] } }),
  saltmarsh: G({ pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 's'], ['chest', 'ringmail_tunic', 'iron'], ['arms', 'ringmail_sleeves', 'iron'], ['legs', 'leather_leggings', 'regular'], ['hands', 'leather_gloves', 'regular'], ['feet', 'boots', 'regular'], ['head', 'bascinet', 'iron'], ['tunic', 'tabard', null, 'p'], ['belt', 'belt', 'regular']],
      arms: [{ weapon: 'spear' }, { weapon: 'sword', shield: 'wooden_shield', shieldMat: 'pine' }] },
    { recruit: { set: [['chest', 'leather_tunic', 'regular'], ['arms', 'leather_sleeves', 'regular'], ['head', 'cloth_cap', null, 'p']] },
      sergeant: { set: [['head', 'norse_helm', 'iron']], overlays: ['trim'] },
      captain: { set: [['chest', 'chain_tunic', 'iron'], ['legs', 'chain_leggings', 'iron'], ['head', 'closed_helm', 'iron'], ['cloak', 'cloak', null, 'p']], overlays: ['trim', 'crest'] } }) };
W.RANKS = ['recruit', 'patrol', 'sergeant', 'captain'];
// roster: the n-th guard of a region (placement order, stable across loads) takes this rank; named officers below override
W.ROSTER = ['sergeant', 'patrol', 'patrol', 'recruit', 'patrol', 'patrol'];

/* ---------------- cosmetic overlays and props: what the renderer can draw, and what is still missing ---------------- */
// status: 'procedural' = drawn by the procedural prototype rig (src/humanrig.js) — NOT painted production art;
//         'missing' = no art at all; the resolver records it in descriptor.missing and the renderer draws nothing for it.
W.OVERLAYS = {
  apron_long:  { n: 'long work apron', status: 'procedural' }, apron_short: { n: 'short apron', status: 'procedural' },
  vest:        { n: 'vest / waistcoat', status: 'procedural' }, skirt: { n: 'skirt', status: 'procedural' }, dress: { n: 'long dress', status: 'procedural' },
  straw_hat:   { n: 'straw hat', status: 'procedural' }, hood: { n: 'hood (up)', status: 'procedural' }, headscarf: { n: 'headscarf / bandana', status: 'procedural' },
  sash:        { n: 'sash', status: 'procedural' }, pouch: { n: 'belt pouch', status: 'procedural' }, mantle: { n: 'short mantle', status: 'procedural' },
  trim:        { n: 'rank trim on tabard/cloak', status: 'procedural' }, crest: { n: 'officer crest on helm', status: 'procedural' },
  heraldry:    { n: 'regional heraldic device', status: 'procedural', note: 'a 3×4 px coloured device; the actual symbols (crossed hammers, river and bridge, oak leaf and arrow, crescent, anchor) are missing at native scale' },
  bracer:      { n: 'forearm bracer', status: 'procedural' }, wear: { n: 'dirt, patches and fading', status: 'procedural' },
  hood_down:   { n: 'hood (down)', status: 'missing' }, measuring_tape: { n: 'measuring tape', status: 'missing' }, bedroll: { n: 'bedroll', status: 'missing' },
  quiver:      { n: 'quiver', status: 'missing' }, sleepwear: { n: 'sleeping clothes', status: 'missing' }, embroidery: { n: 'fine embroidery', status: 'missing' } };
// props are held cosmetic objects, never items: no inventory, no loot. shape = a rig weapon/prop shape.
W.PROPS = {
  smith_hammer: { n: 'smith\'s hammer', shape: 'smithhammer', status: 'procedural', act: 'smith' },
  tongs:        { n: 'smith tongs', shape: 'tongs', status: 'procedural' },
  pickaxe:      { n: 'pickaxe', shape: 'pickaxe', status: 'procedural', act: 'mine' },
  hatchet:      { n: 'hatchet', shape: 'hatchet', status: 'procedural', act: 'chopwood' },
  fishing_rod:  { n: 'fishing rod', shape: 'fishingpole', status: 'procedural', act: 'fish' },
  tankard:      { n: 'tankard', shape: 'tankard', status: 'procedural' }, book: { n: 'book / ledger', shape: 'book', status: 'procedural' },
  staff:        { n: 'staff', shape: 'staff', status: 'procedural' }, basket: { n: 'fish basket', shape: 'basket', status: 'procedural' },
  lantern:      { n: 'lantern (night watch, free hand only)', shape: 'lantern', status: 'procedural', off: true },
  bow:          { n: 'bow', shape: 'bow', status: 'procedural' }, knife: { n: 'knife', shape: 'dagger', status: 'procedural' },
  saw:          { n: 'saw', status: 'missing' }, hoe: { n: 'hoe', status: 'missing' }, crook: { n: 'shepherd\'s crook', status: 'missing' }, bread: { n: 'bread', status: 'missing' },
  sewing_kit:   { n: 'sewing kit', status: 'missing' }, vial: { n: 'vial / herbs', status: 'missing' }, bandage: { n: 'bandage', status: 'missing' }, rope: { n: 'rope / cargo', status: 'missing' },
  pouch_goods:  { n: 'goods / pouch in hand', status: 'missing' }, holy_symbol: { n: 'holy symbol', status: 'missing' }, reagent_pouch: { n: 'reagent pouch in hand', status: 'missing' } };

/* ---------------- civilian and hostile recipes ---------------- */
// pieces: real item ids (cloth pieces take dye slot 'p' | 's' | 'a'); overlays: [id, dyeSlot?]; palettes: 3–5 [p, s, a] dye names;
// prop: shown only in the activity state listed (work unless noted). Nothing here is a gameplay item grant.
const C = o => Object.assign({ kind: 'civilian' }, o);
const BASE = [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'p'], ['feet', 'shoes', 'regular'], ['belt', 'belt', 'regular']];
W.ROLES = {
  blacksmith: C({ n: 'Blacksmith / armorer', pieces: [...BASE.slice(0, 2), ['feet', 'boots', 'thick'], ['hands', 'leather_gloves', 'thick'], ['belt', 'belt', 'thick']], overlays: [['apron_long', 'a']], workOnly: ['apron_long', 'hands'], palettes: [['charcoal', 'linen', 'russet'], ['brown', 'cream', 'darkbrown'], ['stone', 'oatmeal', 'russet'], ['charcoal', 'sand', 'brown']], prop: 'smith_hammer' }),
  miner:      C({ n: 'Miner', pieces: [...BASE.slice(0, 2), ['feet', 'boots', 'regular'], ['belt', 'belt', 'regular'], ['head', 'cloth_cap', null, 'a']], overlays: [['vest', 'a'], ['wear']], palettes: [['stone', 'ochre', 'brown'], ['grey', 'oatmeal', 'darkbrown'], ['charcoal', 'ochre', 'dirt'], ['stone', 'tan', 'brown']], prop: 'pickaxe', propIn: 'work' }),
  woodcutter: C({ n: 'Carpenter / lumberjack', pieces: [...BASE.slice(0, 2), ['feet', 'boots', 'regular'], ['belt', 'belt', 'regular']], overlays: [['apron_short', 'a']], workOnly: ['apron_short'], palettes: [['pine', 'cream', 'moss'], ['brown', 'oatmeal', 'moss'], ['moss', 'linen', 'pine'], ['dirt', 'cream', 'forest']], prop: 'hatchet', propIn: 'work' }),
  fletcher:   C({ n: 'Fletcher / bowyer', pieces: BASE, overlays: [['vest', 'p'], ['bracer']], palettes: [['olive', 'tan', 'brown'], ['moss', 'oatmeal', 'darkbrown'], ['olive', 'cream', 'pine']], prop: 'knife' }),
  tinker:     C({ n: 'Tinker', pieces: [...BASE, ['head', 'cloth_cap', null, 'a']], overlays: [['apron_short', 's'], ['pouch']], workOnly: ['apron_short'], palettes: [['clay', 'grey', 'tan'], ['stone', 'clay', 'tan'], ['grey', 'oatmeal', 'clay']], prop: 'tongs' }),
  tailor:     C({ n: 'Tailor / weaver', pieces: BASE, overlays: [['apron_long', 'a'], ['dress', 'p', 'female']], workOnly: ['apron_long'], palettes: [['plum', 'sage', 'mutedblue'], ['sage', 'cream', 'plum'], ['mutedblue', 'linen', 'plum'], ['plum', 'oatmeal', 'sage']], prop: 'sewing_kit' }),
  tanner:     C({ n: 'Tanner / leatherworker', pieces: [...BASE.slice(0, 2), ['feet', 'boots', 'thick']], overlays: [['apron_long', 'a']], palettes: [['darkbrown', 'ochre', 'brown'], ['brown', 'oatmeal', 'darkbrown'], ['dirt', 'ochre', 'darkbrown']], prop: 'knife' }),
  fishmonger: C({ n: 'Fisher / fishmonger', pieces: [...BASE.slice(0, 2), ['feet', 'boots', 'regular'], ['head', 'cloth_cap', null, 's']], overlays: [['apron_short', 'a']], workOnly: ['apron_short'], palettes: [['slate', 'seagreen', 'cream'], ['seagreen', 'cream', 'slate'], ['slate', 'sand', 'seagreen']], prop: 'basket' }),
  fisher:     C({ n: 'Fisher', pieces: [...BASE.slice(0, 2), ['feet', 'boots', 'regular'], ['head', 'cloth_cap', null, 's']], overlays: [], palettes: [['slate', 'seagreen', 'cream'], ['fadednavy', 'sand', 'seagreen'], ['seagreen', 'linen', 'slate']], prop: 'fishing_rod', propIn: 'work' }),
  sailor:     C({ n: 'Sailor / ferryman / dockworker', pieces: [...BASE.slice(0, 2), ['feet', 'boots', 'regular'], ['belt', 'belt', 'regular']], overlays: [['vest', 'a'], ['headscarf', 'a']], palettes: [['fadednavy', 'sand', 'brown'], ['slate', 'linen', 'brown'], ['sand', 'fadednavy', 'rust'], ['fadednavy', 'cream', 'darkbrown']], prop: 'rope' }),
  captain_sea:C({ n: 'Ship / boat captain', pieces: [...BASE.slice(0, 2), ['feet', 'boots', 'thick'], ['belt', 'belt', 'thick'], ['cloak', 'cloak', null, 'p']], overlays: [['vest', 'a']], palettes: [['fadednavy', 'cream', 'darkbrown'], ['navy', 'sand', 'brown'], ['slate', 'linen', 'rust']], prop: null }),
  farmer:     C({ n: 'Farmer / shepherd / stablehand', pieces: [...BASE.slice(0, 2), ['feet', 'shoes', 'regular']], overlays: [['straw_hat'], ['wear']], palettes: [['oatmeal', 'dirt', 'moss'], ['dirt', 'oatmeal', 'moss'], ['oatmeal', 'brown', 'olive']], prop: 'hoe' }),
  cook:       C({ n: 'Baker / cook', pieces: BASE, overlays: [['apron_long', 'a'], ['headscarf', 'a']], workOnly: ['apron_long'], palettes: [['warmgrey', 'tan', 'linen'], ['tan', 'cream', 'ivory'], ['warmgrey', 'oatmeal', 'ivory']], prop: 'bread' }),
  innkeeper:  C({ n: 'Innkeeper / tavern staff', pieces: BASE, overlays: [['vest', 'p', 'male'], ['dress', 'p', 'female'], ['apron_short', 'a']], palettes: [['burgundy', 'cream', 'brown'], ['wine', 'linen', 'brown'], ['brown', 'cream', 'burgundy']], prop: 'tankard' }),
  merchant:   C({ n: 'Merchant / provisioner', pieces: [...BASE.slice(0, 3), ['belt', 'belt', 'regular']], overlays: [['vest', 'a'], ['pouch']], palettes: [['subduedblue', 'cream', 'rust'], ['rust', 'cream', 'subduedblue'], ['subduedblue', 'oatmeal', 'brown'], ['moss', 'cream', 'rust']], prop: 'pouch_goods' }),
  trader:     C({ n: 'Travelling merchant', pieces: [...BASE.slice(0, 2), ['feet', 'boots', 'regular'], ['belt', 'belt', 'regular'], ['cloak', 'cloak', null, 'a']], travelOnly: ['cloak'], overlays: [['vest', 's'], ['pouch']], palettes: [['rust', 'cream', 'darkbrown'], ['subduedblue', 'sand', 'brown'], ['goldbrown', 'cream', 'brown']], prop: null }),
  banker:     C({ n: 'Banker / wealthy trader', pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'p'], ['feet', 'shoes', 'thick'], ['robe', 'robe', null, 'p'], ['belt', 'belt', 'thick']], overlays: [['trim', 'a']], palettes: [['navy', 'cream', 'goldbrown'], ['wine', 'ivory', 'goldbrown'], ['indigo', 'cream', 'goldbrown']], prop: 'book' }),
  healer:     C({ n: 'Healer / herbalist / alchemist', pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 's'], ['feet', 'shoes', 'regular'], ['robe', 'robe', null, 'p'], ['belt', 'belt', 'regular']], overlays: [['pouch']], palettes: [['ivory', 'sage', 'mutedteal'], ['sage', 'ivory', 'mutedteal'], ['ivory', 'mutedteal', 'sage']], prop: 'vial' }),
  herbalist:  C({ n: 'Herbalist (gatherer)', pieces: [...BASE.slice(0, 2), ['feet', 'shoes', 'regular'], ['belt', 'belt', 'regular']], overlays: [['dress', 'p', 'female'], ['pouch'], ['headscarf', 'a']], palettes: [['sage', 'oatmeal', 'mutedteal'], ['moss', 'cream', 'sage'], ['olive', 'linen', 'sage']], prop: 'vial' }),
  reagents:   C({ n: 'Reagent vendor', pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 's'], ['feet', 'shoes', 'regular'], ['robe', 'robe', null, 'p'], ['belt', 'belt', 'regular']], overlays: [['pouch']], palettes: [['olive', 'grey', 'brown'], ['grey', 'olive', 'brown'], ['olive', 'oatmeal', 'darkbrown']], prop: 'reagent_pouch' }),
  mage:       C({ n: 'Mage', pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 's'], ['feet', 'shoes', 'regular'], ['robe', 'robe', null, 'p']], overlays: [['mantle', 'a']], palettes: [['violet', 'stone', 'mutedblue'], ['mutedblue', 'stone', 'violet'], ['indigo', 'stone', 'violet']], prop: 'staff' }),
  scholar:    C({ n: 'Scholar / scribe', pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 's'], ['feet', 'shoes', 'regular'], ['robe', 'robe', null, 'p']], overlays: [['mantle', 'a']], palettes: [['mutedblue', 'stone', 'violet'], ['stone', 'cream', 'mutedblue'], ['violet', 'oatmeal', 'stone']], prop: 'book' }),
  student:    C({ n: 'Student', pieces: [...BASE.slice(0, 2), ['feet', 'shoes', 'regular'], ['robe', 'robe', null, 'p']], overlays: [], palettes: [['violet', 'oatmeal', 'stone'], ['mutedblue', 'linen', 'violet'], ['stone', 'cream', 'violet']], prop: 'book', propIn: 'work' }),
  priest:     C({ n: 'Priest / monk', pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 's'], ['feet', 'shoes', 'regular'], ['robe', 'robe', null, 'p']], overlays: [['sash', 'a']], palettes: [['ivory', 'ochre', 'brown'], ['brown', 'ivory', 'ochre'], ['oatmeal', 'ochre', 'brown']], prop: 'holy_symbol' }),
  ranger:     C({ n: 'Ranger / hunter', pieces: [...BASE.slice(0, 2), ['feet', 'boots', 'regular'], ['chest', 'leather_tunic', 'regular'], ['legs', 'leather_leggings', 'regular'], ['cloak', 'cloak', null, 'p'], ['belt', 'belt', 'regular']], overlays: [['bracer']], palettes: [['forest', 'tan', 'brown'], ['moss', 'fadedtan', 'darkbrown'], ['forest', 'oatmeal', 'pine']], prop: 'bow' }),
  trainer:    C({ n: 'Arms trainer', pieces: [...BASE.slice(0, 2), ['feet', 'boots', 'thick'], ['chest', 'leather_tunic', 'thick'], ['arms', 'leather_sleeves', 'thick'], ['belt', 'belt', 'thick']], overlays: [['sash', 'a']], palettes: [['burgundy', 'tan', 'charcoal'], ['charcoal', 'oatmeal', 'burgundy'], ['brown', 'cream', 'scarlet']], prop: null }),
  traveller:  C({ n: 'Traveller / adventurer', pieces: [...BASE.slice(0, 2), ['feet', 'boots', 'regular'], ['belt', 'belt', 'regular'], ['cloak', 'cloak', null, 'a']], overlays: [['pouch']], palettes: [['fadedtan', 'brown', 'moss'], ['slate', 'oatmeal', 'rust'], ['moss', 'tan', 'fadednavy']], prop: null }),
  villager:   C({ n: 'Villager / laborer', pieces: BASE, overlays: [['skirt', 'p', 'female']], palettes: [['oatmeal', 'rust', 'dustyblue'], ['dustyblue', 'oatmeal', 'rust'], ['rust', 'linen', 'brown'], ['brown', 'oatmeal', 'dustyblue'], ['oatmeal', 'dirt', 'moss']], prop: null }),
  elder:      C({ n: 'Village elder', pieces: [...BASE.slice(0, 2), ['feet', 'shoes', 'regular'], ['cloak', 'cloak', null, 'a']], overlays: [], palettes: [['brown', 'oatmeal', 'moss'], ['warmgrey', 'linen', 'brown'], ['oatmeal', 'brown', 'slate']], prop: null }),
  assayer:    C({ n: 'Assaymaster (guild official)', pieces: [...BASE.slice(0, 3), ['belt', 'belt', 'thick']], overlays: [['vest', 'p'], ['apron_short', 'a'], ['pouch']], palettes: [['slate', 'cream', 'ochre'], ['charcoal', 'linen', 'ochre'], ['stone', 'cream', 'goldbrown']], prop: 'book' }),
  noble:      C({ n: 'Noble / official', pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'p'], ['feet', 'boots', 'thick'], ['robe', 'robe', null, 'p'], ['cloak', 'cloak', null, 'a']], overlays: [['trim', 's']], palettes: [['wine', 'ivory', 'indigo'], ['indigo', 'ivory', 'wine'], ['wine', 'cream', 'goldbrown']], prop: null }),
  beggar:     C({ n: 'Beggar / refugee', pieces: [...BASE.slice(0, 2), ['feet', 'shoes', 'regular'], ['cloak', 'cloak', null, 'a']], overlays: [['wear']], palettes: [['fadedtan', 'charcoal', 'dirt'], ['charcoal', 'fadedtan', 'grey'], ['fadedtan', 'dirt', 'charcoal']], prop: null }),
  prisoner:   C({ n: 'Prisoner / captive', pieces: [['shirt', 'shirt', null, 'p'], ['trousers', 'trousers', null, 's']], overlays: [['wear']], palettes: [['oatmeal', 'grey', 'grey'], ['grey', 'oatmeal', 'grey'], ['linen', 'grey', 'stone']], prop: null }),
  fence:      C({ n: 'Fence / outlaw camp civilian', pieces: [...BASE.slice(0, 2), ['feet', 'boots', 'regular'], ['chest', 'leather_tunic', 'regular'], ['belt', 'belt', 'regular'], ['cloak', 'cloak', null, 'a']], overlays: [['pouch'], ['wear']], palettes: [['charcoal', 'brown', 'wine'], ['darkbrown', 'charcoal', 'rust'], ['charcoal', 'fadedtan', 'scarlet']], prop: null }),
  hireling:   C({ n: 'Hireling (real equipment)', pieces: [], overlays: [], palettes: [['charcoal', 'linen', 'brown']], prop: null, realEquip: true }) };
const H = o => Object.assign({ kind: 'hostile' }, o);
// variants: 2–4 garment / condition combinations; weapon: ONE cosmetic held shape per mob type (mobs have no weapon item and
// every variant has the same rules, so variants differ in cloth and wear, never in armour class)
W.HOSTILE = {
  bandit_road: H({ n: 'Roadside bandit', weapon: 'sword', variants: [
      { pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'p'], ['chest', 'leather_tunic', 'regular'], ['legs', 'leather_leggings', 'regular'], ['feet', 'boots', 'regular'], ['belt', 'belt', 'regular']], overlays: [['headscarf', 'a'], ['wear']], palette: ['brown', 'fadedtan', 'rust'] },
      { pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'p'], ['chest', 'leather_tunic', 'thick'], ['feet', 'boots', 'regular'], ['belt', 'belt', 'regular'], ['cloak', 'cloak', null, 'p']], overlays: [['hood'], ['wear']], palette: ['charcoal', 'brown', 'darkbrown'] },
      { pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'p'], ['arms', 'leather_sleeves', 'regular'], ['legs', 'leather_leggings', 'regular'], ['feet', 'boots', 'regular'], ['head', 'leather_cap', 'regular']], overlays: [['vest', 'a'], ['wear']], palette: ['dirt', 'oatmeal', 'rust'] } ] }),
  smuggler: H({ n: 'Pirate / smuggler', weapon: 'dagger', variants: [
      { pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'p'], ['chest', 'leather_tunic', 'regular'], ['feet', 'boots', 'regular']], overlays: [['sash', 'a'], ['headscarf', 'a'], ['wear']], palette: ['fadednavy', 'linen', 'scarlet'] },
      { pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'p'], ['feet', 'boots', 'regular'], ['belt', 'belt', 'regular']], overlays: [['vest', 'a'], ['headscarf', 'p'], ['wear']], palette: ['slate', 'cream', 'darkbrown'] },
      { pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'p'], ['chest', 'leather_tunic', 'thick'], ['feet', 'boots', 'thick']], overlays: [['sash', 'a'], ['wear']], palette: ['darkbrown', 'sand', 'fadedred'] } ] }),
  drowned_captain: H({ n: 'Drowned captain (human-anatomy undead)', weapon: 'sword', skin: 'drowned', variants: [
      { pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'p'], ['chest', 'leather_tunic', 'thick'], ['feet', 'boots', 'thick'], ['belt', 'belt', 'thick'], ['cloak', 'cloak', null, 'p']], overlays: [['vest', 'a'], ['wear']], palette: ['fadednavy', 'bone', 'goldbrown'] },
      { pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'p'], ['chest', 'leather_tunic', 'thick'], ['feet', 'boots', 'thick'], ['cloak', 'cloak', null, 'p']], overlays: [['sash', 'a'], ['wear']], palette: ['slate', 'bone', 'fadedred'] } ] }),
  // defined for the content that does not exist yet (no live mob id maps here; nothing is spawned for them)
  bandit_archer: H({ n: 'Bandit archer', weapon: 'shortbow', variants: [{ pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'p'], ['chest', 'leather_tunic', 'regular'], ['feet', 'boots', 'regular'], ['cloak', 'cloak', null, 'p']], overlays: [['bracer'], ['wear']], palette: ['moss', 'brown', 'darkbrown'] }, { pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'p'], ['chest', 'studded_tunic', 'regular', null, 'iron'], ['feet', 'boots', 'regular']], overlays: [['bracer'], ['hood']], palette: ['olive', 'tan', 'brown'] }] }),
  highwayman: H({ n: 'Highwayman', weapon: 'dagger', variants: [{ pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 's'], ['chest', 'leather_tunic', 'regular'], ['feet', 'boots', 'thick'], ['cloak', 'cloak', null, 'p']], overlays: [], palette: ['charcoal', 'sootblack', 'wine'] }, { pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 's'], ['feet', 'boots', 'thick'], ['cloak', 'cloak', null, 'p']], overlays: [['hood']], palette: ['grey', 'charcoal', 'darkbrown'] }] }),
  marauder: H({ n: 'Marauder / brigand veteran', weapon: 'waraxe', variants: [{ pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'p'], ['chest', 'ringmail_tunic', 'iron'], ['legs', 'leather_leggings', 'regular'], ['arms', 'plate_arms', 'iron'], ['feet', 'boots', 'thick']], overlays: [['sash', 'a'], ['wear']], palette: ['brown', 'fadedtan', 'scarlet'] }, { pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'p'], ['chest', 'chain_tunic', 'iron'], ['legs', 'studded_leggings', 'regular', null, 'iron'], ['feet', 'boots', 'thick'], ['head', 'norse_helm', 'iron']], overlays: [['wear']], palette: ['dirt', 'oatmeal', 'scarlet'] }] }),
  bandit_chief: H({ n: 'Bandit chief', weapon: 'battleaxe', variants: [{ pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 's'], ['chest', 'chain_tunic', 'iron'], ['arms', 'studded_sleeves', 'thick', null, 'iron'], ['legs', 'studded_leggings', 'thick', null, 'iron'], ['feet', 'boots', 'thick'], ['cloak', 'cloak', null, 'p'], ['head', 'norse_helm', 'iron']], overlays: [['mantle', 'p']], palette: ['burgundy', 'charcoal', 'goldbrown'] }, { pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 's'], ['chest', 'plate_chest', 'iron'], ['legs', 'leather_leggings', 'thick'], ['feet', 'boots', 'thick'], ['cloak', 'cloak', null, 'p']], overlays: [['mantle', 'p']], palette: ['wine', 'darkbrown', 'goldbrown'] }] }),
  deserter: H({ n: 'Deserter / mercenary', weapon: 'sword', shield: 'metal_shield', variants: [{ pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'p'], ['chest', 'chain_tunic', 'iron'], ['legs', 'leather_leggings', 'regular'], ['feet', 'boots', 'regular'], ['tunic', 'tabard', null, 'p']], overlays: [['wear']], palette: ['fadedtan', 'brown', 'grey'] }, { pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 'p'], ['chest', 'ringmail_tunic', 'iron'], ['arms', 'leather_sleeves', 'regular'], ['feet', 'boots', 'regular'], ['head', 'bascinet', 'iron']], overlays: [['wear']], palette: ['grey', 'dirt', 'fadedred'] }] }),
  cultist: H({ n: 'Cultist / necromancer', weapon: 'staff', variants: [{ pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 's'], ['feet', 'shoes', 'regular'], ['robe', 'robe', null, 'p']], overlays: [['hood'], ['trim', 'a']], palette: ['sootblack', 'charcoal', 'bone'] }, { pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 's'], ['feet', 'shoes', 'regular'], ['robe', 'robe', null, 'p']], overlays: [['mantle', 'a']], palette: ['plum', 'sootblack', 'bone'] }] }),
  rogue_mage: H({ n: 'Rogue mage', weapon: 'staff', variants: [{ pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 's'], ['feet', 'shoes', 'regular'], ['robe', 'robe', null, 'p']], overlays: [['mantle', 'a'], ['wear']], palette: ['ashblue', 'charcoal', 'plum'] }, { pieces: [['shirt', 'shirt', null, 's'], ['trousers', 'trousers', null, 's'], ['feet', 'shoes', 'regular'], ['robe', 'robe', null, 'p']], overlays: [['mantle', 'a']], palette: ['plum', 'stone', 'ashblue'] }] }) };
// non-staff "weapons" in W.HOSTILE that are not SF.WEAPONS ids are cosmetic shapes (staff) — validated against W.PROPS / SF.WEAPONS

/* ---------------- live id → wardrobe role (explicit; unknown roles are logged and fall back to 'villager') ---------------- */
// game npc.role → role
W.ROLE_ALIAS = { smith: 'blacksmith', qsmith: 'blacksmith', miner: 'merchant', tailor: 'tailor', tinker: 'tinker', provisioner: 'merchant', fishmonger: 'fishmonger',
  innkeeper: 'innkeeper', workshop: 'fletcher', fletcher: 'fletcher', ranger: 'ranger', reagents: 'reagents', mage: 'mage', scholar: 'scholar', banker: 'banker', campbank: 'fence',
  healer: 'healer', apothecary: 'healer', trainer: 'trainer', assay: 'assayer', boat: 'captain_sea', packet: 'captain_sea', ferry: 'sailor', stable: 'farmer',
  outlaw: 'fence', trader: 'trader', traveller: 'traveller', guard: 'guard', quaywarden: 'guard' };
// town-life profession (e.life.prof) → role, for residents whose npc.role is the generic 'resident'
W.PROF_ALIAS = { fisher: 'fisher', dockhand: 'sailor', townsfolk: 'villager', miner: 'miner', woodcutter: 'woodcutter', student: 'student' };
// stable actor id → role, where the name says more than the generic profession (data, reviewable; never changes the NPC's rules)
W.ACTOR_ROLE = { 'npc:lise-weaver': 'tailor', 'npc:mabry-cook': 'cook', 'npc:ysolde-herb-gatherer': 'herbalist', 'npc:old-tomas': 'elder', 'npc:corin-carter': 'villager',
  'npc:tollin-mine-stores': 'miner', 'npc:sister-maud-healer': 'priest', 'npc:sister-ewe-healer': 'priest', 'npc:sister-moira-healer': 'priest', 'npc:brother-lune-healer': 'priest', 'npc:wren': 'hireling' };
// mob type → hostile preset (only ids that exist in the game; everything else keeps its own creature art untouched)
W.MOB_ROLE = { bandit: 'bandit_road', smuggler: 'smuggler', captain: 'drowned_captain' };
// named officers
W.ACTOR_RANK = { 'npc:quaywarden-brann': 'captain', 'npc:ranger-captain-hale': null };
// region where the npc has no town field (the starter Quay predates towns): from its stable id; anything else asks the zone
W.ACTOR_REGION = { 'npc:captain-bram-vespar-packet': 'saltmarsh' };
// id prefixes: the Quay wardens stand at the Quay's gates and outposts, just outside the 'quay' zone rectangle
W.ACTOR_REGION_PREFIX = { 'npc:quay-warden': 'saltmarsh' };
// body from the existing identity (name / title). Absent ids are seeded. Never changes the NPC's name, role or rules.
const F = 'female', M = 'male';
W.ACTOR_BODY = { 'npc:odile-banker': F, 'npc:harl-smith': M, 'npc:master-vey-trainer': M, 'npc:pell-bowyer': M, 'npc:sorrel-apothecary': F, 'npc:gus-provisioner': M,
  'npc:mara-quay-smith': F, 'npc:dena-assaymaster': F, 'npc:sister-maud-healer': F, 'npc:quaywarden-brann': M, 'npc:old-fenna-camp-healer': F, 'npc:mags-fence': F,
  'npc:hobb-mynoc-banker': M, 'npc:brega-forgemistress': F, 'npc:tollin-mine-stores': M, 'npc:sister-ewe-healer': F, 'npc:merrin-tailor': F, 'npc:pip-tinker': M,
  'npc:adda-supplies': F, 'npc:old-cray-fishmonger': M, 'npc:brother-lune-healer': M, 'npc:captain-rhea-moonglen-boat': F, 'npc:captain-ysolde-quay-packet': F,
  'npc:tam-ferryman': M, 'npc:wenna-ferrywoman': F, 'npc:ivo-skara-banker': M, 'npc:maeve-innkeeper': F, 'npc:old-rowan-healer': M, 'npc:ranger-captain-hale': M,
  'npc:dorn-stablehand': M, 'npc:sela-college-bank': F, 'npc:magister-orrin': M, 'npc:nettle-reagent-seller': F, 'npc:pell-innkeeper': M, 'npc:astronomer-iska': F,
  'npc:sister-moira-healer': F, 'npc:captain-hollis-vespar-boat': M, 'npc:captain-bram-vespar-packet': M, 'npc:nell-fisherwoman': F, 'npc:garrick-dockhand': M,
  'npc:lise-weaver': F, 'npc:old-tomas': M, 'npc:corin-carter': M, 'npc:durn-miner': M, 'npc:kessa-miner': F, 'npc:fennick-woodcutter': M, 'npc:mabry-cook': F,
  'npc:ysolde-herb-gatherer': F, 'npc:tibbet-student': M, 'npc:mira-student': F, 'npc:tobin-travelling-merchant': M, 'npc:wren': F };

/* ---------------- identity (body, skin, hair, beard): stable per actor, independent of role, wealth or hostility ---------------- */
W.SKINS = ['fair', 'tan', 'olive', 'brown', 'deep'];
W.HAIRS = ['black', 'brown', 'darkBrown', 'blond', 'auburn', 'grey', 'white'];
W.STYLES = ['bald', 'cropped', 'short', 'parted', 'long', 'ponytail', 'bun', 'braid'];
W.BEARDS = ['none', 'stubble', 'goatee', 'short', 'full'];
const STYLE_W = { male: [['bald', 1], ['cropped', 3], ['short', 4], ['parted', 3], ['long', 1], ['ponytail', 1]], female: [['short', 1], ['parted', 1], ['long', 3], ['ponytail', 2], ['bun', 3], ['braid', 3], ['cropped', .5]] };
const BEARD_W = [['none', 4], ['stubble', 2], ['goatee', 1], ['short', 2], ['full', 2]];
function identityFor(id, opts) {
  const o = opts || {}, seed = id + '#w' + W.SEED_REV, old = !!o.old;
  const body = o.body || pickW(seed, 'body', [[M, 1], [F, 1]]);
  const hair = old ? pickW(seed, 'hair', [['grey', 3], ['white', 2], ['darkBrown', .5]]) : pickW(seed, 'hair', [['black', 3], ['brown', 4], ['darkBrown', 3], ['blond', 2], ['auburn', 1.5], ['grey', .4]]);
  const style = pickW(seed, 'style', STYLE_W[body]);
  return { body, skin: o.skin || pickW(seed, 'skin', W.SKINS), hair, style: old && body === M && roll(seed, 'bald') < .35 ? 'bald' : style, beard: body === M ? pickW(seed, 'beard', BEARD_W) : 'none' };
}
W.identityFor = identityFor;

/* ---------------- role / region / rank resolution ---------------- */
const logged = new Set(); W.fallbackLog = [];
function logFallback(msg) { if (logged.has(msg)) return; logged.add(msg); W.fallbackLog.push(msg); if (root.console && root.console.warn) root.console.warn('[wardrobe] ' + msg); }
// a = actor-like { actorId, kind, role, type, town, life:{prof}, name, equip }
function roleOf(a) {
  const id = a.actorId || '';
  if (a.kind === 'mon') { const r = W.MOB_ROLE[a.type]; return r ? { role: r, kind: 'hostile', via: 'mob:' + a.type } : null; }
  if (a.kind === 'player') return { role: 'player', kind: 'player', via: 'player' };
  if (W.ACTOR_ROLE[id]) return { role: W.ACTOR_ROLE[id], kind: 'civilian', via: 'actor:' + id };
  if (a.kind === 'ally') return { role: 'hireling', kind: 'civilian', via: 'ally' };
  if (a.role === 'resident' && a.life && W.PROF_ALIAS[a.life.prof]) return { role: W.PROF_ALIAS[a.life.prof], kind: 'civilian', via: 'prof:' + a.life.prof };
  const r = W.ROLE_ALIAS[a.role];
  if (r === 'guard') return { role: 'guard', kind: 'guard', via: 'role:' + a.role };
  if (r) return { role: r, kind: 'civilian', via: 'role:' + a.role };
  logFallback('unknown role "' + a.role + '"' + (a.life ? ' / prof "' + a.life.prof + '"' : '') + ' (' + (id || a.name) + ') → villager fallback');
  return { role: 'villager', kind: 'civilian', via: 'fallback', fallback: true };
}
W.roleOf = roleOf;
function regionOf(a, zoneId) {
  const id = a.actorId || ''; if (W.ACTOR_REGION[id]) return W.ACTOR_REGION[id];
  for (const k in W.ACTOR_REGION_PREFIX) if (id.startsWith(k)) return W.ACTOR_REGION_PREFIX[k];
  return W.REGION_ALIAS[a.town] || W.REGION_ALIAS[zoneId] || null;
}
W.regionOf = regionOf;

/* ---------------- the activity → outfit state (reads the existing town-life state; changes nothing in the simulation) ---------------- */
// states: work (at the job: apron, work prop), off (home, hall, market: no prop, no work apron), travel (on the road: cloak),
//         sleep (indoors; no sleeping-clothes art, so it is 'off' + no prop), duty (guards: always armed — no off-duty schedule exists)
W.outfitState = (a, ctx) => {
  const L = a.life, c = ctx || {};
  if (a.kind === 'mon') return 'duty';
  if (a.role === 'guard' || a.role === 'quaywarden') return 'duty';
  if (!L) return 'work';                                   // posts that never close: bankers, healers, ferries, boats, the Quay
  const d = L.doing, g = L.goal && L.goal.act;
  if (L.prof === 'trader') return d === 'walk' ? 'travel' : d === 'sleep' ? 'sleep' : 'work';
  if (d === 'sleep') return 'sleep';
  if (d === 'work' || d === 'gather' || d === 'study') return 'work';
  if (d === 'walk' && (g === 'work' || g === 'gather' || g === 'study')) return 'work';
  if (d === 'idle' && !L.goal) return 'work';            // freshly placed shopkeepers stand at their counters
  return 'off';
};

/* ---------------- the resolver ---------------- */
const dyeOf = (pal, slot) => slot ? (pal[slot] || W.dye(slot)) : null;
function pieceFrom(p, pal, source) {
  const [slot, id, mat, dye, sec] = p; const d = SF.ITEMS[id];
  const out = { slot, id, source, material: mat || (d && d.fixedMat) || null };
  if (sec) out.sec = sec;
  if (dye && d && (d.fam === 'cloth' || d.fixedMat === 'cloth')) out.dye = dyeOf(pal, dye);
  return out;
}
function applyRank(pieces, kit, rank) {
  const r = rank && kit.ranks[rank]; if (!r) return { pieces, overlays: [] };
  let out = pieces.filter(p => !(r.drop || []).includes(p[0]));
  for (const s of r.set || []) { out = out.filter(p => p[0] !== s[0]); out.push(s); }
  return { pieces: out, overlays: r.overlays || [] };
}
// pick a weapon for a guard: by roster index, so a town's guards differ but each one is always the same
W.resolve = function (a, ctx) {
  const c = ctx || {}, id = a.actorId || (a.kind === 'player' ? 'player:p1' : 'anon:' + (a.name || '?'));
  const ro = roleOf(a); if (!ro) return null;
  const region = ro.kind === 'hostile' ? null : regionOf(a, c.zone);
  const R = region ? W.REGIONS[region] : null;
  const old = /^Old\b/.test(a.name || '');
  const look = a.kind === 'player' && a.look && a.look.body ? a.look : null;
  const ident = look ? { body: look.body, skin: look.skin, hair: look.hair, style: look.style, beard: look.beard } : identityFor(id, { body: W.ACTOR_BODY[id], old, skin: ro.kind === 'hostile' && W.HOSTILE[ro.role].skin });
  const D = { v: W.VERSION, rev: W.SEED_REV, actorId: id, role: ro.role, kind: ro.kind, via: ro.via, fallback: !!ro.fallback, region, faction: R ? R.faction : null, rank: null,
    ...ident, palette: null, pieces: {}, overlays: [], weapon: null, shield: null, prop: null, offProp: null, state: W.outfitState(a, c), act: null, source: 'cosmetic', missing: [] };
  const put = (p, src) => { D.pieces[p.slot] = p; };
  let overlays = [];
  if (a.equip && (a.kind === 'player' || a.kind === 'ally' || W.ROLES[ro.role] && W.ROLES[ro.role].realEquip)) {
    // real equipment: exactly what the actor wears, nothing added
    D.source = 'equip'; D.palette = { p: a.kind === 'player' && a.look && isHex(a.look.cloak) ? a.look.cloak : W.DYES.charcoal, s: W.DYES.linen, a: W.DYES.brown };
    for (const s in a.equip) { const it = a.equip[s]; if (!it || s === 'weapon' || s === 'shield') continue; D.pieces[s] = { slot: s, id: it.id, source: 'equip', material: SF.matOf(it) || (SF.ITEMS[it.id] && SF.ITEMS[it.id].fixedMat) || null, sec: it.sec || null, broken: it.cond === 0, uid: it.uid }; }
    const w = a.equip.weapon, sh = a.equip.shield;
    if (w) D.weapon = { id: (SF.ITEMS[w.id] && SF.ITEMS[w.id].wpn) || w.id, item: w.id, material: SF.matOf(w), source: 'equip' };
    if (sh && !(w && SF.EQ.twoHanded(w))) D.shield = { id: sh.id, material: SF.matOf(sh), source: 'equip' };
  } else if (ro.kind === 'guard') {
    const kit = W.UNIFORMS[region] || null;
    if (!kit) { D.missing.push('uniform for region ' + (region || 'none')); logFallback('guard ' + id + ' has no regional uniform (region ' + region + ') → villager clothing'); return W.resolveCivilian(D, 'villager', a, c); }
    const rank = W.ACTOR_RANK[id] !== undefined && W.ACTOR_RANK[id] ? W.ACTOR_RANK[id] : W.ROSTER[(c.rosterIndex || 0) % W.ROSTER.length];
    D.rank = rank; D.palette = { p: R.p, s: R.s, a: R.a };
    const k = applyRank(kit.base.pieces, kit, rank);
    for (const p of k.pieces) put(pieceFrom(p, D.palette, 'cosmetic'));
    overlays = [['heraldry', 'a']].concat(k.overlays.map(o => [o, 'a']));
    const arm = kit.base.arms[(c.rosterIndex || 0) % kit.base.arms.length];
    D.weapon = { id: arm.weapon, source: 'cosmetic' }; if (arm.shield) D.shield = { id: arm.shield, material: arm.shieldMat, source: 'cosmetic' };
    if (c.night && c.watch && !arm.shield && !(SF.WEAPONS[arm.weapon] && SF.WEAPONS[arm.weapon].two)) D.offProp = 'lantern';
  } else if (ro.kind === 'hostile') {
    const h = W.HOSTILE[ro.role], v = h.variants[hash32(id + '#v' + W.SEED_REV) % h.variants.length];
    D.palette = { p: W.dye(v.palette[0]), s: W.dye(v.palette[1]), a: W.dye(v.palette[2]) };
    for (const p of v.pieces) put(pieceFrom(p, D.palette, 'cosmetic'));
    overlays = v.overlays.slice();
    D.weapon = { id: h.weapon, source: 'cosmetic' }; if (h.shield) D.shield = { id: h.shield, material: 'iron', source: 'cosmetic' };
    D.variant = h.variants.indexOf(v);
  } else return W.resolveCivilian(D, ro.role, a, c);
  return W.finish(D, overlays);
};
W.resolveCivilian = function (D, role, a, c) {
  const r = W.ROLES[role] || W.ROLES.villager; D.role = W.ROLES[role] ? role : 'villager';
  const pal = r.palettes[hash32(D.actorId + '#pal' + W.SEED_REV) % r.palettes.length];
  D.palette = { p: W.dye(pal[0]), s: W.dye(pal[1]), a: W.dye(pal[2]) }; D.paletteIndex = r.palettes.indexOf(pal);
  const st = D.state;
  for (const p of r.pieces) {
    if ((r.workOnly || []).includes(p[0]) && st !== 'work') continue;
    if ((r.travelOnly || []).includes(p[0]) && st !== 'travel') continue;
    D.pieces[p[0]] = pieceFrom(p, D.palette, 'cosmetic');
  }
  let overlays = r.overlays.filter(o => !o[2] || o[2] === D.body).filter(o => !(r.workOnly || []).includes(o[0]) || st === 'work').map(o => [o[0], o[1]]);
  // region accent: civilians of a town wear a little of its colour only if the recipe has no strong accent of its own (none today)
  if (r.prop && (r.propIn ? st === r.propIn : st === 'work')) D.prop = r.prop;
  return W.finish(D, overlays);
};
W.finish = function (D, overlays) {
  D.overlays = [];
  for (const [id, slot] of overlays) { const o = W.OVERLAYS[id]; if (!o) { D.missing.push('overlay ' + id + ' (unregistered)'); continue; } if (o.status === 'missing') { D.missing.push('overlay ' + id); continue; } D.overlays.push({ id, color: slot ? dyeOf(D.palette, slot) : null }); }
  // which gesture the actor makes when standing at work (rig animation id; drawn only while not moving)
  if (D.prop) { const pr = W.PROPS[D.prop]; if (!pr || pr.status === 'missing') { D.missing.push('prop ' + D.prop); D.prop = null; } else D.act = pr.act || null; }
  if (D.offProp && W.PROPS[D.offProp].status === 'missing') { D.missing.push('prop ' + D.offProp); D.offProp = null; }
  D.key = W.keyOf(D);
  return D;
};
// the visual signature: everything that changes pixels (and only that). Item uid is never part of it.
W.keyOf = D => [D.v, D.body, D.skin, D.hair, D.style, D.beard, D.palette && D.palette.p, D.palette && D.palette.s,
  Object.keys(D.pieces).sort().map(s => { const p = D.pieces[s]; return s + ':' + p.id + ':' + (p.material || '') + ':' + (p.sec || '') + ':' + (p.dye || '') + (p.broken ? ':x' : ''); }).join(','),
  D.overlays.map(o => o.id + (o.color || '')).join(','), D.weapon ? D.weapon.id + ':' + (D.weapon.material || '') : '-', D.shield ? D.shield.id + ':' + (D.shield.material || '') : '-', D.prop || '-', D.offProp || '-'].join('|');

/* ---------------- validation: every reference is real; no two-hander with a shield; palettes well formed ---------------- */
W.validate = function () {
  const err = [], item = (id, slot, where) => { const d = SF.ITEMS[id]; if (!d) return err.push(where + ': unknown item ' + id); if (slot && d.slot !== slot) err.push(where + ': ' + id + ' is a ' + d.slot + ' piece, not ' + slot); };
  const mat = (p, where) => { const [slot, id, m, dye, sec] = p; const d = SF.ITEMS[id]; if (!d) return; const prim = d.prim || (d.fixedMat ? 'fixed' : null);
    if (prim === 'metal' && !(m && SF.METAL[m])) err.push(where + ': ' + id + ' needs a metal id, has ' + m);
    if (prim === 'hide' && !(m && SF.EQ.HIDES[m])) err.push(where + ': ' + id + ' needs a hide id, has ' + m);
    if (prim === 'wood' && !(m && SF.WOOD[m])) err.push(where + ': ' + id + ' needs a wood id, has ' + m);
    if (prim === 'fixed' && m) err.push(where + ': ' + id + ' has a fixed material, not ' + m);
    if (d.sec === 'metal' && !(sec && SF.METAL[sec])) err.push(where + ': ' + id + ' needs a metal for its studs');
    if (dye && !(dye === 'p' || dye === 's' || dye === 'a' || W.dye(dye))) err.push(where + ': bad dye ' + dye);
    if (dye && !(d.fam === 'cloth')) err.push(where + ': ' + id + ' is not cloth and cannot take a dye'); };
  const pieces = (list, where) => { const seen = {}; for (const p of list) { item(p[1], p[0], where); mat(p, where); if (seen[p[0]]) err.push(where + ': two pieces in ' + p[0]); seen[p[0]] = 1; } };
  const weap = (w, sh, where) => { const isW = SF.WEAPONS[w], isP = W.PROPS[w] || w === 'staff'; if (!isW && !isP) err.push(where + ': unknown weapon ' + w); if (sh) { item(sh, 'shield', where); if (isW && isW.two) err.push(where + ': two-handed ' + w + ' with a shield ' + sh); } };
  for (const k in W.DYES) if (!isHex(W.DYES[k])) err.push('dye ' + k + ' is not #rrggbb');
  for (const k in W.REGIONS) { const r = W.REGIONS[k]; for (const c of ['p', 's', 'a']) if (!isHex(r[c])) err.push('region ' + k + '.' + c); if (!W.UNIFORMS[k]) err.push('region ' + k + ' has no uniform'); }
  for (const k in W.UNIFORMS) { const u = W.UNIFORMS[k]; pieces(u.base.pieces, 'uniform ' + k); for (const a of u.base.arms) weap(a.weapon, a.shield, 'uniform ' + k);
    if (!u.base.pieces.some(p => p[3] === 'p')) err.push('uniform ' + k + ' wears no regional colour');
    for (const r of W.RANKS) { if (r === 'patrol') continue; if (!u.ranks[r]) { err.push('uniform ' + k + ' has no ' + r); continue; } const res = applyRank(u.base.pieces, u, r); pieces(res.pieces, 'uniform ' + k + '/' + r); if (!res.pieces.some(p => p[3] === 'p')) err.push('uniform ' + k + '/' + r + ' loses the regional colour'); for (const o of res.overlays) if (!W.OVERLAYS[o]) err.push('uniform ' + k + '/' + r + ': overlay ' + o); } }
  for (const k in W.ROLES) { const r = W.ROLES[k]; pieces(r.pieces, 'role ' + k); if (!r.realEquip && (r.palettes.length < 3 || r.palettes.length > 5)) err.push('role ' + k + ': ' + r.palettes.length + ' palettes (3–5)');
    for (const p of r.palettes) for (const c of p) if (!W.dye(c)) err.push('role ' + k + ': dye ' + c); for (const o of r.overlays) if (!W.OVERLAYS[o[0]]) err.push('role ' + k + ': overlay ' + o[0]); if (r.prop && !W.PROPS[r.prop]) err.push('role ' + k + ': prop ' + r.prop); }
  for (const k in W.HOSTILE) { const h = W.HOSTILE[k]; if (h.variants.length < 2 || h.variants.length > 4) err.push('hostile ' + k + ': ' + h.variants.length + ' variants (2–4)'); weap(h.weapon, h.shield, 'hostile ' + k);
    h.variants.forEach((v, i) => { pieces(v.pieces, 'hostile ' + k + '#' + i); for (const c of v.palette) if (!W.dye(c)) err.push('hostile ' + k + ': dye ' + c); for (const o of v.overlays) if (!W.OVERLAYS[o[0]]) err.push('hostile ' + k + ': overlay ' + o[0]); }); }
  for (const k in W.ROLE_ALIAS) { const r = W.ROLE_ALIAS[k]; if (r !== 'guard' && !W.ROLES[r]) err.push('role alias ' + k + ' → unknown ' + r); }
  for (const k in W.PROF_ALIAS) if (!W.ROLES[W.PROF_ALIAS[k]]) err.push('prof alias ' + k);
  for (const k in W.ACTOR_ROLE) if (!W.ROLES[W.ACTOR_ROLE[k]]) err.push('actor role ' + k);
  for (const k in W.MOB_ROLE) if (!W.HOSTILE[W.MOB_ROLE[k]]) err.push('mob role ' + k);
  for (const k in W.ACTOR_REGION) if (!W.REGIONS[W.ACTOR_REGION[k]]) err.push('actor region ' + k);
  for (const k in W.ACTOR_REGION_PREFIX) if (!W.REGIONS[W.ACTOR_REGION_PREFIX[k]]) err.push('actor region prefix ' + k);
  for (const k in W.ACTOR_BODY) if (W.ACTOR_BODY[k] !== M && W.ACTOR_BODY[k] !== F) err.push('actor body ' + k);
  for (const k in W.PROPS) { const p = W.PROPS[k]; if (!['procedural', 'missing'].includes(p.status)) err.push('prop ' + k + ' status'); }
  return err;
};

/* ---------------- coverage: the matrix the docs and tests print from the live game ---------------- */
W.coverageRow = (a, D) => ({ id: a.actorId || a.type, kind: a.kind, gameRole: a.kind === 'mon' ? a.type : (a.role || '') + (a.life && a.life.prof ? '/' + a.life.prof : ''), region: D ? D.region : null,
  role: D ? D.role : null, rank: D ? D.rank : null, body: D ? D.body : null, source: D ? D.source : null, via: D ? D.via : null, fallback: D ? D.fallback : null,
  overlays: D ? D.overlays.map(o => o.id) : [], prop: D ? D.prop : null, missing: D ? D.missing : ['no human wardrobe (creature art unchanged)'] });

SF.WARDROBE = W;
if (typeof module !== 'undefined' && module.exports) module.exports = W;
})(typeof globalThis !== 'undefined' ? globalThis : this);
</script>
