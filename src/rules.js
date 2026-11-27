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
SF.maxStam = c => Math.max(1, c.dex + (c.eqDex || 0));   // eqDex: transient equipment Dexterity modifier (SF.EQ.refresh), never saved
SF.maxMana = c => c.int;
/* weight: items keep their authored mass (kg) internally; the game shows and balances in weight units (SF.WU per kg).
   Carrying capacity is Strength-based (UO-inspired, configurable): 40 + 3.5 × STR weight units. The backpack has no slot limit. */
SF.WU = 2.5;
SF.CARRY = { base: 40, perStr: 3.5 };
SF.carryCap = c => SF.CARRY.base + SF.CARRY.perStr * c.str;            // weight units
SF.carryKg = c => SF.carryCap(c) / SF.WU;
SF.SLOTS = Infinity;                                                      // no backpack stack limit (v0.25)
SF.WALK = 4.1; SF.SPRINT = 5.3; SF.SPRINT_DRAIN = 7; SF.STAM_REGEN = 5; SF.STAM_REGEN_COMBAT = 3; SF.STAM_DELAY = 0.75;

/* ---------------- skills: the 49 classic skills of UO The Second Age (docs/skills/T2A_SKILL_PARITY_v1.md) ----------------
   One authoritative registry. Each row: id, display name, classic skill-window group, active (has a use button), target mode,
   usage delay (s), dependencies, stat-gain weights {str, dex, int} (chance per skill gain = weight / 33.3, RunUO-style; a
   reconstruction, not verified per patch), stat-bonus weights (how much each stat lifts the displayed value), state, help.
   state: 'live' = real mechanics in this build, 'partial' = works but with a documented gap, 'pending' = not yet usable.
   The engine (gain, stats, migration, per-skill mechanics) lives in src/skills.js (SF.SK). */
