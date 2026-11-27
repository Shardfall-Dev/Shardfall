<script>
/* Shardfall appearance module (SF.LOOK) — classic humans v2 (docs/humans/STATUS.md).
   Pure, renderer-free, network-free: no DOM, no Canvas, no Math.random. Runs in the browser and in node for tests.
   Appearance is cosmetic only. Nothing here is read by combat, skills, stats, movement, collision, targeting or loot.
   - the appearance record a character keeps in its save ({ v, body, skin, hair, hairColor, beard, cloth, cloak? })
   - normalize / migrate old looks without rerolling, seeded randomize, validation
   - profession presets and persistent, seeded NPC looks (same NPC → same look on every load)
   - the render figure: base look + visible equipment (EQ.appearance tints) → one stable description and cache key
   - every weapon in SF.WEAPONS → its animation family and weapon geometry; spell → casting gesture; tool → gathering motion
   - the visual animation priority: death > hit/interrupt > attack/cast/tool > ready > run/walk > idle */
(function (root) {
'use strict';
const SF = root.SF;
const LOOK = {};
LOOK.VERSION = 1;

/* ---------- options (ids are stable; colours live here so the creator, world and paper doll agree) ---------- */
LOOK.BODIES = ['male', 'female'];
LOOK.SKIN = { fair: '#ca9a72', tan: '#ac7854', olive: '#937450', brown: '#815338', deep: '#684333' };
LOOK.HAIR = { black: '#302a25', darkBrown: '#493327', brown: '#65452e', auburn: '#914a32', blond: '#b69a58', grey: '#8b8981', white: '#c5c1b6' };
LOOK.HAIRSTYLES = ['bald', 'cropped', 'short', 'parted', 'long', 'ponytail', 'bun', 'braid'];
LOOK.BEARDS = ['none', 'stubble', 'goatee', 'short', 'full'];
LOOK.CLOTH = { linen: '#ac9776', cream: '#c6bda5', brown: '#78513a', rust: '#95573c', ochre: '#a17b39', forest: '#4d6845', teal: '#436b69', navy: '#3b5676', purple: '#6d5279', burgundy: '#823e38', charcoal: '#50504b', black: '#393a39' };
LOOK.NAMES = {
  skin: { fair: 'Fair', tan: 'Tan', olive: 'Olive', brown: 'Brown', deep: 'Deep' },
  hair: { black: 'Black', darkBrown: 'Dark brown', brown: 'Brown', auburn: 'Auburn', blond: 'Blond', grey: 'Grey', white: 'White' },
  hairStyle: { bald: 'Bald', cropped: 'Cropped', short: 'Short', parted: 'Parted', long: 'Long', ponytail: 'Ponytail', bun: 'Bun', braid: 'Braid' },
  beard: { none: 'None', stubble: 'Stubble', goatee: 'Goatee', short: 'Short beard', full: 'Full beard' },
  cloth: { linen: 'Linen', cream: 'Cream', brown: 'Brown', rust: 'Rust', ochre: 'Ochre', forest: 'Forest', teal: 'Teal', navy: 'Navy', purple: 'Purple', burgundy: 'Burgundy', charcoal: 'Charcoal', black: 'Black' } };
const keys = o => Object.keys(o);

/* ---------- seeded numbers (string hash → mulberry32); never Math.random, so a seed always gives the same look ---------- */
LOOK.hash = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
LOOK.rng = seed => { let a = (typeof seed === 'number' ? seed : LOOK.hash(seed)) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
const pickW = (r, pairs) => { let tot = 0; for (const [, w] of pairs) tot += w; let x = r() * tot; for (const [v, w] of pairs) { if ((x -= w) < 0) return v; } return pairs[pairs.length - 1][0]; };

/* ---------- the saved appearance record ---------- */
LOOK.valid = l => !!l && LOOK.BODIES.includes(l.body) && !!LOOK.SKIN[l.skin] && !!LOOK.HAIR[l.hairColor] && LOOK.HAIRSTYLES.includes(l.hair) && LOOK.BEARDS.includes(l.beard) && !!LOOK.CLOTH[l.cloth] && (l.body === 'male' || l.beard === 'none');
/* random appearance from a seed: a fresh "Randomize" in the creator and the default for old saves that never had one */
LOOK.random = (seed, o) => {
  const r = LOOK.rng(seed), body = (o && o.body) || (r() < .5 ? 'male' : 'female');
  const hair = body === 'female' ? pickW(r, [['long', 3], ['ponytail', 2], ['bun', 2], ['braid', 2], ['short', 1], ['cropped', .5]]) : pickW(r, [['short', 3], ['cropped', 2], ['parted', 2], ['long', 1], ['bald', 1], ['ponytail', .5]]);
  const hairColor = pickW(r, [['black', 2], ['darkBrown', 3], ['brown', 3], ['auburn', 1.5], ['blond', 1.5], ['grey', .6], ['white', .3]]);
  return { v: LOOK.VERSION, body, skin: pick(r, keys(LOOK.SKIN)), hair, hairColor, beard: body === 'female' ? 'none' : pickW(r, [['none', 3], ['stubble', 2], ['goatee', 1], ['short', 2], ['full', 1.5]]), cloth: pick(r, keys(LOOK.CLOTH)) };
};
/* normalize: the one migration path. Keeps every valid field, fills only what is missing or unknown from a seeded default,
   keeps unknown extra fields (and the legacy cloak colour) untouched, and is idempotent: normalize(normalize(x)) equals normalize(x).
   Old saves (look = { cloak }) get a stable look from the character's name, written back into the save — never rerolled on load. */
LOOK.normalize = (look, seed) => {
  const l = Object.assign({}, look && typeof look === 'object' ? look : {}), d = LOOK.random('look:' + (seed || 'adventurer'), LOOK.BODIES.includes(l.body) ? { body: l.body } : null);
  if (!LOOK.BODIES.includes(l.body)) l.body = d.body;
  if (!LOOK.SKIN[l.skin]) l.skin = d.skin;
  if (!LOOK.HAIRSTYLES.includes(l.hair)) l.hair = d.hair;
  if (!LOOK.HAIR[l.hairColor]) l.hairColor = d.hairColor;
  if (!LOOK.BEARDS.includes(l.beard)) l.beard = l.body === 'female' ? 'none' : d.beard;
  if (l.body === 'female') l.beard = 'none';
  if (!LOOK.CLOTH[l.cloth]) l.cloth = d.cloth;
  if (l.cloak !== undefined && l.cloak !== null && !/^#[0-9a-f]{6}$/i.test(String(l.cloak))) l.cloak = null;
  l.v = LOOK.VERSION; return l;
};
/* validation for an untrusted appearance (creator, and later a server): '' when valid, else the reason */
LOOK.check = l => {
  if (!l || typeof l !== 'object') return 'no appearance';
  if (!LOOK.BODIES.includes(l.body)) return 'unknown body';
  if (!LOOK.SKIN[l.skin]) return 'unknown skin tone';
  if (!LOOK.HAIRSTYLES.includes(l.hair)) return 'unknown hairstyle';
  if (!LOOK.HAIR[l.hairColor]) return 'unknown hair colour';
  if (!LOOK.BEARDS.includes(l.beard)) return 'unknown facial hair';
  if (l.body === 'female' && l.beard !== 'none') return 'facial hair is for the male body';
  if (!LOOK.CLOTH[l.cloth]) return 'unknown clothing colour';
  return '';
};

/* ---------- weapons → animation family and weapon geometry (authoritative ids from SF.WEAPONS) ----------
   family is the body motion the rig plays; geom is the drawn weapon shape. The flags (two, ammo, skill) stay in SF.WEAPONS;
   grip (1h/2h) is read from SF.WEAPONS[id].two, never guessed from the name. */
LOOK.WEAPON_ANIM = {
  unarmed:       { family: 'unarmed',  geom: 'fist',          group: 'wrestling' },
  sword:         { family: 'slash1h',  geom: 'sword',         group: 'sword1h' },
  glaive:        { family: 'polearm',  geom: 'halberd',       group: 'polearm' },
  battleaxe:     { family: 'chop2h',   geom: 'battleaxe',     group: 'axe2h' },
  hatchet:       { family: 'chop2h',   geom: 'hatchet',       group: 'axe2h', tool: 'chopwood' },
  knife:         { family: 'slash1h',  geom: 'knife',         group: 'dagger' },
  pickaxe:       { family: 'chop1h',   geom: 'pickaxe',       group: 'axe1h', tool: 'mine' },
  hammer:        { family: 'blunt2h',  geom: 'warhammer',     group: 'warhammer' },
  mace:          { family: 'blunt1h',  geom: 'mace',          group: 'mace' },
  waraxe:        { family: 'chop1h',   geom: 'axe',           group: 'axe1h' },
  dagger:        { family: 'thrust1h', geom: 'dagger',        group: 'dagger' },
  kryss:         { family: 'thrust1h', geom: 'kryss',         group: 'fencing' },
  spear:         { family: 'thrust2h', geom: 'spear',         group: 'spear' },
  shortbow:      { family: 'bow',      geom: 'bow',           group: 'bow' },
  crossbow:      { family: 'crossbow', geom: 'crossbow',      group: 'crossbow' },
  heavycrossbow: { family: 'hcrossbow', geom: 'heavycrossbow', group: 'heavycrossbow' } };
/* geometry the rig can draw for items that do not exist yet (greatswords, staves, longbows, …): ready for future weapons */
LOOK.FUTURE_GEOMS = ['greatsword', 'broadsword', 'katana', 'rapier', 'doubleaxe', 'maul', 'club', 'shortspear', 'bardiche', 'staff', 'quarterstaff', 'longbow', 'wand'];
LOOK.FUTURE_FAMILY = { greatsword: 'slash2h', broadsword: 'slash1h', katana: 'slash1h', rapier: 'thrust1h', doubleaxe: 'chop2h', maul: 'blunt2h', club: 'blunt1h', shortspear: 'thrust1h', bardiche: 'polearm', staff: 'staff', quarterstaff: 'staff', longbow: 'bow', wand: 'cast1h' };
LOOK.weaponAnim = id => LOOK.WEAPON_ANIM[id] || null;
/* the ids in SF.WEAPONS without a mapping: must be empty for a release (tests fail otherwise; never mapped silently) */
LOOK.unmapped = () => SF && SF.WEAPONS ? Object.keys(SF.WEAPONS).filter(id => !LOOK.WEAPON_ANIM[id]) : [];
LOOK.twoHanded = id => !!(SF && SF.WEAPONS && SF.WEAPONS[id] && SF.WEAPONS[id].two);
/* gathering: the tool motion by skill; the tool is drawn even when it rides in the pack */
LOOK.TOOL_ANIM = { mining: { family: 'mine', geom: 'pickaxe' }, lumberjacking: { family: 'chopwood', geom: 'hatchet' }, woodcutting: { family: 'chopwood', geom: 'hatchet' }, fishing: { family: 'fish', geom: 'fishingpole' } };
LOOK.toolAnim = skill => LOOK.TOOL_ANIM[skill] || { family: 'craft', geom: null };
/* crafting motion by station or recipe category */
LOOK.craftAnim = kind => /smith|forge|anvil|smelt|armor/i.test(String(kind || '')) ? { family: 'smith', geom: 'smithhammer' } : { family: 'craft', geom: null };
/* spells share three body gestures; the spell's own effect art is separate (src/magic.js). Staff → staff gesture,
   circles 1–4 one hand, circles 5–8 and field/area spells two hands. */
LOOK.castGesture = (sp, weaponGeom) => {
  if (weaponGeom === 'staff' || weaponGeom === 'quarterstaff') return 'caststaff';
  if (!sp) return 'cast1h';
  return (sp.circle || 1) >= 5 || sp.field || sp.area || sp.aoe ? 'cast2h' : 'cast1h';
};

/* ---------- visual animation state (priority): pure, from simulation facts only ----------
   s: { dead, deadAt, interruptAt, hitAt, attack:{family,t0,tc,rec}, cast:{gesture,t0,t1,phase}, tool:{family}, ready, moving, running, now }
   returns { action, t } with t ∈ [0,1] the phase through the action (looped actions use the caller's phase). */
LOOK.CONTACT = .55;   // the share of an attack's frames up to the moment of contact
LOOK.state = s => {
  const now = s.now;
  if (s.dead) { const t = s.deadAt == null ? 1 : Math.min(1, (now - s.deadAt) / .7); return { action: t >= 1 ? 'corpse' : 'death', t }; }
  if (s.interruptAt != null && now - s.interruptAt < .35) return { action: 'hit', t: (now - s.interruptAt) / .35 };
  const busy = s.attack || s.cast || s.tool;
  if (!busy && s.hitAt != null && now - s.hitAt < .3) return { action: 'hit', t: (now - s.hitAt) / .3 };
  if (s.attack) { const a = s.attack, C = LOOK.CONTACT;
    const t = now < a.tc ? C * Math.max(0, now - a.t0) / Math.max(.01, a.tc - a.t0) : C + (1 - C) * Math.min(1, (now - a.tc) / Math.max(.05, a.rec || .35));
    return { action: a.family, t: Math.max(0, Math.min(1, t)) }; }
  if (s.cast) { const c = s.cast; let t;
    if (c.phase === 'prep') t = .5 * Math.max(0, Math.min(1, (now - c.t0) / Math.max(.05, c.t1 - c.t0)));
    else if (c.phase === 'hold') t = .5;
    else t = .5 + .5 * Math.max(0, Math.min(1, (now - c.t0) / .4));
    return { action: c.gesture, t }; }
  if (s.tool) return { action: s.tool.family, t: null };
  if (s.blocking) return { action: 'block', t: null };
  if (s.moving) return { action: s.running ? 'run' : 'walk', t: null };
  if (s.ready) return { action: 'ready', t: null };
  return { action: 'idle', t: null };
};

/* ---------- profession presets: starting defaults for NPCs (identity, AI and gender stay the NPC's own) ----------
   outfit: torso layer (tunic, apron, robe, leather, studded, ringmail, chain, plate); legs: leg armor; helm; tabard: guard colours;
   weapon: carried geometry (always shown) — work tools appear only while working. clothPool: the palette the seed picks from. */
LOOK.PRESETS = {
  guard:      { outfit: 'chain', legs: 'chain', arms: 'chain', helm: 'openhelm', tabard: true, weapon: 'glaive', boots: true },
  captainGuard: { outfit: 'plate', legs: 'plate', arms: 'plate', helm: 'closedhelm', tabard: true, weapon: 'sword', shield: 'heater' },
  ranger:     { outfit: 'leather', legs: 'leather', arms: 'leather', helm: 'leathercap', weapon: 'shortbow', clothPool: ['forest', 'brown', 'ochre'] },
  blacksmith: { outfit: 'apron', apron: '#5a3d28', bareArms: true, clothPool: ['brown', 'charcoal', 'rust'], tool: 'smithhammer' },
  miner:      { outfit: 'apron', apron: '#4e4238', helm: 'cap', clothPool: ['charcoal', 'brown', 'ochre'], tool: 'pickaxe' },
  lumberjack: { outfit: 'tunic', clothPool: ['forest', 'brown', 'rust', 'ochre'], tool: 'hatchet' },
  merchant:   { outfit: 'tunic', vest: true, clothPool: ['burgundy', 'navy', 'purple', 'teal', 'ochre'], hatChance: .3 },
  banker:     { outfit: 'robe', clothPool: ['navy', 'black', 'burgundy'] },
  mage:       { outfit: 'robe', hood: true, clothPool: ['purple', 'navy', 'black', 'teal'], weapon: 'staff' },
  healer:     { outfit: 'robe', clothPool: ['cream', 'linen'] },
  priest:     { outfit: 'robe', clothPool: ['cream', 'black', 'charcoal'] },
  scribe:     { outfit: 'robe', clothPool: ['teal', 'navy', 'brown'] },
  sailor:     { outfit: 'tunic', stripes: true, clothPool: ['linen', 'navy', 'teal', 'cream'], cap: 'cap', tool: 'fishingpole' },
  farmer:     { outfit: 'tunic', clothPool: ['ochre', 'linen', 'brown', 'forest'], hatChance: .5 },
  villager:   { outfit: 'tunic', clothPool: ['linen', 'cream', 'brown', 'rust', 'ochre', 'forest', 'teal'] },
  innkeeper:  { outfit: 'apron', apron: '#d6ccb4', clothPool: ['brown', 'rust', 'burgundy'] },
  trainer:    { outfit: 'studded', legs: 'leather', arms: 'studded', weapon: 'sword', shield: 'buckler', clothPool: ['burgundy', 'charcoal'] },
  bandit:     { outfit: 'leather', legs: 'leather', arms: 'leather', helm: 'hood', clothPool: ['charcoal', 'brown', 'black', 'rust'], weapons: ['dagger', 'sword', 'waraxe', 'mace', 'knife'] },
  smuggler:   { outfit: 'tunic', vest: true, legs: null, helm: 'hood', clothPool: ['burgundy', 'charcoal', 'black'], weapons: ['dagger', 'kryss', 'sword'] },
  captain:    { outfit: 'studded', legs: 'leather', arms: 'leather', coat: true, cloak: '#2d4a52', clothPool: ['teal', 'navy'], weapon: 'sword', drowned: true, scale: 1.1 },
  sellsword:  { outfit: 'leather', legs: 'leather', arms: 'studded', weapon: 'sword', shield: 'buckler', clothPool: ['forest', 'brown', 'teal'] },
  student:    { outfit: 'robe', clothPool: ['teal', 'navy', 'purple', 'cream'] } };
/* game roles and Living World professions → preset */
LOOK.ROLE_PRESET = {
  guard: 'guard', quaywarden: 'captainGuard', smith: 'blacksmith', qsmith: 'blacksmith', miner: 'miner', banker: 'banker', campbank: 'bandit', outlaw: 'bandit',
  trainer: 'trainer', workshop: 'ranger', fletcher: 'ranger', ranger: 'ranger', apothecary: 'scribe', reagents: 'scribe', provisioner: 'merchant', trader: 'merchant',
  tailor: 'merchant', tinker: 'merchant', assay: 'merchant', stable: 'farmer', fishmonger: 'sailor', healer: 'healer', innkeeper: 'innkeeper', mage: 'mage',
  scholar: 'scribe', boat: 'sailor', packet: 'sailor', ferry: 'sailor', traveller: 'villager', resident: 'villager' };
LOOK.PROF_PRESET = { fisher: 'sailor', dockhand: 'sailor', townsfolk: 'villager', miner: 'miner', woodcutter: 'lumberjack', trader: 'merchant', weaver: 'villager', student: 'student', guard: 'guard', astronomer: 'mage', smith: 'blacksmith', innkeeper: 'innkeeper', scholar: 'scribe' };
LOOK.MON_PRESET = { bandit: 'bandit', smuggler: 'smuggler', captain: 'captain' };
/* which creatures are human and drawn by the human renderer; every other creature keeps its own art */
LOOK.isHumanMon = type => !!LOOK.MON_PRESET[type];
/* town colours for guard tabards */
LOOK.TOWN_COLOURS = { quay: '#2f5d6a', vespar: '#3b5676', mynoc: '#823e38', skara: '#4d6845', moonglen: '#6d5279', college: '#6d5279', southwatch: '#8a6a2a' };
/* gender from the existing NPC definitions (names and titles); unnamed NPCs (guards, wardens) take it from their seed */
const FEMALE = /\b(sister|mother|lady|dame|forgemistress|fisherwoman|ferrywoman|woman)\b|^(odile|mara|dena|maud|fenna|mags|sela|rhea|wenna|ewe|moira|maeve|ysolde|iska|brega|adda|merrin|nell|lise|kessa|mabry|mira|sorrel|nettle|wren|tess)\b/i;
const MALE = /\b(brother|master|magister|ferryman|quaywarden)\b|^(harl|vey|pell|gus|brann|crow|hobb|ivo|quill|hollis|tam|cray|ash|lune|rowan|orrin|tollin|bram|hale|venn|dorn|pip|tobin|fen|garrick|tomas|corin|durn|fennick|bryn|tibbet)\b/i;
LOOK.genderOf = (name, r) => { const n = String(name || '').replace(/^(old|captain|archivist|astronomer|ranger-captain)\s+/i, ''); if (FEMALE.test(n) || FEMALE.test(name || '')) return 'female'; if (MALE.test(n) || MALE.test(name || '')) return 'male'; return r && r() < .3 ? 'female' : 'male'; };
LOOK.presetFor = d => (d.kind === 'mon' && LOOK.MON_PRESET[d.type]) || (d.prof && LOOK.PROF_PRESET[d.prof]) || (d.role && LOOK.ROLE_PRESET[d.role]) || 'villager';
/* a persistent NPC look from a stable seed string (name + role + ordinal, fixed at world population) */
LOOK.npcLook = d => {
  const preset = LOOK.presetFor(d), P0 = LOOK.PRESETS[preset], r = LOOK.rng('npc:' + d.seed), body = d.body || LOOK.genderOf(d.name, r);
  const base = LOOK.random('npcface:' + d.seed, { body });
  if (/^old\b/i.test(d.name || '')) base.hairColor = pick(r, ['grey', 'white']);
  if (P0.drowned) base.skin = 'fair';
  const cloth = P0.clothPool ? pick(r, P0.clothPool) : pick(r, keys(LOOK.CLOTH));
  const weapon = P0.weapons ? pick(r, P0.weapons) : P0.weapon || null;
  return Object.assign(base, { cloth, preset, weapon, town: d.town || null, hat: P0.hatChance && r() < P0.hatChance ? 'cap' : null, tone: r() });
};

/* ---------- the render figure: everything the rig draws, as one stable record ----------
   ch: a character with .equip (player, hireling) or null for NPCs (preset gear). Cloth garments take the character's
   clothing colour; armor and shields take their material colour from EQ.appearance (the crafting materials). */
const ARMOR_FAMS = ['leather', 'studded', 'bone', 'ringmail', 'chain', 'plate', 'dragon'];
const HELM_OF = { cloth_cap: 'cap', leather_cap: 'leathercap', bone_helm: 'bonehelm', chain_coif: 'coif', bascinet: 'openhelm', open_helm: 'openhelm', norse_helm: 'openhelm', closed_helm: 'closedhelm', great_helm: 'greathelm', plate_helm: 'closedhelm', dragon_helm: 'closedhelm' };
const SHIELD_OF = { buckler: 'buckler', wooden_shield: 'round', metal_shield: 'round', kite_shield: 'kite', heater_shield: 'heater' };
const shadeHex = (c, k) => '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(c.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('');
LOOK.figure = (look, ch, o) => {
  o = o || {}; const l = LOOK.normalize(look, o.seed), cloth = LOOK.CLOTH[l.cloth];
  const f = { body: l.body, skin: LOOK.SKIN[l.skin], hair: LOOK.HAIR[l.hairColor], style: l.hair, beard: l.body === 'female' ? 'none' : l.beard,
    cloth, pants: shadeHex(cloth, .62), torso: 'tunic', torsoCol: cloth, arms: null, armsCol: null, legs: null, legsCol: null, hands: null, handsCol: null,
    boots: '#49382a', helm: null, helmCol: null, cloak: null, tabard: null, apron: null, vest: false, stripes: false, robe: null, hood: false,
    shield: null, shieldCol: null, weapon: o.weapon || null, ghost: !!o.ghost, scale: 1 };
  if (l.cloak && /^#/.test(l.cloak)) f.cloak = l.cloak;
  if (ch && ch.equip && SF && SF.EQ && SF.EQ.appearance) {
    for (const a of SF.EQ.appearance(ch)) {
      const it = ch.equip[a.slot]; const d = it && SF.ITEMS[it.id]; if (!d) continue; const fam = d.fam, tint = a.tint || '#9aa0a8', cl = fam === 'cloth';
      if (a.slot === 'shirt') { if (f.torso === 'tunic') f.torsoCol = cloth; }
      else if (a.slot === 'trousers') f.pants = shadeHex(cloth, .62);
      else if (a.slot === 'robe') { f.robe = cloth; }
      else if (a.slot === 'tunic') f.tabard = cloth;
      else if (a.slot === 'cloak') f.cloak = f.cloak || shadeHex(cloth, .85);
      else if (a.slot === 'chest' && ARMOR_FAMS.includes(fam)) { f.torso = fam; f.torsoCol = tint; }
      else if (a.slot === 'arms' && ARMOR_FAMS.includes(fam)) { f.arms = fam; f.armsCol = tint; }
      else if (a.slot === 'legs' && ARMOR_FAMS.includes(fam)) { f.legs = fam; f.legsCol = tint; }
      else if (a.slot === 'hands') { f.hands = cl ? 'cloth' : fam; f.handsCol = cl ? shadeHex(cloth, .8) : tint; }
      else if (a.slot === 'feet') f.boots = shadeHex(tint, .62);
      else if (a.slot === 'neck' && ARMOR_FAMS.includes(fam) && f.torso === 'tunic') { f.gorget = tint; }
      else if (a.slot === 'head') { f.helm = HELM_OF[it.id] || (cl ? 'cap' : 'openhelm'); f.helmCol = cl ? shadeHex(cloth, .85) : tint; }
      else if (a.slot === 'shield') { f.shield = SHIELD_OF[it.id] || 'round'; f.shieldCol = tint; }
    }
    const w = ch.equip.weapon; if (!o.weapon && w && LOOK.WEAPON_ANIM[w.id]) f.weapon = LOOK.WEAPON_ANIM[w.id].geom;
  } else if (l.preset) {
    const p = LOOK.PRESETS[l.preset] || {}, steel = '#9aa3a6', town = LOOK.TOWN_COLOURS[l.town] || null;
    if (p.outfit && p.outfit !== 'tunic' && p.outfit !== 'apron' && p.outfit !== 'robe') { f.torso = p.outfit; f.torsoCol = ['chain', 'ringmail', 'plate'].includes(p.outfit) ? steel : p.outfit === 'studded' ? '#6e4a2c' : '#7a5236'; }
    if (p.outfit === 'robe') f.robe = cloth; if (p.outfit === 'apron') f.apron = p.apron || '#5a3d28';
    if (p.arms) { f.arms = p.arms; f.armsCol = ['chain', 'ringmail', 'plate'].includes(p.arms) ? steel : '#6e4a2c'; }
    if (p.legs) { f.legs = p.legs; f.legsCol = ['chain', 'ringmail', 'plate'].includes(p.legs) ? steel : '#5e4030'; }
    if (p.helm === 'hood') f.hood = true; else if (p.helm) { f.helm = p.helm; f.helmCol = p.helm === 'cap' || p.helm === 'leathercap' ? shadeHex(cloth, .8) : steel; }
    if (!f.helm && (l.hat || p.cap)) { f.helm = 'cap'; f.helmCol = shadeHex(cloth, .75); }
    if (p.hood) f.hood = true; if (p.vest) f.vest = true; if (p.stripes) f.stripes = true; if (p.bareArms) f.bareArms = true;
    if (p.tabard) f.tabard = town || '#3b5676'; if (p.cloak) f.cloak = p.cloak; if (p.coat) f.coat = true;
    if (p.shield) { f.shield = p.shield; f.shieldCol = p.shield === 'buckler' ? '#8a8f90' : town || '#6e7a7c'; }
    if (p.drowned) f.skin = '#8e9a8a'; if (p.scale) f.scale = p.scale;
    if (!o.weapon && l.weapon) f.weapon = LOOK.WEAPON_ANIM[l.weapon] ? LOOK.WEAPON_ANIM[l.weapon].geom : l.weapon;
  }
  if (f.robe) { f.torso = f.torso === 'tunic' ? 'robe' : f.torso; }
  if (o.noShield || (f.weapon && LOOK.twoHandedGeom(f.weapon))) f.shield = null;   // a two-handed weapon hides an incompatible shield
  return f;
};
const TWO_GEOMS = ['halberd', 'battleaxe', 'hatchet', 'warhammer', 'spear', 'bow', 'crossbow', 'heavycrossbow', 'greatsword', 'doubleaxe', 'maul', 'bardiche', 'staff', 'quarterstaff', 'longbow', 'pickaxe_mine'];
LOOK.twoHandedGeom = g => TWO_GEOMS.includes(g);
/* stable cache key for a figure (order-independent, short) */
LOOK.figKey = f => { const ks = Object.keys(f).sort(); let s = ''; for (const k of ks) { const v = f[k]; if (k === 'key' || v === null || v === false || v === undefined) continue; s += k + '=' + v + ';'; } return s; };

SF.LOOK = LOOK;
if (typeof module !== 'undefined' && module.exports) module.exports = LOOK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
</script>
