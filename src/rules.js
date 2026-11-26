<script>
/* Shardfall rules module — pure, renderer-free, network-free. Values from the master spec v1.0.
   Runs in the browser (globalThis.SF) and in node for tests (module.exports). */
(function (root) {
'use strict';
const SF = {};
const clamp = (lo, hi, v) => v < lo ? lo : v > hi ? hi : v;      // spec order: clamp(low, high, x)
const roundHalfUp = v => Math.floor(v + 0.5);
SF.clamp = clamp; SF.roundHalfUp = roundHalfUp;

/* ---------------- attributes ---------------- */
SF.STAT_MIN = 10; SF.STAT_MAX = 100; SF.STAT_CAP = 225; SF.CREATE_STATS = 150; SF.CREATE_STAT_MIN = 25;
SF.SKILL_MAX = 1000; SF.SKILL_CAP = 7000; SF.CREATE_SKILLS = 100; SF.CREATE_SKILL_MAX = 50;   // tenths
SF.maxHp = c => Math.floor(50 + 0.5 * c.str);
SF.maxStam = c => c.dex;
SF.maxMana = c => c.int;
SF.carryKg = c => 22 + 0.33 * c.str;
SF.SLOTS = 45;
SF.WALK = 4.1; SF.SPRINT = 5.3; SF.SPRINT_DRAIN = 7; SF.STAM_REGEN = 5; SF.STAM_REGEN_COMBAT = 3; SF.STAM_DELAY = 0.75;

/* ---------------- skills (42) ---------------- */
// [key, name, group, implemented in this build]
SF.SKILLS = [
 ['blades','Blades','combat',1],['polearms','Polearms','combat',1],['hammers','Hammers','combat',1],['knives','Knives','combat',1],
 ['archery','Archery','combat',1],['brawling','Brawling','combat',1],['tactics','Tactics','combat',1],['anatomy','Anatomy','combat',1],
 ['shieldwork','Shieldwork','combat',1],['medicine','Field Medicine','support',1],['spellcraft','Spellcraft','magic',1],['focus','Spell Focus','magic',1],
 ['wardcraft','Wardcraft','magic',1],['meditation','Meditation','magic',1],['alchemy','Alchemy','craft',1],['venomcraft','Venomcraft','stealth',1],
 ['concealment','Concealment','stealth',1],['shadowstep','Shadowstep','stealth',1],['search','Search','stealth',1],['tracking','Tracking','wild',1],
 ['pickpocketing','Pickpocketing','stealth',1],['lockwork','Lockwork','stealth',1],['trapcraft','Trapcraft','stealth',1],['taming','Taming','wild',1],
 ['beasthandling','Beast Handling','wild',1],['veterinary','Veterinary','wild',1],['musicianship','Musicianship','bard',1],['lullaby','Lullaby','bard',1],
 ['discord','Discord','bard',1],['provocation','Provocation','bard',1],['woodcutting','Woodcutting','gather',1],['mining','Mining','gather',1],
 ['foraging','Foraging','gather',1],['skinning','Skinning','gather',1],['fishing','Fishing','gather',1],['smithing','Smithing','craft',1],
 ['carpentry','Carpentry','craft',1],['tailoring','Tailoring','craft',1],['fletching','Fletching','craft',1],['engineering','Engineering','craft',1],
 ['cooking','Cooking','craft',1],['appraisal','Appraisal','craft',1]];
SF.SKILL = {}; for (const [k, n, g, live] of SF.SKILLS) SF.SKILL[k] = { k, n, g, live: !!live };

SF.newSkills = () => { const s = {}; for (const [k] of SF.SKILLS) s[k] = { v: 0, lock: 'raise' }; return s; };
SF.totalSkill = ch => Object.values(ch.skills).reduce((a, s) => a + s.v, 0);
SF.sv = (ch, k) => (ch.skills && ch.skills[k] ? ch.skills[k].v / 10 : (ch.sk && ch.sk[k]) || 0);

SF.validateCreation = o => {
  const e = [];
  const st = [o.str, o.dex, o.int];
  if (st.some(v => !Number.isInteger(v))) e.push('Stats must be whole numbers.');
  if (st.reduce((a, b) => a + b, 0) !== SF.CREATE_STATS) e.push('Spend exactly 150 stat points.');
  if (st.some(v => v < SF.CREATE_STAT_MIN || v > SF.STAT_MAX)) e.push('Each stat must be between 25 and 100.');
  const sk = Object.entries(o.skills || {}).filter(([, v]) => v > 0);
  const tot = sk.reduce((a, [, v]) => a + v, 0);
  if (tot > 100) e.push('Starting skills may total at most 100.');
  if (sk.some(([k, v]) => !SF.SKILL[k] || v > 50)) e.push('Each starting skill is at most 50.');
  return e;
};

// spec §5: initial chance = clamp(.04,.30,.24-.0018*skill) * max(0, 1-|skill-difficulty|/40)
SF.gainChance = (skill, diff) => clamp(0.04, 0.30, 0.24 - 0.0018 * skill) * Math.max(0, 1 - Math.abs(skill - diff) / 40);
SF.REPEAT_WINDOW = 600; SF.REPEAT_MAX = 3; SF.RECIPE_TAPER_FROM = 10;
SF.recipeTaper = n => n < SF.RECIPE_TAPER_FROM ? 1 : Math.max(0.15, 1 - (n - SF.RECIPE_TAPER_FROM + 1) * 0.06);

/* tryGain: one committed, eligible action. ctx = {now (s), rng, target: string key, recipe: id}
   Returns {gained, reason, chance}. Never throws; the reason is shown in the skill log. */
SF.tryGain = (ch, key, diff, ctx) => {
  const s = ch.skills[key]; const now = ctx.now, rng = ctx.rng || Math.random;
  if (!s) return { gained: false, reason: 'unknown skill' };
  if (s.lock !== 'raise') return { gained: false, reason: s.lock === 'hold' ? 'skill is on Hold' : 'skill is set to Lower' };
  if (s.v >= SF.SKILL_MAX) return { gained: false, reason: 'skill is at 100' };
  ch.gainLog = ch.gainLog || {};
  let mult = 1;
  if (ctx.target) {
    const k = key + '|' + ctx.target; const L = (ch.gainLog[k] || []).filter(t => now - t < SF.REPEAT_WINDOW);
    if (L.length >= SF.REPEAT_MAX) { ch.gainLog[k] = L; return { gained: false, reason: 'same target or node used 3 times in 10 minutes' }; }
    L.push(now); ch.gainLog[k] = L;
  }
  if (ctx.recipe) { ch.recipeN = ch.recipeN || {}; const n = ch.recipeN[ctx.recipe] = (ch.recipeN[ctx.recipe] || 0) + 1; mult = SF.recipeTaper(n - 1); }
  const chance = SF.gainChance(s.v / 10, diff) * mult;
  if (chance <= 0) return { gained: false, reason: diff < s.v / 10 ? 'too easy to learn from' : 'too difficult to learn from', chance };
  if (rng() >= chance) return { gained: false, reason: 'no gain this time', chance };
  if (SF.totalSkill(ch) + 1 > SF.SKILL_CAP) {
    const order = (ch.lowerRank || []).concat(Object.keys(ch.skills));
    const dn = order.find(k => k !== key && ch.skills[k] && ch.skills[k].lock === 'lower' && ch.skills[k].v > 0);
    if (!dn) return { gained: false, reason: 'skill cap 700 reached: set a skill to Lower', chance };
    ch.skills[dn].v -= 1; s.v += 1;   // atomic transfer
    return { gained: true, chance, value: s.v, lowered: dn };
  }
  s.v += 1; return { gained: true, chance, value: s.v };
};
SF.opposed = (skill, diff) => clamp(0.10, 0.95, 0.55 + (skill - diff) / 125);

/* ---------------- combat (§6) ---------------- */
SF.WEAPONS = {
  dagger:   { fam: 'Dagger',   skill: 'knives',   dmg: [8, 13],  reach: 1.25, wind: .17, rec: .85 },
  sword:    { fam: 'Sword',    skill: 'blades',   dmg: [13, 20], reach: 1.60, wind: .23, rec: 1.20 },
  hammer:   { fam: 'Hammer',   skill: 'hammers',  dmg: [15, 23], reach: 1.50, wind: .28, rec: 1.34 },
  glaive:   { fam: 'Glaive',   skill: 'polearms', dmg: [19, 29], reach: 2.15, wind: .31, rec: 1.75, two: true },
  shortbow: { fam: 'Shortbow', skill: 'archery',  dmg: [13, 20], reach: 10,   wind: .38, rec: 1.45, two: true, ammo: 'arrow', proj: 22 },
  crossbow: { fam: 'Crossbow', skill: 'archery',  dmg: [20, 28], reach: 12,   wind: .48, rec: 2.05, two: true, ammo: 'bolt', proj: 22, rootWind: true },
  unarmed:  { fam: 'Unarmed',  skill: 'brawling', dmg: [4, 8],   reach: 1.15, wind: .18, rec: .95 }
};
SF.ARMOR = { none: 0, cloth: 6, leather: 20, chain: 35, plate: 50 };
SF.ARMOR_SPEED = { plate: .06, chain: .03 };
SF.ARMOR_MANA = { plate: .30, chain: .15 };
SF.accuracy = (atk, def) => clamp(0.15, 0.85, 0.50 + (atk - def) / 200);
SF.blockChance = (shieldwork, braced) => braced ? Math.min(.44, clamp(0, .32, shieldwork / 320) + .12) : clamp(0, .32, shieldwork / 320);
SF.BLOCK_REDUCE = .65; SF.BLOCK_STAM = 4; SF.BLOCK_ARC = 100;
SF.physDamage = (base, o) => {
  const raw = base * (.65 + .005 * (o.tactics || 0)) * (1 + .0015 * (o.anatomy || 0)) * (1 + .0012 * (o.str || 0)) * (1 - (o.armor || 0) / ((o.armor || 0) + 90));
  return Math.max(1, roundHalfUp(raw));
};
SF.recovery = (base, dex, stamFrac) => base * clamp(.65, 1.15, 1.13 - .003 * dex - .10 * stamFrac);
SF.SWAP_TIME = .25;
SF.bandageTime = dex => clamp(2.6, 5.1, 5.1 - .025 * dex);
SF.bandageHeal = (med, ana) => Math.floor(9 + .26 * med + .075 * ana);
SF.BANDAGE_PRESSURE = .25; SF.BANDAGE_PRESSURE_MAX = .75; SF.BANDAGE_RANGE = 1.5; SF.BANDAGE_REPEAT = 5;
SF.bandageCure = (med, ana) => med >= 55 && ana >= 40;
SF.POISON = { 1: 2, 2: 3, 3: 4 }; SF.POISON_TICKS = 4; SF.POISON_GAP = 2;
SF.CONSUMABLES = {
  draught:  { n: 'Healing draught', heal: 24, cd: 16, fam: 'heal' },
  stamtonic:{ n: 'Stamina tonic', stam: 25, cd: 14, fam: 'stam' },
  antidote: { n: 'Antidote', cure: true, cd: 10, fam: 'cure' },
  manatonic:{ n: 'Mana tonic', mana: 20, cd: 20, fam: 'mana' },
  cinder:   { n: 'Cinder flask', blast: 15, radius: 2.4, fuse: 1.3, cd: 14, fam: 'flask' }
};
SF.CONSUME_GAP = 1.2;

/* ---------------- magic (§7) ---------------- */
SF.REAGENT = { R: 'reedash', S: 'shelldust', M: 'marshroot', L: 'lanternoil', B: 'blacksalt' };
SF.SPELLS = [
  { id: 'mend', n: 'Mend', min: 0, mp: 5, prep: .35, r: 'M', t: 'ally', heal: [12, .07], walk: .7 },
  { id: 'needle', n: 'Needle Spark', min: 0, mp: 5, prep: .30, r: 'R', t: 'enemy', flat: 3, walk: .7 },
  { id: 'brightmark', n: 'Brightmark', min: 10, mp: 6, prep: .45, r: 'L', t: 'ground', range: 7, radius: 4, reveal: 3 },
  { id: 'cleanse', n: 'Cleanse', min: 20, mp: 8, prep: .60, r: 'MS', t: 'ally', cure: true },
  { id: 'ember', n: 'Ember Dart', min: 20, mp: 8, prep: .50, r: 'RL', t: 'enemy', dmg: 11, travel: .35, el: 'fire' },
  { id: 'hex', n: 'Dampening Hex', min: 25, mp: 8, prep: .55, r: 'BS', t: 'enemy', hex: 5 },
  { id: 'stoneveil', n: 'Stoneveil', min: 30, mp: 10, prep: .65, r: 'SM', t: 'ally', absorb: 16, dur: 6 },
  { id: 'step', n: 'Step Between', min: 35, mp: 12, prep: .65, r: 'RB', t: 'ground', range: 3, blink: true },
  { id: 'gmend', n: 'Greater Mend', min: 40, mp: 15, prep: 1.10, r: 'MLS', t: 'ally', heal: [25, .12] },
  { id: 'venom', n: 'Mire Venom', min: 45, mp: 12, prep: .75, r: 'MB', t: 'enemy', poison: 2, delay: .2 },
  { id: 'siltbind', n: 'Siltbind', min: 50, mp: 15, prep: .85, r: 'RM', t: 'ground', range: 7, radius: 1.8, root: 1.8 },
  { id: 'cinderseal', n: 'Cinder Seal', min: 55, mp: 17, prep: .90, r: 'RLB', t: 'enemy', dmg: 26, delay: 1.25, el: 'fire', mark: true },
  { id: 'tidelance', n: 'Tidelance', min: 60, mp: 19, prep: .95, r: 'RSL', t: 'enemy', dmg: 28, travel: .25, los: true },
  { id: 'unweave', n: 'Unweave', min: 65, mp: 17, prep: .80, r: 'SB', t: 'enemy', unweave: true },
  { id: 'lantern', n: 'Lantern Return', min: 65, mp: 20, prep: 3.0, r: 'MLB', t: 'self', recall: true },
  { id: 'curtain', n: 'Sable Curtain', min: 70, mp: 20, prep: 1.0, r: 'SMB', t: 'ground', range: 9, radius: 3, cloud: 4 },
  { id: 'saltstorm', n: 'Saltstorm', min: 75, mp: 25, prep: 1.25, r: 'RSLB', t: 'ground', range: 7, radius: 2.2, dmg: 22, warn: .65 },
  { id: 'bellfire', n: 'Bellfire', min: 80, mp: 27, prep: 1.45, r: 'RLMB', t: 'enemy', dmg: 36, delay: .45, el: 'fire' },
  { id: 'reedling', n: 'Call the Reedling', min: 85, mp: 32, prep: 1.60, r: 'RSMB', t: 'self', summon: 20 },
  { id: 'wakecall', n: 'Wakecall', min: 90, mp: 35, prep: 5.0, r: 'RSMLB', t: 'ally', revive: true }];
SF.SPELL = {}; for (const s of SF.SPELLS) SF.SPELL[s.id] = s;
SF.SPELL_RANGE = 9; SF.HOLD_TIME = 3; SF.SPELL_RECOVERY = .35; SF.PREP_DRIFT = .3;
SF.spellSuccess = (spellcraft, min) => clamp(.80, .99, .80 + .004 * (spellcraft - min));
SF.spellDamage = (base, focus, ward) => roundHalfUp(base * (.75 + .005 * focus) * (1 - .003 * ward));
SF.interruptCost = mp => Math.ceil(mp / 2);
SF.manaRegen = (med, armor) => (1 + .022 * med) * (1 - (SF.ARMOR_MANA[armor] || 0));
SF.MEDITATE_BONUS = 4; SF.MEDITATE_DELAY = 3; SF.MEDITATE_SETTLE = .6;

/* ---------------- items ---------------- */
// kg, stack, cat, trade (false = protected), extra fields
SF.ITEMS = {
  gold:       { n: 'Gold', kg: .001, stack: 1, cat: 'coin' },
  journal:    { n: 'Skill journal', kg: 0, cat: 'protected', trade: false },
  garment:    { n: 'Plain respawn tunic', kg: .3, cat: 'protected', trade: false, slot: 'armor', armor: 'none' },
  pine:       { n: 'Pine log', kg: 1.5, stack: 1, cat: 'timber' },
  ore:        { n: 'Iron ore', kg: 1.2, stack: 1, cat: 'ore' },
  ironbar:    { n: 'Iron bar', kg: .8, stack: 1, cat: 'metal' },
  ironshard:  { n: 'Iron shard', kg: .05, stack: 1, cat: 'metal' },
  hide:       { n: 'Hide', kg: .6, stack: 1, cat: 'hide' },
  sinew:      { n: 'Sinew', kg: .05, stack: 1, cat: 'hide' },
  strap:      { n: 'Leather strap', kg: .1, stack: 1, cat: 'hide' },
  cloth:      { n: 'Cloth', kg: .2, stack: 1, cat: 'cloth' },
  meat:       { n: 'Raw meat', kg: .4, stack: 1, cat: 'food' },
  cookedmeat: { n: 'Roast meat', kg: .3, stack: 1, cat: 'food', use: 'eat' },
  fish:       { n: 'Brine perch', kg: .5, stack: 1, cat: 'food' },
  cookedfish: { n: 'Grilled perch', kg: .3, stack: 1, cat: 'food', use: 'eat' },
  vial:       { n: 'Empty vial', kg: .1, stack: 1, cat: 'alch' },
  reedash:    { n: 'Reed ash', kg: .02, stack: 1, cat: 'reagent' },
  shelldust:  { n: 'Shell dust', kg: .02, stack: 1, cat: 'reagent' },
  marshroot:  { n: 'Marshroot', kg: .02, stack: 1, cat: 'reagent' },
  lanternoil: { n: 'Lantern oil', kg: .02, stack: 1, cat: 'reagent' },
  blacksalt:  { n: 'Black salt', kg: .02, stack: 1, cat: 'reagent' },
  bandage:    { n: 'Bandage', kg: .02, stack: 1, cat: 'medic', use: 'bandage' },
  draught:    { n: 'Healing draught', kg: .3, stack: 1, cat: 'potion', use: 'consume' },
  stamtonic:  { n: 'Stamina tonic', kg: .3, stack: 1, cat: 'potion', use: 'consume' },
  antidote:   { n: 'Antidote', kg: .3, stack: 1, cat: 'potion', use: 'consume' },
  manatonic:  { n: 'Mana tonic', kg: .3, stack: 1, cat: 'potion', use: 'consume' },
  cinder:     { n: 'Cinder flask', kg: .4, stack: 1, cat: 'potion', use: 'consume' },
  arrow:      { n: 'Arrow', kg: .01, stack: 1, cat: 'ammo' },
  bolt:       { n: 'Bolt', kg: .02, stack: 1, cat: 'ammo' },
  hatchet:    { n: 'Hatchet', kg: 1.5, cat: 'tool', tool: 'woodcutting' },
  pickaxe:    { n: 'Pickaxe', kg: 2.5, cat: 'tool', tool: 'mining' },
  knife:      { n: 'Skinning knife', kg: .3, cat: 'tool', tool: 'skinning' },
  rod:        { n: 'Fishing rod', kg: 1, cat: 'tool', tool: 'fishing' },
  tongs:      { n: 'Smith tongs', kg: 1, cat: 'tool', tool: 'smithing' },
  sewkit:     { n: 'Sewing kit', kg: .3, cat: 'tool', tool: 'tailoring' },
  dagger:     { n: 'Iron dagger', kg: .8, cat: 'weapon', slot: 'weapon', wpn: 'dagger' },
  sword:      { n: 'Iron sword', kg: 2.5, cat: 'weapon', slot: 'weapon', wpn: 'sword' },
  hammer:     { n: 'War hammer', kg: 3.2, cat: 'weapon', slot: 'weapon', wpn: 'hammer' },
  glaive:     { n: 'Glaive', kg: 4, cat: 'weapon', slot: 'weapon', wpn: 'glaive' },
  shortbow:   { n: 'Shortbow', kg: 1, cat: 'weapon', slot: 'weapon', wpn: 'shortbow' },
  crossbow:   { n: 'Crossbow', kg: 3.5, cat: 'weapon', slot: 'weapon', wpn: 'crossbow' },
  buckler:    { n: 'Pine buckler', kg: 2, cat: 'shield', slot: 'shield' },
  clothvest:  { n: 'Cloth gambeson', kg: 1.5, cat: 'armor', slot: 'armor', armor: 'cloth' },
  leather:    { n: 'Leather armor', kg: 6, cat: 'armor', slot: 'armor', armor: 'leather' },
  chain:      { n: 'Chain armor', kg: 12, cat: 'armor', slot: 'armor', armor: 'chain' },
  plate:      { n: 'Plate armor', kg: 18, cat: 'armor', slot: 'armor', armor: 'plate' },
  lockpick:   { n: 'Lockpick', kg: .02, stack: 1, cat: 'tool' },
  trapkit:    { n: 'Snare kit', kg: .8, stack: 1, cat: 'tool' },
  repairkit:  { n: 'Repair kit', kg: 1, stack: 1, cat: 'tool' },
  lute:       { n: 'Reed lute', kg: 1.5, cat: 'tool', tool: 'musicianship' },
  venom:      { n: 'Mire venom vial', kg: .2, stack: 1, cat: 'potion' },
  bellshard:  { n: 'Bell-bronze shard', kg: .3, stack: 1, cat: 'metal' },
  silk:       { n: 'Mire silk', kg: .05, stack: 1, cat: 'cloth' }
};
for (const k in SF.ITEMS) { SF.ITEMS[k].id = k; if (SF.ITEMS[k].trade === undefined) SF.ITEMS[k].trade = true; }
SF.PRICES = { pine: 3, ore: 4, ironbar: 16, ironshard: 1, hide: 4, sinew: 2, strap: 3, cloth: 2, meat: 2, cookedmeat: 6, fish: 3, cookedfish: 7, vial: 3,
  reedash: 2, shelldust: 2, marshroot: 3, lanternoil: 3, blacksalt: 4, bandage: 2, draught: 25, stamtonic: 18, antidote: 15, manatonic: 22, cinder: 30, arrow: 1, bolt: 1,
  hatchet: 20, pickaxe: 24, knife: 8, rod: 12, tongs: 15, sewkit: 6, dagger: 30, sword: 70, hammer: 75, glaive: 110, shortbow: 60, crossbow: 95, buckler: 40,
  clothvest: 30, leather: 90, chain: 220, plate: 420, lockpick: 4, trapkit: 20, repairkit: 30, lute: 40, venom: 22, bellshard: 45, silk: 6 };

let UID = 1;
SF.setUidBase = n => { UID = Math.max(UID, n); };
SF.newItem = (id, qty, extra) => Object.assign({ uid: UID++, id, qty: qty || 1 }, extra || {});
SF.newContainer = (kind, owner) => ({ cid: 'c' + (UID++), kind, owner: owner || null, items: [], ver: 0 });
SF.itemKg = it => SF.ITEMS[it.id].kg * it.qty;
SF.containerKg = c => c.items.reduce((a, it) => a + SF.itemKg(it), 0);
SF.count = (c, id) => c.items.reduce((a, it) => a + (it.id === id ? it.qty : 0), 0);
SF.canStack = (a, b) => SF.ITEMS[a.id].stack && a.id === b.id && (a.q || 0) === (b.q || 0) && !a.maker && !b.maker;

/* addItem respects slot and weight caps when cap is given; returns {ok, reason} */
SF.addItem = (c, it, cap) => {
  const ex = c.items.find(o => SF.canStack(o, it));
  if (cap) {
    if (!ex && c.items.length >= cap.slots) return { ok: false, reason: 'no free pack slot (45 stacks)' };
    if (SF.containerKg(c) + SF.itemKg(it) > cap.kg + 1e-9) return { ok: false, reason: 'too heavy to carry' };
  }
  if (ex) ex.qty += it.qty; else c.items.push(it);
  c.ver++; return { ok: true };
};
SF.removeQty = (c, id, qty) => {
  if (SF.count(c, id) < qty) return false;
  for (let i = c.items.length - 1; i >= 0 && qty > 0; i--) { const it = c.items[i]; if (it.id !== id) continue; const t = Math.min(qty, it.qty); it.qty -= t; qty -= t; if (it.qty <= 0) c.items.splice(i, 1); }
  c.ver++; return true;
};
/* transfer: move qty of the item with uid from -> to. Version guard optional. Conserves units exactly. */
SF.transfer = (from, to, uid, qty, opt) => {
  opt = opt || {};
  if (opt.fromVer !== undefined && opt.fromVer !== from.ver) return { ok: false, reason: 'container changed, try again' };
  const idx = from.items.findIndex(it => it.uid === uid); if (idx < 0) return { ok: false, reason: 'item is gone' };
  const it = from.items[idx]; qty = Math.min(qty || it.qty, it.qty);
  const moving = qty === it.qty ? it : Object.assign({}, it, { uid: UID++, qty });
  const r = SF.addItem(to, moving === it ? it : moving, opt.cap);
  if (!r.ok) return r;
  if (moving === it) { from.items.splice(idx, 1); } else { it.qty -= qty; }
  from.ver++; return { ok: true, qty };
};

/* death transaction (§4): all tradeable carried items + equipment move into one corpse; protected stays. */
SF.CORPSE_LIFE = 12 * 60; SF.LOOT_RIGHTS = 90;
SF.deathTransaction = (ch, now, pos) => {
  const corpse = SF.newContainer('corpse', ch.id); corpse.pos = pos; corpse.diedAt = now; corpse.expires = now + SF.CORPSE_LIFE; corpse.name = ch.name;
  const keep = [];
  for (const it of ch.pack.items) (SF.ITEMS[it.id].trade ? corpse.items : keep).push(it);
  for (const s of Object.keys(ch.equip)) { const it = ch.equip[s]; if (!it) continue; if (SF.ITEMS[it.id].trade) { corpse.items.push(it); ch.equip[s] = null; } }
  ch.pack.items = keep; ch.pack.ver++;
  if (!keep.some(i => i.id === 'garment') && !(ch.equip.armor && ch.equip.armor.id === 'garment')) { if (!ch.equip.armor) ch.equip.armor = SF.newItem('garment', 1); else keep.push(SF.newItem('garment', 1)); }
  if (!keep.some(i => i.id === 'journal')) keep.push(SF.newItem('journal', 1));
  return corpse;
};
SF.lootStatus = (corpse, actorId, now) => {
  if (now - corpse.diedAt >= SF.LOOT_RIGHTS) return { lawful: true, label: 'open to all' };
  if (corpse.owner === actorId) return { lawful: true, label: 'your body' };
  return { lawful: false, label: 'criminal to loot for ' + Math.ceil(SF.LOOT_RIGHTS - (now - corpse.diedAt)) + ' s' };
};
SF.unitsOf = conts => { const m = {}; for (const c of conts) for (const it of (c.items || [])) m[it.id] = (m[it.id] || 0) + it.qty; return m; };

/* ---------------- recipes (§9) ---------------- */
// out, qty, skill, min (hard threshold), diff, station, tool, inputs
SF.RECIPES = [
  { id: 'ironbar', out: 'ironbar', qty: 1, skill: 'smithing', min: 0, diff: 15, station: 'forge', inputs: { ore: 3 } },
  { id: 'ironshard', out: 'ironshard', qty: 6, skill: 'smithing', min: 0, diff: 10, station: 'anvil', tool: 'tongs', inputs: { ironbar: 1 } },
  { id: 'dagger', out: 'dagger', qty: 1, skill: 'smithing', min: 10, diff: 25, station: 'anvil', tool: 'tongs', inputs: { ironbar: 1, strap: 1 } },
  { id: 'sword', out: 'sword', qty: 1, skill: 'smithing', min: 20, diff: 35, station: 'anvil', tool: 'tongs', inputs: { ironbar: 3, strap: 1 } },
  { id: 'strap', out: 'strap', qty: 2, skill: 'tailoring', min: 0, diff: 10, station: 'bench', tool: 'sewkit', inputs: { hide: 1 } },
  { id: 'bandage', out: 'bandage', qty: 5, skill: 'tailoring', min: 5, diff: 15, station: 'bench', tool: 'sewkit', inputs: { cloth: 2 } },
  { id: 'leather', out: 'leather', qty: 1, skill: 'tailoring', min: 30, diff: 45, station: 'bench', tool: 'sewkit', inputs: { hide: 6, sinew: 2 } },
  { id: 'shortbow', out: 'shortbow', qty: 1, skill: 'carpentry', min: 15, diff: 30, station: 'bench', tool: 'knife', inputs: { pine: 4, sinew: 1 } },
  { id: 'buckler', out: 'buckler', qty: 1, skill: 'carpentry', min: 20, diff: 35, station: 'bench', tool: 'knife', inputs: { pine: 3, strap: 1 } },
  { id: 'arrows', out: 'arrow', qty: 20, skill: 'fletching', min: 10, diff: 20, station: 'bench', tool: 'knife', inputs: { pine: 1, ironshard: 1 } },
  { id: 'draught', out: 'draught', qty: 1, skill: 'alchemy', min: 25, diff: 40, station: 'still', inputs: { shelldust: 1, marshroot: 1, vial: 1 } },
  { id: 'antidote', out: 'antidote', qty: 1, skill: 'alchemy', min: 15, diff: 30, station: 'still', inputs: { marshroot: 2, vial: 1 } },
  { id: 'cinder', out: 'cinder', qty: 1, skill: 'alchemy', min: 40, diff: 55, station: 'still', inputs: { reedash: 2, lanternoil: 1, vial: 1 } },
  { id: 'cookedmeat', out: 'cookedmeat', qty: 1, skill: 'cooking', min: 0, diff: 15, station: 'fire', inputs: { meat: 1 } },
  { id: 'cookedfish', out: 'cookedfish', qty: 1, skill: 'cooking', min: 0, diff: 20, station: 'fire', inputs: { fish: 1 } },
  { id: 'lockpick', out: 'lockpick', qty: 5, skill: 'engineering', min: 0, diff: 15, station: 'anvil', tool: 'tongs', inputs: { ironshard: 2 } },
  { id: 'trapkit', out: 'trapkit', qty: 1, skill: 'trapcraft', min: 0, diff: 25, station: 'bench', tool: 'knife', inputs: { ironshard: 3, sinew: 1 } },
  { id: 'repairkit', out: 'repairkit', qty: 1, skill: 'engineering', min: 20, diff: 35, station: 'bench', tool: 'knife', inputs: { ironbar: 1, strap: 1, pine: 1 } },
  { id: 'venom', out: 'venom', qty: 1, skill: 'venomcraft', min: 0, diff: 25, station: 'still', inputs: { marshroot: 1, blacksalt: 1, vial: 1 } },
  { id: 'silkband', out: 'bandage', qty: 8, skill: 'tailoring', min: 25, diff: 40, station: 'bench', tool: 'sewkit', inputs: { silk: 3 } }];
SF.RECIPE = {}; for (const r of SF.RECIPES) SF.RECIPE[r.id] = r;
SF.CRAFT_TIME = 1.5; SF.CRAFT_FAIL_LOSS = .25;
SF.craftChance = (skill, r) => clamp(.10, .98, .55 + (skill - r.diff) / 80);
/* craft: validates and commits inputs + output together. Returns {ok, success, reason}. */
SF.craft = (ch, r, rng, cap) => {
  const sk = SF.sv(ch, r.skill);
  if (sk < r.min) return { ok: false, reason: `needs ${SF.SKILL[r.skill].n} ${r.min}` };
  for (const k in r.inputs) if (SF.count(ch.pack, k) < r.inputs[k]) return { ok: false, reason: 'missing ' + SF.ITEMS[k].n.toLowerCase() };
  const success = (rng || Math.random)() < SF.craftChance(sk, r);
  if (!success) { for (const k in r.inputs) SF.removeQty(ch.pack, k, Math.ceil(r.inputs[k] * SF.CRAFT_FAIL_LOSS)); return { ok: true, success: false }; }
  const snapshot = ch.pack.items.map(it => Object.assign({}, it));
  for (const k in r.inputs) SF.removeQty(ch.pack, k, r.inputs[k]);
  const add = SF.addItem(ch.pack, SF.newItem(r.out, r.qty, SF.ITEMS[r.out].stack ? null : { maker: ch.name, cond: 100 }), cap);
  if (!add.ok) { ch.pack.items = snapshot; ch.pack.ver++; return { ok: false, reason: add.reason }; }   // roll back atomically
  return { ok: true, success: true };
};


/* ---------------- materials (crafting guide §2) ---------------- */
// [id, display, mine & smelt gate, smith gate, colour cue, durability multiplier, carried mass multiplier]
SF.METALS = [
  ['iron', 'Iron', 0, 0, '#8e8f8a', 1.00, 1.00], ['dull_copper', 'Dull Copper', 65, 40, '#8a6646', 1.15, 1.00], ['shadow_iron', 'Shadow Iron', 70, 45, '#45454c', 1.25, 1.08],
  ['copper', 'Copper', 75, 50, '#c0603e', 1.10, .90], ['bronze', 'Bronze', 80, 60, '#c8963e', 1.30, 1.05], ['golden', 'Golden', 85, 65, '#f2cc3a', 1.05, .80],
  ['agapite', 'Agapite', 90, 75, '#d09090', 1.35, 1.00], ['verite', 'Verite', 95, 85, '#4aac62', 1.20, .82], ['valorite', 'Valorite', 99, 95, '#5a80d8', 1.45, .95]];
SF.METAL = {}; for (const [id, n, mine, smith, col, dur, mass] of SF.METALS) SF.METAL[id] = { id, n, mine, smith, col, dur, mass, kind: 'metal' };
// [id, display, fell & mill gate, finished-work gate, colour cue, durability multiplier, finished mass multiplier]
SF.WOODS = [
  ['pine', 'Common Wood (Pine)', 0, 0, '#e2c486', 1.00, 1.00], ['oak', 'Oak', 65, 65, '#8c5c32', 1.25, 1.08], ['ash', 'Ash', 80, 75, '#bcb69c', 1.10, .88],
  ['yew', 'Yew', 95, 85, '#9c4c2c', 1.30, .98], ['heartwood', 'Heartwood', 100, 95, '#8c5cbc', 1.45, 1.08], ['bloodwood', 'Bloodwood', 100, 95, '#7c2024', 1.35, .95],
  ['frostwood', 'Frostwood', 100, 95, '#9cd2f2', 1.15, .78]];
SF.WOOD = {}; for (const [id, n, fell, work, col, dur, mass] of SF.WOODS) SF.WOOD[id] = { id, n, short: id === 'pine' ? 'Pine' : n, fell, work, col, dur, mass, kind: 'wood' };
SF.MAT = Object.assign({}, SF.METAL, SF.WOOD);
SF.oreId = m => m === 'iron' ? 'ore' : 'ore_' + m;
SF.ingotId = m => m === 'iron' ? 'ironbar' : 'ingot_' + m;
SF.logId = w => w === 'pine' ? 'pine' : 'log_' + w;
// ordinary forms keep their IDs; every coloured form gets its own ID so SF.count(pack, 'ironbar') can never consume Valorite
Object.assign(SF.ITEMS.ore, { mat: 'iron' }); Object.assign(SF.ITEMS.ironbar, { mat: 'iron' }); Object.assign(SF.ITEMS.ironshard, { mat: 'iron' }); Object.assign(SF.ITEMS.pine, { mat: 'pine' });
for (const M of SF.METALS.slice(1).map(a => SF.METAL[a[0]])) {
  SF.ITEMS[SF.oreId(M.id)] = { id: SF.oreId(M.id), n: M.n + ' ore', kg: 1.2, stack: 1, cat: 'ore', mat: M.id, trade: true };
  SF.ITEMS[SF.ingotId(M.id)] = { id: SF.ingotId(M.id), n: M.n + ' ingot', kg: .8, stack: 1, cat: 'metal', mat: M.id, trade: true };
  SF.PRICES[SF.oreId(M.id)] = SF.PRICES.ore; SF.PRICES[SF.ingotId(M.id)] = SF.PRICES.ironbar;    // NPCs ignore rare-material premiums
}
for (const Wd of SF.WOODS.slice(1).map(a => SF.WOOD[a[0]])) { SF.ITEMS[SF.logId(Wd.id)] = { id: SF.logId(Wd.id), n: Wd.n + ' log', kg: 1.5, stack: 1, cat: 'timber', mat: Wd.id, trade: true }; SF.PRICES[SF.logId(Wd.id)] = SF.PRICES.pine; }
// fittings: one item ID, the metal is carried on the stack (matItem)
Object.assign(SF.ITEMS, {
  rivet: { id: 'rivet', n: 'Rivet', base: 'rivet', kg: .1, stack: 1, cat: 'fitting', matItem: 'metal', trade: true },
  nail:  { id: 'nail', n: 'Nail', base: 'nail', kg: .06, stack: 1, cat: 'fitting', matItem: 'metal', trade: true },
  hinge: { id: 'hinge', n: 'Hinge', base: 'hinge', kg: .3, stack: 1, cat: 'fitting', matItem: 'metal', trade: true } });
Object.assign(SF.PRICES, { rivet: 1, nail: 1, hinge: 4 });
// metal-primary equipment: a neutral base name; legacy pieces with no recorded metal are iron
for (const [id, base] of [['dagger', 'dagger'], ['sword', 'Quay sword'], ['hammer', 'war hammer'], ['glaive', 'glaive'], ['chain', 'chain armor'], ['plate', 'plate armor']]) Object.assign(SF.ITEMS[id], { base, prim: 'metal' });
SF.matOf = it => { if (!it) return null; const d = SF.ITEMS[it.id]; return it.material || d.mat || (d.prim === 'metal' ? 'iron' : null); };
SF.matName = m => SF.METAL[m] ? SF.METAL[m].n : SF.WOOD[m] ? SF.WOOD[m].short : '';
SF.itemName = it => { const d = SF.ITEMS[it.id]; if (!d.base) return d.n; const m = SF.matOf(it); const s = (m ? SF.matName(m) + ' ' : '') + d.base; return s[0].toUpperCase() + s.slice(1); };
SF.countMat = (c, id, mat) => c.items.reduce((a, it) => a + (it.id === id && (!mat || SF.matOf(it) === mat) ? it.qty : 0), 0);
SF.removeMat = (c, id, mat, qty) => {
  if (SF.countMat(c, id, mat) < qty) return false;
  for (let i = c.items.length - 1; i >= 0 && qty > 0; i--) { const it = c.items[i]; if (it.id !== id || (mat && SF.matOf(it) !== mat)) continue; const t = Math.min(qty, it.qty); it.qty -= t; qty -= t; if (it.qty <= 0) c.items.splice(i, 1); }
  c.ver++; return true;
};
SF.canStack = (a, b) => SF.ITEMS[a.id].stack && a.id === b.id && (a.q || 0) === (b.q || 0) && !a.maker && !b.maker && (a.material || null) === (b.material || null);
SF.itemKg = it => SF.ITEMS[it.id].kg * (it.kgMul || 1) * it.qty;

/* ---------------- condition and repair (crafting guide §4.6, §5) ---------------- */
SF.condFactor = (c, mx) => c === undefined ? 1 : c <= 0 ? 0 : c < .2 * (mx || 100) ? .85 : 1;
SF.origMax = it => it.omax || 100;
SF.repairPlan = it => {
  const om = SF.origMax(it), mx = it.maxc === undefined ? 100 : it.maxc, cond = it.cond === undefined ? mx : it.cond;
  const nm = mx - Math.ceil(.03 * om), floor = Math.ceil(.4 * om);
  if (cond >= mx) return { ok: false, nm, reason: 'already at full condition' };
  if (nm < floor) return { ok: false, nm, reason: `too worn to repair: the next maximum (${nm}) would be under ${floor}. Replace it.` };
  return { ok: true, nm };
};
SF.repair = it => { const p = SF.repairPlan(it); if (!p.ok) return { ok: false, reason: p.reason }; it.maxc = p.nm; it.cond = p.nm; return { ok: true, maxc: p.nm }; };

/* ---------------- work tools: 100 uses, one per resolved attempt that needs the tool ---------------- */
SF.WORK_TOOLS = { hatchet: 1, pickaxe: 1, rod: 1, tongs: 1, sewkit: 1, knife: 1 };
SF.TOOL_USES = 100;
SF.toolUses = it => it.uses === undefined ? SF.TOOL_USES : it.uses;
SF.findTool = (c, id) => c.items.find(it => it.id === id && SF.toolUses(it) > 0) || null;
SF.spendTool = (c, it) => { if (!it) return false; it.uses = SF.toolUses(it) - 1; if (it.uses <= 0) { const i = c.items.indexOf(it); if (i >= 0) c.items.splice(i, 1); c.ver++; return true; } return false; };

/* ---------------- resource nodes (crafting guide §3) ---------------- */
// region tables G0..G3 follow the existing node grades (minimum 0/30/55/80, difficulty 15/45/70/85)
SF.REGIONS = [
  { stock: 8,  refill: 120, ore: { iron: 100 }, wood: { pine: 100 } },
  { stock: 10, refill: 300, ore: { iron: 52, dull_copper: 22, shadow_iron: 14, copper: 12 }, wood: { pine: 70, oak: 30 } },
  { stock: 12, refill: 480, ore: { iron: 24, dull_copper: 12, shadow_iron: 12, copper: 18, bronze: 16, golden: 10, agapite: 8 }, wood: { pine: 30, oak: 30, ash: 25, yew: 15 } },
  { stock: 16, refill: 720, ore: { iron: 10, copper: 10, bronze: 14, golden: 16, agapite: 22, verite: 20, valorite: 8 }, wood: { pine: 8, oak: 8, ash: 14, yew: 22, heartwood: 16, bloodwood: 16, frostwood: 16 } }];
SF.rollTable = (tab, rng) => { const ks = Object.keys(tab), tot = ks.reduce((a, k) => a + tab[k], 0); let r = rng() * tot; for (const k of ks) { r -= tab[k]; if (r < 0) return k; } return ks[ks.length - 1]; };
SF.matGate = (m, use) => use === 'mine' ? SF.METAL[m].mine : use === 'smith' ? SF.METAL[m].smith : use === 'fell' ? SF.WOOD[m].fell : SF.WOOD[m].work;
SF.commonOf = skill => skill === 'mining' ? 'iron' : 'pine';
SF.gateFor = (skill, m) => skill === 'mining' ? SF.METAL[m].mine : SF.WOOD[m].fell;
/* which material a successful stroke yields: the node's specialty only at or above its gate, and then 50% */
SF.strokeMaterial = (skill, spec, sk, rng) => { const com = SF.commonOf(skill); if (!spec || spec === com || sk < SF.gateFor(skill, spec)) return com; return rng() < .5 ? spec : com; };
SF.STROKE_YIELD = { mining: 3, woodcutting: 2 };
SF.stockLabel = (n, max) => n <= 0 ? 'Exhausted' : n >= max ? 'Fresh' : n > max / 3 ? 'Worked' : 'Nearly empty';

/* ---------------- craft resolution (crafting guide §4) ---------------- */
SF.workGate = (r, m) => { if (!m) return 0; if (r.prim === 'metal') return SF.METAL[m].smith; if (r.prim === 'wood') return SF.WOOD[m].work; return 0; };
SF.recipeLines = r => r.lines || Object.entries(r.inputs).map(([item, qty]) => ({ item, qty }));
SF.lineItem = (ln, m) => ln.form === 'ingot' ? { id: SF.ingotId(m), mat: null } : ln.form === 'ore' ? { id: SF.oreId(m), mat: null } : ln.match ? { id: ln.item, mat: m } : { id: ln.item, mat: null };
SF.recipeMat = (r, m) => r.prim ? (m || r.defMat) : (r.fixedMat || null);
SF.QUALITY_CATS = { weapon: 1, shield: 1, armor: 1 };
SF.craftTime = r => r.time || ({ weapon: 2, shield: 2, armor: 3 }[SF.ITEMS[r.out].cat] || SF.CRAFT_TIME);
/* plan: everything the preview shows, computed without touching the pack */
SF.craftPlan = (ch, pack, r, mat) => {
  const sk = SF.sv(ch, r.skill), m = SF.recipeMat(r, mat), gate = SF.workGate(r, m), effMin = Math.max(r.min, gate);
  const diff = r.diff !== undefined ? (!r.prim || m === r.defMat ? r.diff : Math.max(r.diff, Math.min(100, gate + 15))) : Math.min(100, effMin + 15);
  const chance = clamp(.10, .98, .55 + (sk - diff) / 80);
  const quality = !!SF.QUALITY_CATS[SF.ITEMS[r.out].cat];
  const exc = quality ? clamp(0, .45, (sk - effMin - 10) / 100 + (sk >= 100 ? .20 : 0)) : 0;
  const lines = SF.recipeLines(r).map(ln => { const li = SF.lineItem(ln, m); const have = li.mat ? SF.countMat(pack, li.id, li.mat) : SF.count(pack, li.id); return { id: li.id, mat: li.mat, qty: ln.qty, have, fail: Math.ceil(ln.qty * SF.CRAFT_FAIL_LOSS) }; });
  const missing = lines.filter(l => l.have < l.qty);
  let reason = '';
  if (sk < effMin) reason = gate > r.min ? `${SF.matName(m)} needs ${SF.SKILL[r.skill].n} ${gate}` : `needs ${SF.SKILL[r.skill].n} ${r.min}`;
  else if (missing.length) reason = 'missing ' + missing.map(l => (l.qty - l.have) + ' ' + SF.ITEMS[l.id].n.toLowerCase()).join(', ');
  return { r, mat: m, sk, gate, effMin, diff, chance, quality, exc, perExc: chance * exc, lines, missing, ok: !reason, reason };
};
SF.removeLine = (c, l, n) => l.mat ? SF.removeMat(c, l.id, l.mat, n) : SF.removeQty(c, l.id, n);
SF.ingotBasis = plan => plan.lines.filter(l => SF.ITEMS[l.id].cat === 'metal' && SF.ITEMS[l.id].mat && l.id !== 'ironshard').reduce((a, l) => a + l.qty, 0);
/* outputs of one success; sim=true builds throw-away copies for the capacity check */
SF.craftOutputs = (ch, plan, exceptional, opt, sim) => {
  opt = opt || {}; const r = plan.r, d = SF.ITEMS[r.out], m = plan.mat;
  const mk = (id, qty, extra) => sim ? Object.assign({ uid: 0, id, qty }, extra || {}) : SF.newItem(id, qty, extra);
  if (d.stack) return [mk(r.out, r.qty, d.matItem && m ? { material: m } : null)];
  if (!plan.quality) return [mk(r.out, r.qty, null)];
  const M = SF.MAT[m]; const om = roundHalfUp(100 * (M ? M.dur : 1) * (exceptional ? 1.10 : 1));
  const extra = { quality: exceptional ? 'exceptional' : 'normal', creatorId: ch.id || ch.pid || ch.name, creatorName: ch.name, origin: 'crafted', omax: om, maxc: om, cond: om };
  if (m) extra.material = m;
  if (M && M.mass !== 1) extra.kgMul = M.mass;
  if (exceptional && opt.mark && plan.sk >= 100) extra.maker = ch.name;
  if (M && M.kind === 'metal') { const b = SF.ingotBasis(plan); if (b) extra.salvage = { metal: m, num: b, den: 1 }; }
  return [mk(r.out, r.qty, extra)];
};
/* one attempt. Precondition failures cost nothing; a failed roll loses ceil(25%) of each line; success debits and credits together. */
SF.craftAttempt = (ch, pack, plan, rng, cap, opt) => {
  if (!plan.ok) return { ok: false, reason: plan.reason, free: true };
  const sim = { items: pack.items.map(i => Object.assign({}, i)), ver: 0 };
  for (const l of plan.lines) SF.removeLine(sim, l, l.qty);
  for (const o of SF.craftOutputs(ch, plan, false, opt, true)) { const a = SF.addItem(sim, o, cap); if (!a.ok) return { ok: false, reason: a.reason, free: true }; }
  rng = rng || Math.random;
  if (rng() >= plan.chance) { const lost = plan.lines.map(l => ({ id: l.id, mat: l.mat, n: l.fail })); for (const l of plan.lines) SF.removeLine(pack, l, l.fail); return { ok: true, success: false, lost }; }
  const exceptional = plan.quality ? rng() < plan.exc : false;
  for (const l of plan.lines) SF.removeLine(pack, l, l.qty);
  const items = SF.craftOutputs(ch, plan, exceptional, opt, false); for (const o of items) SF.addItem(pack, o, null);
  return { ok: true, success: true, exceptional, items };
};
/* compatibility wrapper for the old call shape */
SF.craft = (ch, r, rng, cap, mat) => { const p = SF.craftPlan(ch, ch.pack, r, mat); const res = SF.craftAttempt(ch, ch.pack, p, rng, cap, {}); return res.ok ? res : { ok: false, reason: res.reason }; };

/* recipe registry: shape the existing smith rows, add fittings and coloured smelting, then rebuild the index */
Object.assign(SF.RECIPE.ironbar, { cat: 'Smelt', name: 'Smelt iron bar' });
Object.assign(SF.RECIPE.ironshard, { cat: 'Fittings', name: 'Cut iron shards', fixedMat: 'iron' });
for (const [id, n, nm] of [['dagger', 1, 'Dagger'], ['sword', 3, 'Quay sword']]) { const r = SF.RECIPE[id]; Object.assign(r, { name: nm, prim: 'metal', defMat: 'iron', cat: 'Weapons', lines: [{ form: 'ingot', qty: n }, { item: 'strap', qty: 1 }] }); delete r.inputs; }
SF.RECIPES.push(
  { id: 'rivets', name: 'Mooring rivets', out: 'rivet', qty: 8, skill: 'smithing', min: 0, station: 'anvil', tool: 'tongs', prim: 'metal', defMat: 'iron', cat: 'Fittings', lines: [{ form: 'ingot', qty: 1 }] },
  { id: 'nails', name: 'Nail strip', out: 'nail', qty: 12, skill: 'smithing', min: 0, station: 'anvil', tool: 'tongs', prim: 'metal', defMat: 'iron', cat: 'Fittings', lines: [{ form: 'ingot', qty: 1 }] },
  { id: 'hinges', name: 'Hinge pair', out: 'hinge', qty: 2, skill: 'smithing', min: 10, station: 'anvil', tool: 'tongs', prim: 'metal', defMat: 'iron', cat: 'Fittings', lines: [{ form: 'ingot', qty: 1 }, { item: 'rivet', qty: 4, match: true }] });
for (const M of SF.METALS.slice(1).map(a => SF.METAL[a[0]])) SF.RECIPES.push({ id: 'smelt_' + M.id, name: 'Smelt ' + M.n.toLowerCase(), out: SF.ingotId(M.id), qty: 1, skill: 'mining', min: M.mine, diff: M.mine, station: 'forge', fixedMat: M.id, cat: 'Smelt', inputs: { [SF.oreId(M.id)]: 3 } });
SF.reindexRecipes = () => { for (const k in SF.RECIPE) delete SF.RECIPE[k]; for (const r of SF.RECIPES) SF.RECIPE[r.id] = r; };
SF.reindexRecipes();

/* ---------------- gathering (§5 table) ---------------- */
SF.NODE_TIER_DIFF = [15, 45, 70, 85];
SF.NODE_TIER_MIN = [0, 30, 55, 80];
SF.GATHER_TIME = { woodcutting: 2, mining: 2, foraging: 1.4, skinning: 1.4, fishing: 2.5 };
SF.GATHER_RANGE = { woodcutting: 2, mining: 2, foraging: 2, skinning: 2, fishing: 8 };

/* ---------------- M3 rules: theft, locks, traps, pets, bard, condition ---------------- */
// §3 pickpocketing
SF.pickChance = (skill, kg) => clamp(.10, .85, .45 + .006 * (skill - 45) - .05 * kg);
SF.pickMaxKg = skill => .10 + .009 * skill;
SF.PICK_RANGE = 1.5; SF.PICK_TIME = 1.4; SF.PICK_COOLDOWN = 20; SF.PICK_MAX_UNITS = 10;
// §5 supporting defaults
SF.CHEST_DIFF = [25, 55, 80]; SF.LOCK_TIME = 2;
SF.TRAP = { place: 1.5, arm: 1, life: 180, dmg: 6, slow: .25, slowFor: 2, max: 2, spacing: 4 };
SF.TAME = { time: 4, range: 3, slots: 2 };
SF.VET = { range: 1.5, time: 3, heal: v => 10 + .35 * v };
SF.BARD = { prep: 1.25, cd: 8, shared: 2, range: 8, lullaby: 5, discord: .15, discordFor: 8, provoke: 8 };
SF.SEARCH = { wind: .8, cd: 5, radius: s => 4 + 4 * s / 100 };
SF.SHADOW_STEPS = s => 2 + Math.floor(s / 20);
SF.APPRAISE_TIME = .75;
SF.venomTier = s => s >= 80 ? 3 : s >= 55 ? 2 : s >= 30 ? 1 : 0;
SF.VENOM_CHARGES = 5;
// §9 condition and repair: each repair restores to max minus 3% of the original maximum; below 40% replace
SF.WEARABLE = id => ['weapon', 'shield', 'armor'].includes(SF.ITEMS[id].cat) && SF.ITEMS[id].trade;
SF.repairSkill = id => { const d = SF.ITEMS[id]; if (d.wpn === 'shortbow' || d.wpn === 'crossbow' || id === 'buckler') return 'carpentry'; if (d.armor === 'cloth' || d.armor === 'leather') return 'tailoring'; return 'smithing'; };
SF.trainCost = (skill, to) => Math.max(0, Math.round((to * to - skill * skill) * 0.6));
SF.statTrainCost = n => n * 25;

if (typeof module !== 'undefined' && module.exports) module.exports = SF; else root.SF = SF;
})(typeof globalThis !== 'undefined' ? globalThis : this);

</script>