SF.SKILL_GROUPS = [['misc', 'Miscellaneous'], ['combat', 'Combat'], ['trade', 'Trade skills'], ['magic', 'Magic'], ['wild', 'Wilderness'], ['thief', 'Thieving'], ['bard', 'Bardic']];
SF.SKILL_DEFS = [
  // id, name, group, active, target, delay, deps, gain weights [s,d,i], bonus weights [s,d,i], state, help
  ['alchemy', 'Alchemy', 'trade', 0, 'craft', 0, [], [0, .5, .5], [0, .5, .5], 'live', 'Brew potions at an alchemy still: healing, cure, stamina, mana, explosion and four strengths of poison.'],
  ['anatomy', 'Anatomy', 'misc', 1, 'creature', 1, [], [.15, .15, .7], [0, 0, 1], 'live', 'Adds up to 20% weapon damage and improves bandage healing. Use it on a living target to judge its strength and dexterity.'],
  ['animallore', 'Animal Lore', 'wild', 1, 'creature', 1, [], [0, 0, 1], [0, 0, 1], 'live', 'Study a creature: its health, strength, diet and, for pets, how content it is. Helps you control difficult pets and treat them.'],
  ['itemidentification', 'Item Identification', 'misc', 1, 'item', 1, [], [0, 0, 1], [0, 0, 1], 'live', 'Reveal an item\'s hidden properties, maker, condition and fair price.'],
  ['armslore', 'Arms Lore', 'misc', 1, 'item', 1, [], [.75, .15, .1], [0, .5, .5], 'pending', 'Judge a weapon or piece of armor: condition, quality, how hard it hits or how well it protects.'],
  ['parrying', 'Parrying', 'combat', 0, 'none', 0, [], [.75, .25, 0], [0, 1, 0], 'live', 'With a shield: half your Parrying as a percent chance to block part of a physical hit.'],
  ['begging', 'Begging', 'misc', 1, 'npc', 10, [], [0, 0, 0], [0, 0, 1], 'pending', 'Plead with townsfolk for a few coins. Each person gives at most once in a while.'],
  ['blacksmithy', 'Blacksmithy', 'trade', 0, 'craft', 0, [], [1, 0, 0], [.5, .5, 0], 'live', 'Forge weapons, armor and fittings at an anvil, and repair metal gear.'],
  ['bowcraft', 'Bowcraft & Fletching', 'trade', 0, 'craft', 0, [], [.6, 1.6, 0], [0, 1, 0], 'live', 'Make bows, crossbows, arrows and bolts at a bench.'],
  ['peacemaking', 'Peacemaking', 'bard', 1, 'self', 10, ['musicianship'], [0, 0, 0], [0, .5, .5], 'live', 'Play to calm every creature around you; fighting stops for a few moments. Needs an instrument and a Musicianship check.'],
  ['camping', 'Camping', 'wild', 1, 'item', 2, [], [2, 1.5, 1.5], [0, .5, .5], 'pending', 'Light kindling into a campfire. After a while the camp is secure: make camp with a bedroll to rest and save safely.'],
  ['carpentry', 'Carpentry', 'trade', 0, 'craft', 0, [], [2, .5, 0], [.5, .5, 0], 'live', 'Work wood into shields, furniture and kits at a bench, and repair wooden gear.'],
  ['cartography', 'Cartography', 'misc', 1, 'craft', 0, [], [0, .75, .75], [0, .5, .5], 'pending', 'Draw maps with a mapmaker\'s pen, and decode treasure maps.'],
  ['cooking', 'Cooking', 'trade', 0, 'craft', 0, [], [0, 2, 3], [0, .5, .5], 'live', 'Cook meat, fish and meals over a fire.'],
  ['detectinghidden', 'Detecting Hidden', 'thief', 1, 'self', 10, [], [0, .4, .6], [0, 0, 1], 'live', 'Search the area around you for hidden creatures and traps. Range grows with skill.'],
  ['enticement', 'Enticement', 'bard', 1, 'creature', 10, ['musicianship'], [0, .25, .25], [0, .5, .5], 'live', 'Lure a creature to you with music: it leaves what it was doing and comes to listen.'],
  ['evaluatingintelligence', 'Evaluating Intelligence', 'magic', 1, 'creature', 1, [], [0, 0, 1], [0, 0, 1], 'live', 'Raises the damage of your spells. Use it on a creature to judge its intelligence and mana.'],
  ['healing', 'Healing', 'misc', 0, 'none', 0, ['anatomy'], [.6, .6, .8], [0, .5, .5], 'live', 'First Aid with bandages: heal wounds; cure poison at 60 Healing and 60 Anatomy; resurrect another player at 80 and 80.'],
  ['fishing', 'Fishing', 'wild', 0, 'ground', 0, [], [.5, .5, 0], [0, .5, .5], 'live', 'Fish open water with a rod. Skilled anglers sometimes pull up more than fish.'],
  ['forensicevaluation', 'Forensic Evaluation', 'misc', 1, 'corpse', 1, [], [0, .2, .8], [0, 0, 1], 'pending', 'Examine a body or a forced lock: who did it and how long ago.'],
  ['herding', 'Herding', 'wild', 1, 'creature', 1, [], [1, 1, .1], [0, .5, .5], 'pending', 'With a shepherd\'s crook, direct an animal to walk to a spot you choose.'],
  ['hiding', 'Hiding', 'thief', 1, 'self', 10, [], [0, .8, .2], [0, 1, 0], 'live', 'Slip out of sight. Walking reveals you unless you also have Stealth; acting or being found reveals you.'],
  ['provocation', 'Provocation', 'bard', 1, 'creature2', 10, ['musicianship'], [0, .45, .05], [0, .5, .5], 'live', 'Play to set one creature against another: choose the first, then the second. Failure turns them on you.'],
  ['inscription', 'Inscription', 'magic', 0, 'craft', 0, ['magery'], [0, .2, .8], [0, 0, 1], 'pending', 'Write spell scrolls from your spellbook onto blank scrolls with the spell\'s reagents and mana.'],
  ['lockpicking', 'Lockpicking', 'thief', 1, 'item', 2, [], [0, 2, 0], [0, 1, 0], 'live', 'Pick locked chests and boxes with lockpicks.'],
  ['magery', 'Magery', 'magic', 0, 'none', 0, [], [0, 0, 1.5], [0, 0, 1], 'live', 'Cast the eight circles of spells from your spellbook. Higher circles need more skill.'],
  ['resistingspells', 'Resisting Spells', 'magic', 0, 'none', 0, [], [.25, .25, .5], [0, 0, 0], 'live', 'A chance to halve the damage of hostile spells. It rises when resistible magic strikes you.'],
  ['tactics', 'Tactics', 'combat', 0, 'none', 0, [], [2, 0, 0], [0, 0, 0], 'live', 'Weapon damage: 50% of the rolled damage at 0, 150% at 100. Does not change hit chance.'],
  ['snooping', 'Snooping', 'thief', 1, 'creature', 1, [], [0, 2.5, 0], [0, 1, 0], 'pending', 'Peek into someone\'s pack without being noticed. Needed to see what you might steal.'],
  ['musicianship', 'Musicianship', 'bard', 1, 'self', 5, [], [0, .8, .2], [0, 1, 0], 'live', 'Play an instrument well. Every bardic skill checks it first.'],
  ['poisoning', 'Poisoning', 'thief', 1, 'item', 2, [], [0, .4, 1.6], [0, 0, 1], 'live', 'Apply a poison potion to a bladed or piercing weapon, or to food.'],
  ['archery', 'Archery', 'combat', 0, 'none', 0, [], [.25, .75, 0], [0, 1, 0], 'live', 'Hit chance with bows (arrows) and crossbows (bolts). Stand still to aim; the shot lands a second later.'],
  ['spiritspeak', 'Spirit Speak', 'magic', 1, 'self', 10, [], [0, 0, 1], [0, 0, 1], 'pending', 'Open your ears to the dead for a while: ghosts and restless spirits speak plainly to you.'],
  ['stealing', 'Stealing', 'thief', 1, 'item', 10, [], [0, 1, 0], [0, 1, 0], 'live', 'Take an item from someone\'s pack. Heavier items are harder; being caught has consequences.'],
  ['tailoring', 'Tailoring', 'trade', 0, 'craft', 0, [], [.38, 1.63, .5], [0, 1, 0], 'live', 'Sew cloth and leather into clothing and armor, and make bandages.'],
  ['animaltaming', 'Animal Taming', 'wild', 1, 'creature', 10, [], [1.4, .2, .4], [0, 0, 1], 'live', 'Tame a wild creature. Each kind needs a minimum skill; stronger creatures need an experienced master to obey.'],
  ['tasteidentification', 'Taste Identification', 'misc', 1, 'item', 1, [], [.2, 0, .8], [0, 0, 1], 'pending', 'Taste food, drink or a potion to find poison and how strong it is.'],
  ['tinkering', 'Tinkering', 'trade', 0, 'craft', 0, [], [.5, .2, .3], [0, .5, .5], 'live', 'Make tools, lockpicks, lockboxes, traps and devices.'],
  ['tracking', 'Tracking', 'wild', 1, 'self', 10, [], [0, 1.25, 1.25], [0, .5, .5], 'live', 'Choose animals, monsters or people, then one of them: an arrow follows its trail.'],
  ['veterinary', 'Veterinary', 'wild', 1, 'creature', 0, ['animallore'], [.8, .4, .4], [0, .5, .5], 'live', 'Bandage a pet: heal it; cure its poison at 60 Veterinary and 60 Animal Lore.'],
  ['swordsmanship', 'Swordsmanship', 'combat', 0, 'none', 0, [], [.75, .25, 0], [.5, .5, 0], 'live', 'Hit chance with swords, axes, the halberd and the skinning knife. Also your defence while one is in hand.'],
  ['macefighting', 'Mace Fighting', 'combat', 0, 'none', 0, [], [.9, .1, 0], [1, 0, 0], 'live', 'Hit chance with maces, war hammers, staves and the war axe. Mace and war hammer hits drain stamina and wear armor.'],
  ['fencing', 'Fencing', 'combat', 0, 'none', 0, [], [.45, .55, 0], [0, 1, 0], 'live', 'Hit chance with daggers, kryss and spears. Also your defence while one is in hand.'],
  ['wrestling', 'Wrestling', 'combat', 0, 'none', 0, [], [.9, .1, 0], [1, 0, 0], 'live', 'Unarmed attack and unarmed defence.'],
  ['lumberjacking', 'Lumberjacking', 'trade', 0, 'ground', 0, [], [2, 0, 0], [1, 0, 0], 'live', 'Chop logs from trees with a hatchet or axe. Rare woods need high skill.'],
  ['mining', 'Mining', 'trade', 0, 'ground', 0, [], [2, 0, 0], [1, 0, 0], 'live', 'Dig ore with a pickaxe and smelt it at a forge. Coloured ores need high skill.'],
  ['meditation', 'Meditation', 'magic', 1, 'self', 10, [], [0, 0, 2], [0, 0, 1], 'live', 'Passively speeds mana return in light armor; meditate to double it (at most 2 mana per second). Metal armor and anything in hand block it.'],
  ['stealth', 'Stealth', 'thief', 1, 'self', 10, ['hiding'], [0, 0, 0], [0, 1, 0], 'live', 'While hidden, with 80 Hiding: move a step for every 10 points of Stealth without being seen. Heavy armor makes it harder.'],
  ['removetrap', 'Remove Trap', 'thief', 1, 'item', 10, ['lockpicking', 'detectinghidden'], [0, 1, 0], [0, 1, 0], 'live', 'Disarm a trapped box or snare. Needs 50 Lockpicking and 50 Detecting Hidden.']];
/* tuples for older callers: [id, name, group, usable now] in alphabetical display order */
SF.SKILLS = SF.SKILL_DEFS.map(d => [d[0], d[1], d[2], d[9] === 'pending' ? 0 : 1]).sort((a, b) => a[1].localeCompare(b[1]));
SF.SKILL = {}; SF.SKILL_TIP = {};
for (const d of SF.SKILL_DEFS) {
  const [k, n, g, act, tgt, cd, deps, gw, bw, state, help] = d;
  SF.SKILL[k] = { k, n, g, live: state !== 'pending', active: !!act, tgt, cd, deps, gain: { str: gw[0], dex: gw[1], int: gw[2] }, bonus: { str: bw[0], dex: bw[1], int: bw[2] }, state, help };
  SF.SKILL_TIP[k] = help;
}
SF.SKILL_COUNT = SF.SKILL_DEFS.length;   // 49
SF.newSkills = () => { const s = {}; for (const [k] of SF.SKILLS) s[k] = { v: 0, lock: 'raise' }; return s; };
SF.totalSkill = ch => Object.values(ch.skills).reduce((a, s) => a + s.v, 0);
SF.sv = (ch, k) => (ch.skills && ch.skills[k] ? ch.skills[k].v / 10 : (ch.sk && ch.sk[k]) || 0);

/* creation rules, skill checks, gains and stat gains: src/skills.js (SF.SK). The old blanket gain window, the three-uses-per-target
   limit and the per-recipe taper are gone (docs/skills/T2A_SKILL_PARITY_v1.md §1). */
SF.opposed = (skill, diff) => clamp(0.10, 0.95, 0.55 + (skill - diff) / 125);

/* ---------------- combat: UO Second Age (T2A) reconstruction, issue #3 ----------------
   Sources (see docs/combat/STATUS.md): wiki.uosecondage.com Weapons, Category:Weapon_Skills, Tactics, Parrying, Healing;
   forums.uosecondage.com threads on swing timing (t=42668, t=13143), damage order (t=42652), archery (t=24145, t=2152).
   Every value marked "Shardfall choice" is a tuning decision where the references are silent or disagree. */
SF.TICK = .25; SF.SWING_MIN = 1.25; SF.SWING_MAX = 10;
SF.MELEE_REACH = 1.5;            // one UO tile including diagonals (1 tile = 1 world metre, as in docs/magery/spells.json) plus slack
SF.ARCHERY = { range: 10, aim: .5, flight: 1, drift: .3 };   // range 10 tiles; aim and drift: Shardfall choice; 1 s delayed damage (UOSA)
// weapon profiles. dice [count, sides, bonus]; speed = the UOSA "speed #"; str = STR requirement; hp = reference durability;
// fam = the animation set the sprite sheet already has; mace = bashing weapon (stamina drain and armor wear)
SF.WEAPONS = {
  sword:         { n: 'Longsword',      fam: 'Sword',    skill: 'swordsmanship', dice: [2, 15, 3], speed: 35, str: 25, hp: 90 },
  glaive:        { n: 'Halberd',        fam: 'Glaive',   skill: 'swordsmanship', dice: [2, 23, 3], speed: 25, str: 45, hp: 80, two: true },
  battleaxe:     { n: 'Battle Axe',     fam: 'Glaive',   skill: 'swordsmanship', dice: [2, 17, 4], speed: 30, str: 40, hp: 80, two: true },
  hatchet:       { n: 'Hatchet',        fam: 'Sword',    skill: 'swordsmanship', dice: [1, 16, 1], speed: 40, str: 15, hp: 80, two: true },
  knife:         { n: 'Skinning Knife', fam: 'Dagger',   skill: 'swordsmanship', dice: [1, 10, 0], speed: 40, str: 5,  hp: 40 },
  pickaxe:       { n: 'Pickaxe',        fam: 'Hammer',   skill: 'swordsmanship', dice: [1, 15, 0], speed: 35, str: 25, hp: 60 },
  hammer:        { n: 'War Hammer',     fam: 'Hammer',   skill: 'macefighting',  dice: [7, 5, 1],  speed: 31, str: 40, hp: 110, two: true, mace: true },
  mace:          { n: 'Mace',           fam: 'Hammer',   skill: 'macefighting',  dice: [6, 5, 2],  speed: 30, str: 20, hp: 70, mace: true },
  waraxe:        { n: 'War Axe',        fam: 'Sword',    skill: 'macefighting',  dice: [6, 4, 3],  speed: 40, str: 35, hp: 80 },
  dagger:        { n: 'Dagger',         fam: 'Dagger',   skill: 'fencing',       dice: [3, 5, 0],  speed: 55, str: 1,  hp: 50 },
  kryss:         { n: 'Kryss',          fam: 'Dagger',   skill: 'fencing',       dice: [1, 26, 2], speed: 53, str: 10, hp: 90 },
  spear:         { n: 'Spear',          fam: 'Glaive',   skill: 'fencing',       dice: [2, 18, 0], speed: 46, str: 30, hp: 80, two: true },
  shortbow:      { n: 'Bow',            fam: 'Shortbow', skill: 'archery',       dice: [4, 9, 5],  speed: 20, str: 20, hp: 60, two: true, ammo: 'arrow' },
  crossbow:      { n: 'Crossbow',       fam: 'Crossbow', skill: 'archery',       dice: [5, 8, 3],  speed: 18, str: 30, hp: 80, two: true, ammo: 'bolt' },
  heavycrossbow: { n: 'Heavy Crossbow', fam: 'Crossbow', skill: 'archery',       dice: [5, 10, 6], speed: 10, str: 40, hp: 100, two: true, ammo: 'bolt' },
  unarmed:       { n: 'Fists',          fam: 'Unarmed',  skill: 'wrestling',     dice: [1, 8, 0],  speed: 50, str: 0 } };
for (const k in SF.WEAPONS) { const w = SF.WEAPONS[k]; w.id = k; w.reach = w.ammo ? SF.ARCHERY.range : SF.MELEE_REACH; w.dmg = [w.dice[0] + w.dice[2], w.dice[0] * w.dice[1] + w.dice[2]]; if (w.ammo) w.proj = SF.ARCHERY.range / SF.ARCHERY.flight; }
SF.WEAPON_SKILLS = ['swordsmanship', 'macefighting', 'fencing', 'archery', 'wrestling'];
// armor rating of the one body piece Shardfall has (UO body pieces: leather 13, chainmail 28, platemail 40); buckler AR 7
SF.ARMOR_AR = { none: 0, cloth: 3, leather: 13, chain: 28, plate: 40 };
SF.SHIELD_AR = { buckler: 7 };
SF.ARMOR = SF.ARMOR_AR;
SF.ARMOR_SPEED = { plate: .06, chain: .03 };
SF.ARMOR_MANA = { plate: .30, chain: .15 };
SF.SWAP_TIME = .25;             // presentation: stowing a drawn weapon before a cast
SF.BRACE_PARRY = .12;            // Shardfall's Braced Guard: +12 points of parry chance for 0.8 s (not in T2A)

/* hit chance (Category:Weapon_Skills): (attack + 50) / (2 × (defence + 50)), clamped to [0, 1]. Tactics, Anatomy and armor never enter it. */
SF.hitChance = (atk, def) => clamp(0, 1, (atk + 50) / (2 * (def + 50)));
/* swing delay: 15000 / ((stamina + 100) × speed) s, floored to the 0.25 s tick, within 1.25–10 s */
SF.swingDelay = (stam, speed) => clamp(SF.SWING_MIN, SF.SWING_MAX, Math.floor(15000 / ((Math.max(0, stam) + 100) * speed) / SF.TICK) * SF.TICK);
SF.rollDice = (d, rng) => { let t = d[2] || 0; for (let i = 0; i < d[0]; i++) t += 1 + Math.floor(rng() * d[1]); return t; };
/* % of rolled damage dealt: 0.50 + Tactics/100 (Tactics page: Tactics + 50 %) + Anatomy/500 (0–20 %) + STR/500 (0–20 %) */
SF.damageScale = o => .5 + clamp(0, 100, o.tactics || 0) / 100 + clamp(0, 100, o.anatomy || 0) / 500 + clamp(0, 100, o.str || 0) / 500;
SF.QUALITY_DMG = { exceptional: 4, low: -4 };                      // Weapons page: exceptional listed+4, below average listed−4
SF.wearFactor = (cond, maxc) => cond === undefined ? 1 : clamp(0, 1, .5 + .5 * cond / (maxc || 100));   // 100 % condition → 100 %, 1 % → ~50 %
SF.parryChance = (parry, braced) => clamp(0, 1, parry / 200 + (braced ? SF.BRACE_PARRY : 0));          // Parrying page: skill / 2 %
SF.absorbRoll = (ar, rng) => ar <= 0 ? 0 : Math.ceil(ar / 2) + Math.floor(rng() * (ar - Math.ceil(ar / 2) + 1));   // 50–100 % of AR
/* stage 1: what the swing carries before any defence. o = {dice | range [lo, hi], roll, quality, cond, maxc, tactics, anatomy, str, scale} */
SF.rawDamage = (o, rng) => {
  const roll = o.roll !== undefined ? o.roll : o.range ? o.range[0] + Math.floor(rng() * (o.range[1] - o.range[0] + 1)) : SF.rollDice(o.dice, rng);
  const base = roll + (SF.QUALITY_DMG[o.quality] || 0);
  const scale = o.scale !== undefined ? o.scale : SF.damageScale(o);
  const wear = SF.wearFactor(o.cond, o.maxc);
  return { roll, base, scale, wear, value: Math.max(0, base) * scale * wear };
};
/* stage 2: defence, each step once, in the reference order (t=42652): shield parry → armor absorb → halve for a player recipient → round.
   d = {parry (skill), braced, shieldAR, armorAR, player (bool), mace (bool)} */
SF.mitigate = (value, d, rng) => {
  const r = { before: value, parried: false, shield: 0, armor: 0, armorWear: 0, halved: false };
  let v = value;
  if (d.shieldAR > 0) { r.parryChance = SF.parryChance(d.parry || 0, d.braced); if (rng() < r.parryChance) { r.parried = true; r.shield = Math.min(v, SF.absorbRoll(d.shieldAR, rng)); v -= r.shield; } }
  if (d.armorAR > 0 && v > 0) { r.armor = Math.min(v, SF.absorbRoll(d.armorAR, rng)); v -= r.armor; if (d.mace) r.armorWear = roundHalfUp(r.armor / 2); }
  if (d.player) { v /= 2; r.halved = true; }
  r.final = Math.max(0, roundHalfUp(v)); return r;
};
SF.MACE_STAM = [3, 5];

/* the swing timer: one readiness state per fighter. The timer runs from the last swing (or equip restart) against the delay of the weapon
   in hand now, at current stamina. Once it completes the swing is ready and stays ready (a held swing survives unequipping, a new
   target or a held spell). Equipping while not ready restarts the timer for the new weapon: no fresh swing per equip, but a ready
   swing carries over (T2A weapon cycling). */
SF.newSwing = () => ({ t: -1e9, ready: true });
SF.swingTick = (st, now, stam, w) => { if (!st.ready && now - st.t >= SF.swingDelay(stam, w.speed) - 1e-9) st.ready = true; return st.ready; };
SF.swingSpend = (st, now) => { st.t = now; st.ready = false; };
SF.swingEquip = (st, now, stam, w) => { if (!SF.swingTick(st, now, stam, w)) st.t = now; return st.ready; };
SF.swingLeft = (st, now, stam, w) => st.ready ? 0 : Math.max(0, SF.swingDelay(stam, w.speed) - (now - st.t));

/* First Aid (Healing page): delays self/other, thresholds, heal range. Success, slips and the curves above the thresholds are noted per value. */
SF.FIRST_AID = { range: 2, time: { heal: [15, 5], cure: [18, 6], res: [0, 10] }, cureMin: 60, resMin: 80, slipHp: 4, slipChance: .02 };
SF.firstAidKind = p => p.ghost ? 'res' : p.poisoned ? 'cure' : p.hp < p.max ? 'heal' : null;
SF.firstAidTime = (kind, self) => SF.FIRST_AID.time[kind][self ? 0 : 1];
SF.healRange = (heal, ana) => [Math.floor(3 + ana / 5 + heal / 5), Math.floor(10 + ana / 5 + heal / 2)];
SF.healChance = (heal, slips) => clamp(0, 1, (heal + 10) / 100 - SF.FIRST_AID.slipChance * (slips || 0));    // never fails from 90 with no slips (UOSA forum); Shardfall choice
SF.cureChance = (heal, ana, slips) => heal < SF.FIRST_AID.cureMin || ana < SF.FIRST_AID.cureMin ? 0 : clamp(0, 1, .80 + (Math.min(heal, ana) - 60) / 200 - SF.FIRST_AID.slipChance * (slips || 0));   // 80 % at 60/60 (Healing page); rise to 100 % at 100: Shardfall choice
SF.resChance = (heal, ana, slips) => heal < SF.FIRST_AID.resMin || ana < SF.FIRST_AID.resMin ? 0 : clamp(0, 1, .25 + .02 * (Math.min(heal, ana) - 80) - SF.FIRST_AID.slipChance * (slips || 0));   // 25 % at 80/80 (Healing page); 65 % at 100: Shardfall choice
/* validate a treatment before a bandage is spent. h = healer {self, dist}, p = patient state {ghost, poisoned, hp, max, isPlayer, pet} */
SF.firstAidCheck = (p, o) => {
  if (!p) return { ok: false, reason: 'Choose a patient first.' };
  if (p.pet) return { ok: false, reason: 'Pets are treated with Veterinary (Treat pet).' };
  if (p.ghost && o.self) return { ok: false, reason: 'You cannot resurrect yourself.' };
  if (p.ghost && !p.isPlayer) return { ok: false, reason: 'Only a player ghost can be brought back with bandages.' };
  const kind = SF.firstAidKind(p); if (!kind) return { ok: false, reason: o.self ? 'You are not hurt.' : 'Your patient is not hurt.' };
  if (!o.self && o.dist > SF.FIRST_AID.range) return { ok: false, reason: `Stand within ${SF.FIRST_AID.range} m of your patient.` };
  if (o.bandages <= 0) return { ok: false, reason: 'You have no bandages.' };
  if (o.busy) return { ok: false, reason: 'You are already applying a bandage.' };
  return { ok: true, kind, time: SF.firstAidTime(kind, o.self) };
};
/* resolve one finished application. o = {kind, heal, ana, slips, missing}. Draw order: success roll, then amount. */
SF.firstAidResolve = (o, rng) => {
  const s = o.slips || 0, r = { kind: o.kind, slips: s };
  if (o.kind === 'heal') {
    r.chance = SF.healChance(o.heal, s); r.range = SF.healRange(o.heal, o.ana);
    if (rng() >= r.chance) { r.success = false; r.amount = 0; r.note = 'failed'; return r; }
    r.roll = r.range[0] + Math.floor(rng() * (r.range[1] - r.range[0] + 1));
    let a = r.roll - SF.FIRST_AID.slipHp * s; r.note = s ? 'slipped' : 'healed'; if (a < 1) { a = 1; r.note = 'barely'; }
    r.amount = Math.min(a, Math.max(0, Math.ceil(o.missing - 1e-9))); r.success = true; return r;   // whole HP; the patient's maximum still caps it
  }
  if (o.kind === 'cure') { r.chance = SF.cureChance(o.heal, o.ana, s); if (!r.chance) { r.success = false; r.note = 'unskilled'; return r; } r.success = rng() < r.chance; r.note = r.success ? 'cured' : 'cure_failed'; return r; }
  r.chance = SF.resChance(o.heal, o.ana, s); if (!r.chance) { r.success = false; r.note = 'unskilled'; return r; }
  r.success = rng() < r.chance; r.note = r.success ? 'resurrected' : 'res_failed'; return r;
};

/* active Anatomy: a coarse read that sharpens with skill; stamina shows from 80 */
SF.anatomyRead = (skill, t) => {
  const w = Math.max(5, Math.round(40 - skill * .35)), band = v => { const lo = clamp(0, 100, Math.floor(v / w) * w); return [lo, Math.min(100, lo + w)]; };
  const word = (v, a) => a[Math.min(a.length - 1, Math.floor(clamp(0, 99.9, v) / (100 / a.length)))];
  return { str: band(t.str), dex: band(t.dex), strWord: word(t.str, ['frail', 'slight', 'of ordinary strength', 'strong', 'very strong', 'mighty']), dexWord: word(t.dex, ['sluggish', 'clumsy', 'of ordinary agility', 'quick', 'very agile', 'blindingly fast']), stam: skill >= 80 ? [Math.round(t.stam), Math.round(t.maxStam)] : null };
};

/* ---------- save migration: combat skill keys (Blades → Swordsmanship, …), once ---------- */
SF.COMBAT_MIGRATION = 1;
SF.LEGACY_SKILL = { blades: 'swordsmanship', hammers: 'macefighting', knives: 'fencing', brawling: 'wrestling', medicine: 'healing', shieldwork: 'parrying' };
SF.LEGACY_POLEARMS = ['glaive'];          // the only legacy polearm item; it maps to the halberd (Swordsmanship)
SF.migrateCombatSkills = c => {
  if (!c || !c.skills || (c.combatMig || 0) >= SF.COMBAT_MIGRATION) return { changed: false };
  const sk = c.skills, before = Object.values(sk).reduce((a, s) => a + (s.v || 0), 0), out = { changed: true, moved: [], displaced: 0, collisions: [] };
  const put = (from, to) => {
    const s = sk[from]; if (!s) return; delete sk[from];
    const cur = sk[to]; out.moved.push(from + '→' + to);
    if (!cur) { sk[to] = { v: s.v || 0, lock: s.lock || 'raise' }; return; }
    const lo = Math.min(s.v || 0, cur.v || 0); out.collisions.push({ to, kept: Math.max(s.v || 0, cur.v || 0), displaced: lo, from });
    if ((s.v || 0) > (cur.v || 0)) sk[to] = { v: s.v, lock: s.lock || 'raise' };
    out.displaced += lo;
  };
  for (const k in SF.LEGACY_SKILL) put(k, SF.LEGACY_SKILL[k]);
  if (sk.polearms) { const w = c.equip && c.equip.weapon, wid = w && SF.LEGACY_POLEARMS.includes(w.id) ? SF.ITEMS[w.id].wpn : 'glaive'; out.polearmsTo = SF.WEAPONS[wid].skill; put('polearms', out.polearmsTo); }
  for (const [k] of SF.SKILLS) if (!sk[k]) sk[k] = { v: 0, lock: 'raise' };
  c.skillPool = (c.skillPool || 0) + out.displaced;
  if (c.gainLog) { const g = {}; for (const key in c.gainLog) { const i = key.indexOf('|'), sk0 = i < 0 ? key : key.slice(0, i), nk = (SF.LEGACY_SKILL[sk0] || (sk0 === 'polearms' ? out.polearmsTo || 'swordsmanship' : sk0)) + (i < 0 ? '' : key.slice(i)); g[nk] = (g[nk] || []).concat(c.gainLog[key]); } c.gainLog = g; }
  if (Array.isArray(c.lowerRank)) c.lowerRank = [...new Set(c.lowerRank.map(k => SF.LEGACY_SKILL[k] || (k === 'polearms' ? out.polearmsTo : k)))];
  c.combatMig = SF.COMBAT_MIGRATION;
  out.conserved = Object.values(sk).reduce((a, s) => a + (s.v || 0), 0) + out.displaced === before;
  return out;
};
/* spend reform points from the pool on one skill: never past 100.0 or the 700.0 total */
SF.assignPool = (c, key, tenths) => {
  const s = c.skills[key]; if (!s || !(c.skillPool > 0)) return 0;
  const n = Math.max(0, Math.min(tenths, c.skillPool, SF.SKILL_MAX - s.v, SF.SKILL_CAP - SF.totalSkill(c)));
  s.v += n; c.skillPool -= n; return n;
};

SF.POISON = { 1: 2, 2: 3, 3: 4, 4: 6 };   // per tick: lesser, regular, greater, deadly SF.POISON_TICKS = 4; SF.POISON_GAP = 2;
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
SF.manaRegen = (med, armor) => (1 + .022 * med) * (1 - (typeof armor === 'number' ? clamp(0, 1, armor) : (SF.ARMOR_MANA[armor] || 0)));   // armor: a suit key (legacy) or the equipment's meditation interference 0–1
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
  hatchet:    { n: 'Hatchet', kg: 1.5, cat: 'tool', tool: 'lumberjacking', slot: 'weapon', wpn: 'hatchet' },
  pickaxe:    { n: 'Pickaxe', kg: 2.5, cat: 'tool', tool: 'mining', slot: 'weapon', wpn: 'pickaxe' },
  knife:      { n: 'Skinning knife', kg: .3, cat: 'tool', tool: 'carve', slot: 'weapon', wpn: 'knife' },
  rod:        { n: 'Fishing rod', kg: 1, cat: 'tool', tool: 'fishing' },
  tongs:      { n: 'Smith tongs', kg: 1, cat: 'tool', tool: 'smithing' },
  sewkit:     { n: 'Sewing kit', kg: .3, cat: 'tool', tool: 'tailoring' },
  dagger:     { n: 'Iron dagger', kg: .8, cat: 'weapon', slot: 'weapon', wpn: 'dagger' },
  sword:      { n: 'Iron sword', kg: 2.5, cat: 'weapon', slot: 'weapon', wpn: 'sword' },
  hammer:     { n: 'War hammer', kg: 3.2, cat: 'weapon', slot: 'weapon', wpn: 'hammer' },
  glaive:     { n: 'Glaive', kg: 4, cat: 'weapon', slot: 'weapon', wpn: 'glaive' },
  shortbow:   { n: 'Shortbow', kg: 1, cat: 'weapon', slot: 'weapon', wpn: 'shortbow' },
  crossbow:   { n: 'Crossbow', kg: 3.5, cat: 'weapon', slot: 'weapon', wpn: 'crossbow' },
  heavycrossbow: { n: 'Heavy crossbow', kg: 4.5, cat: 'weapon', slot: 'weapon', wpn: 'heavycrossbow' },
  battleaxe:  { n: 'Battle axe', kg: 4, cat: 'weapon', slot: 'weapon', wpn: 'battleaxe' },
  mace:       { n: 'Mace', kg: 3, cat: 'weapon', slot: 'weapon', wpn: 'mace' },
  waraxe:     { n: 'War axe', kg: 3.3, cat: 'weapon', slot: 'weapon', wpn: 'waraxe' },
  kryss:      { n: 'Kryss', kg: 1, cat: 'weapon', slot: 'weapon', wpn: 'kryss' },
  spear:      { n: 'Spear', kg: 3.5, cat: 'weapon', slot: 'weapon', wpn: 'spear' },
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
  hatchet: 20, pickaxe: 24, knife: 8, rod: 12, tongs: 15, sewkit: 6, dagger: 30, sword: 70, hammer: 75, glaive: 110, shortbow: 60, crossbow: 95, heavycrossbow: 140, battleaxe: 85, mace: 60, waraxe: 75, kryss: 70, spear: 65, buckler: 40,
  clothvest: 30, leather: 90, chain: 220, plate: 420, lockpick: 4, trapkit: 20, repairkit: 30, lute: 40, venom: 22, bellshard: 45, silk: 6 };

let UID = 1;
SF.setUidBase = n => { UID = Math.max(UID, n); };
SF.newItem = (id, qty, extra) => Object.assign({ uid: UID++, id, qty: qty || 1 }, extra || {});
SF.newContainer = (kind, owner) => ({ cid: 'c' + (UID++), kind, owner: owner || null, items: [], ver: 0 });
SF.itemKg = it => SF.ITEMS[it.id].kg * it.qty;
SF.containerKg = c => c.items.reduce((a, it) => a + SF.itemKg(it) + (it.items ? SF.containerKg(it) : 0), 0);   // nested containers count their contents
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
  { id: 'ironbar', out: 'ironbar', qty: 1, skill: 'blacksmithy', min: 0, diff: 15, station: 'forge', inputs: { ore: 3 } },
  { id: 'ironshard', out: 'ironshard', qty: 6, skill: 'blacksmithy', min: 0, diff: 10, station: 'anvil', tool: 'tongs', inputs: { ironbar: 1 } },
  { id: 'dagger', out: 'dagger', qty: 1, skill: 'blacksmithy', min: 10, diff: 25, station: 'anvil', tool: 'tongs', inputs: { ironbar: 1, strap: 1 } },
  { id: 'sword', out: 'sword', qty: 1, skill: 'blacksmithy', min: 20, diff: 35, station: 'anvil', tool: 'tongs', inputs: { ironbar: 3, strap: 1 } },
  { id: 'strap', out: 'strap', qty: 2, skill: 'tailoring', min: 0, diff: 10, station: 'bench', tool: 'sewkit', inputs: { hide: 1 } },
  { id: 'bandage', out: 'bandage', qty: 5, skill: 'tailoring', min: 5, diff: 15, station: 'bench', tool: 'sewkit', inputs: { cloth: 2 } },
  { id: 'leather', out: 'leather', qty: 1, skill: 'tailoring', min: 30, diff: 45, station: 'bench', tool: 'sewkit', inputs: { hide: 6, sinew: 2 } },
  { id: 'shortbow', out: 'shortbow', qty: 1, skill: 'bowcraft', min: 15, diff: 30, station: 'bench', tool: 'knife', inputs: { pine: 4, sinew: 1 } },
  { id: 'buckler', out: 'buckler', qty: 1, skill: 'carpentry', min: 20, diff: 35, station: 'bench', tool: 'knife', inputs: { pine: 3, strap: 1 } },
  { id: 'arrows', out: 'arrow', qty: 20, skill: 'bowcraft', min: 10, diff: 20, station: 'bench', tool: 'knife', inputs: { pine: 1, ironshard: 1 } },
  { id: 'draught', out: 'draught', qty: 1, skill: 'alchemy', min: 25, diff: 40, station: 'still', inputs: { shelldust: 1, marshroot: 1, vial: 1 } },
  { id: 'antidote', out: 'antidote', qty: 1, skill: 'alchemy', min: 15, diff: 30, station: 'still', inputs: { marshroot: 2, vial: 1 } },
  { id: 'cinder', out: 'cinder', qty: 1, skill: 'alchemy', min: 40, diff: 55, station: 'still', inputs: { reedash: 2, lanternoil: 1, vial: 1 } },
  { id: 'cookedmeat', out: 'cookedmeat', qty: 1, skill: 'cooking', min: 0, diff: 15, station: 'fire', inputs: { meat: 1 } },
  { id: 'cookedfish', out: 'cookedfish', qty: 1, skill: 'cooking', min: 0, diff: 20, station: 'fire', inputs: { fish: 1 } },
  { id: 'lockpick', out: 'lockpick', qty: 5, skill: 'tinkering', min: 0, diff: 15, station: 'anvil', tool: 'tongs', inputs: { ironshard: 2 } },
  { id: 'trapkit', out: 'trapkit', qty: 1, skill: 'tinkering', min: 0, diff: 25, station: 'bench', tool: 'knife', inputs: { ironshard: 3, sinew: 1 } },
  { id: 'repairkit', out: 'repairkit', qty: 1, skill: 'tinkering', min: 20, diff: 35, station: 'bench', tool: 'knife', inputs: { ironbar: 1, strap: 1, pine: 1 } },
  { id: 'venom', out: 'venom', qty: 1, skill: 'alchemy', min: 0, diff: 25, station: 'still', inputs: { marshroot: 1, blacksalt: 1, vial: 1 } },
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
  ['agapite', 'Agapite', 90, 75, '#d09090', 1.35, 1.00], ['verite', 'Verite', 95, 85, '#4aac62', 1.20, .82], ['valorite', 'Valorite', 99, 95, '#5a80d8', 1.45, .95],
  ['mithril', 'Mithril', 100, 98, '#c4d6ee', 1.30, .45]];   // v0.25: the lightest craftable metal (equipment spec §8)
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
for (const [id, base] of [['dagger', 'dagger'], ['sword', 'Quay sword'], ['hammer', 'war hammer'], ['glaive', 'glaive'], ['battleaxe', 'battle axe'], ['mace', 'mace'], ['waraxe', 'war axe'], ['kryss', 'kryss'], ['spear', 'spear'], ['chain', 'chain armor'], ['plate', 'plate armor']]) Object.assign(SF.ITEMS[id], { base, prim: 'metal' });
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
/* each repair may cost maximum durability: the risk falls with the repairer's skill (configurable). Without a skill the loss is certain (legacy). */
SF.REPAIR = { base: 1.2, perSkill: .01, minRisk: .2 };
SF.repairRisk = skill => skill === undefined ? 1 : clamp(SF.REPAIR.minRisk, 1, SF.REPAIR.base - SF.REPAIR.perSkill * skill);
SF.repair = (it, opt) => { opt = opt || {}; const p = SF.repairPlan(it); if (!p.ok) return { ok: false, reason: p.reason };
  const mx = it.maxc === undefined ? 100 : it.maxc, lose = (opt.rng || Math.random)() < SF.repairRisk(opt.skill); const nm = lose ? p.nm : mx;
  it.maxc = nm; it.cond = nm; return { ok: true, maxc: nm, lost: lose ? mx - nm : 0 }; };

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
  { stock: 16, refill: 720, ore: { iron: 10, copper: 10, bronze: 14, golden: 16, agapite: 22, verite: 20, valorite: 8, mithril: 3 }, wood: { pine: 8, oak: 8, ash: 14, yew: 22, heartwood: 16, bloodwood: 16, frostwood: 16 } }];
SF.rollTable = (tab, rng) => { const ks = Object.keys(tab), tot = ks.reduce((a, k) => a + tab[k], 0); let r = rng() * tot; for (const k of ks) { r -= tab[k]; if (r < 0) return k; } return ks[ks.length - 1]; };
SF.matGate = (m, use) => use === 'mine' ? SF.METAL[m].mine : use === 'smith' ? SF.METAL[m].smith : use === 'fell' ? SF.WOOD[m].fell : SF.WOOD[m].work;
SF.commonOf = skill => skill === 'mining' ? 'iron' : 'pine';
SF.gateFor = (skill, m) => skill === 'mining' ? SF.METAL[m].mine : SF.WOOD[m].fell;
/* which material a successful stroke yields: the node's specialty only at or above its gate, and then 50% */
SF.strokeMaterial = (skill, spec, sk, rng) => { const com = SF.commonOf(skill); if (!spec || spec === com || sk < SF.gateFor(skill, spec)) return com; return rng() < .5 ? spec : com; };
SF.STROKE_YIELD = { mining: 3, lumberjacking: 2 };
SF.stockLabel = (n, max) => n <= 0 ? 'Exhausted' : n >= max ? 'Fresh' : n > max / 3 ? 'Worked' : 'Nearly empty';

/* ---------------- craft resolution (crafting guide §4) ---------------- */
SF.workGate = (r, m) => { if (!m) return 0; if (r.prim === 'metal') return SF.METAL[m].smith; if (r.prim === 'wood') return SF.WOOD[m].work; return 0; };
SF.recipeLines = r => r.lines || Object.entries(r.inputs).map(([item, qty]) => ({ item, qty }));
SF.lineItem = (ln, m) => ln.form === 'ingot' ? { id: SF.ingotId(m), mat: null } : ln.form === 'ore' ? { id: SF.oreId(m), mat: null } : ln.match ? { id: ln.item, mat: m } : { id: ln.item, mat: null };
SF.recipeMat = (r, m) => r.prim ? (m || r.defMat) : (r.fixedMat || null);
SF.QUALITY_CATS = { weapon: 1, shield: 1, armor: 1 };
SF.craftTime = r => r.time || ({ weapon: 2, shield: 2, armor: 3 }[SF.ITEMS[r.out].cat] || SF.CRAFT_TIME);
/* plan: everything the preview shows, computed without touching the pack */
SF.craftPlan = (ch, pack, r, mat, sec) => {
  const sk = SF.sv(ch, r.skill), m = SF.recipeMat(r, mat), s2 = r.sec ? (sec || r.defSec) : null, gate = SF.workGate(r, m), effMin = Math.max(r.min, gate);
  const diff = r.diff !== undefined ? (!r.prim || m === r.defMat ? r.diff : Math.max(r.diff, Math.min(100, gate + 15))) : Math.min(100, effMin + 15);
  const chance = clamp(.10, .98, .55 + (sk - diff) / 80);
  const quality = !!SF.QUALITY_CATS[SF.ITEMS[r.out].cat];
  const exc = quality ? clamp(0, .45, (sk - effMin - 10) / 100 + (sk >= 100 ? .20 : 0)) : 0;
  const lines = SF.recipeLines(r).map(ln => { const li = SF.lineItem(ln, m, s2); const have = li.mat ? SF.countMat(pack, li.id, li.mat) : SF.count(pack, li.id); return { id: li.id, mat: li.mat, qty: ln.qty, have, fail: Math.ceil(ln.qty * SF.CRAFT_FAIL_LOSS) }; });
  const missing = lines.filter(l => l.have < l.qty);
  let reason = '';
  if (sk < effMin) reason = gate > r.min ? `${SF.matName(m)} needs ${SF.SKILL[r.skill].n} ${gate}` : `needs ${SF.SKILL[r.skill].n} ${r.min}`;
  else if (missing.length) reason = 'missing ' + missing.map(l => (l.qty - l.have) + ' ' + SF.ITEMS[l.id].n.toLowerCase()).join(', ');
  return { r, mat: m, sec: s2, sk, gate, effMin, diff, chance, quality, exc, perExc: chance * exc, lines, missing, ok: !reason, reason };
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
SF.craft = (ch, r, rng, cap, mat, sec) => { const p = SF.craftPlan(ch, ch.pack, r, mat, sec); const res = SF.craftAttempt(ch, ch.pack, p, rng, cap, {}); return res.ok ? res : { ok: false, reason: res.reason }; };

/* recipe registry: shape the existing smith rows, add fittings and coloured smelting, then rebuild the index */
Object.assign(SF.RECIPE.ironbar, { cat: 'Smelt', name: 'Smelt iron bar' });
Object.assign(SF.RECIPE.ironshard, { cat: 'Fittings', name: 'Cut iron shards', fixedMat: 'iron' });
for (const [id, n, nm] of [['dagger', 1, 'Dagger'], ['sword', 3, 'Quay sword']]) { const r = SF.RECIPE[id]; Object.assign(r, { name: nm, prim: 'metal', defMat: 'iron', cat: 'Weapons', lines: [{ form: 'ingot', qty: n }, { item: 'strap', qty: 1 }] }); delete r.inputs; }
SF.RECIPES.push(
  { id: 'rivets', name: 'Mooring rivets', out: 'rivet', qty: 8, skill: 'blacksmithy', min: 0, station: 'anvil', tool: 'tongs', prim: 'metal', defMat: 'iron', cat: 'Fittings', lines: [{ form: 'ingot', qty: 1 }] },
  { id: 'nails', name: 'Nail strip', out: 'nail', qty: 12, skill: 'blacksmithy', min: 0, station: 'anvil', tool: 'tongs', prim: 'metal', defMat: 'iron', cat: 'Fittings', lines: [{ form: 'ingot', qty: 1 }] },
  { id: 'hinges', name: 'Hinge pair', out: 'hinge', qty: 2, skill: 'blacksmithy', min: 10, station: 'anvil', tool: 'tongs', prim: 'metal', defMat: 'iron', cat: 'Fittings', lines: [{ form: 'ingot', qty: 1 }, { item: 'rivet', qty: 4, match: true }] });
for (const M of SF.METALS.slice(1).map(a => SF.METAL[a[0]])) SF.RECIPES.push({ id: 'smelt_' + M.id, name: 'Smelt ' + M.n.toLowerCase(), out: SF.ingotId(M.id), qty: 1, skill: 'mining', min: M.mine, diff: M.mine, station: 'forge', fixedMat: M.id, cat: 'Smelt', inputs: { [SF.oreId(M.id)]: 3 } });
SF.reindexRecipes = () => { for (const k in SF.RECIPE) delete SF.RECIPE[k]; for (const r of SF.RECIPES) SF.RECIPE[r.id] = r; };
SF.reindexRecipes();

/* ---------------- gathering (§5 table) ---------------- */
SF.NODE_TIER_DIFF = [15, 45, 70, 85];
SF.NODE_TIER_MIN = [0, 30, 55, 80];
SF.GATHER_TIME = { lumberjacking: 2, mining: 2, forage: 1.4, carve: 1.4, fishing: 2.5 };   // forage and carve are activities, not skills (T2A had neither skill)
SF.GATHER_RANGE = { lumberjacking: 2, mining: 2, forage: 2, carve: 2, fishing: 8 };

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
SF.weaponOf = it => SF.WEAPONS[it && SF.ITEMS[it.id] && SF.ITEMS[it.id].wpn] || null;
SF.weaponSkillName = it => { const w = SF.weaponOf(it); return w ? SF.SKILL[w.skill].n : ''; };
SF.BARD = { prep: 1.25, cd: 8, shared: 2, range: 8, lullaby: 5, discord: .15, discordFor: 8, provoke: 8 };
SF.SEARCH = { wind: .8, cd: 5, radius: s => 4 + 4 * s / 100 };
SF.SHADOW_STEPS = s => 2 + Math.floor(s / 20);
SF.APPRAISE_TIME = .75;
SF.venomTier = s => s >= 80 ? 3 : s >= 55 ? 2 : s >= 30 ? 1 : 0;
SF.VENOM_CHARGES = 5;
// §9 condition and repair: each repair restores to max minus 3% of the original maximum; below 40% replace
SF.WEARABLE = id => ['weapon', 'shield', 'armor'].includes(SF.ITEMS[id].cat) && SF.ITEMS[id].trade;
SF.repairSkill = id => { const d = SF.ITEMS[id]; if (d.wpn === 'shortbow' || d.wpn === 'crossbow' || d.wpn === 'heavycrossbow') return 'bowcraft'; if (id === 'buckler') return 'carpentry'; if (d.armor === 'cloth' || d.armor === 'leather') return 'tailoring'; return 'blacksmithy'; };

if (typeof module !== 'undefined' && module.exports) module.exports = SF; else root.SF = SF;
})(typeof globalThis !== 'undefined' ? globalThis : this);

</script>
