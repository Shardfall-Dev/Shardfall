// usage: node tests/combat.test.js Shardfall_v0.18.html — deterministic checks of the T2A combat and First Aid rules (issue #3), no browser.
// World behaviour (real entry points, archery, ally, reloads) is covered by tests/combat-smoke/run.py.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.18.html', 'utf8');
const src = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(t => t.includes('SF.METALS'));
const m = { exports: {} }; new Function('module', 'globalThis', src)(m, {}); const SF = m.exports;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };
const near = (a, b, msg, e) => eq(Math.abs(a - b) < (e || 1e-9), true, `${msg} (${a} ≈ ${b})`);
const seq = arr => { let i = 0; return () => arr[i++ % arr.length]; };
const lo = () => 0, hi = () => .999999;

// ---- hit chance: weapon skills only
near(SF.hitChance(50, 50), .5, 'equal skills hit 50%'); near(SF.hitChance(100, 100), .5, '100 vs 100 hits 50%');
near(SF.hitChance(100, 50), .75, '100 vs 50 hits 75%'); near(SF.hitChance(50, 100), 1 / 3, '50 vs 100 hits one third');
eq([SF.hitChance(100, 0), SF.hitChance(0, 100)], [1, 50 / 300], 'clamped to 1; 0 vs 100 is 16.7%');
eq(SF.hitChance.length, 2, 'hit chance takes attack and defence skill only (no Tactics, Anatomy or armor)');
const dmgA0 = SF.rawDamage({ roll: 20, tactics: 100, anatomy: 0, str: 100 }, lo).value, dmgA100 = SF.rawDamage({ roll: 20, tactics: 100, anatomy: 100, str: 100 }, lo).value;
eq([dmgA0 !== dmgA100, SF.hitChance(80, 60) === SF.hitChance(80, 60)], [true, true], 'raising Anatomy changes damage, the hit chance stays fixed');
// statistical check of the roll against the formula, seeded LCG
{ let x = 7; const rng = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648; let h = 0; const N = 200000; for (let i = 0; i < N; i++) if (rng() < SF.hitChance(100, 50)) h++; near(h / N, .75, '200k seeded swings at 100 vs 50 land 75%', .005); }

// ---- damage: dice, scale, stages
near(SF.rawDamage({ roll: 20, tactics: 100, anatomy: 100, str: 100 }, lo).value, 38, 'base 20 at Tactics/Anatomy/STR 100 → 38 before mitigation');
near(SF.rawDamage({ roll: 20, tactics: 50, anatomy: 0, str: 0 }, lo).value, 20, 'base 20 at Tactics 50, no Anatomy/STR → 20');
near(SF.rawDamage({ roll: 20, tactics: 0 }, lo).value, 10, 'Tactics 0 deals 50%');
near(SF.rawDamage({ roll: 20, tactics: 50, quality: 'exceptional' }, lo).value, 24, 'exceptional adds 4 to the roll');
near(SF.rawDamage({ roll: 20, tactics: 50, quality: 'low' }, lo).value, 16, 'below average takes 4');
near(SF.rawDamage({ roll: 20, tactics: 50, cond: 50, maxc: 100 }, lo).value, 15, 'half condition deals 75%');
eq([SF.rollDice([2, 15, 3], lo), SF.rollDice([2, 15, 3], hi), SF.rollDice([5, 10, 6], lo), SF.rollDice([5, 10, 6], hi)], [5, 33, 11, 56], 'longsword 5–33, heavy crossbow 11–56');
{ // 2d15+3 keeps its triangular distribution: enumerate every pair of die faces
  const c = {}; for (let a = 0; a < 15; a++) for (let b = 0; b < 15; b++) { const v = SF.rollDice([2, 15, 3], seq([(a + .5) / 15, (b + .5) / 15])); c[v] = (c[v] || 0) + 1; }
  eq([c[5], c[18], c[19], c[33], Object.keys(c).length], [1, 14, 15, 1, 29], '2d15+3: one way to 5 or 33, fifteen ways to the peak 19, 29 totals'); }
const ANCH = { sword: [[2, 15, 3], 35], battleaxe: [[2, 17, 4], 30], mace: [[6, 5, 2], 30], dagger: [[3, 5, 0], 55], shortbow: [[4, 9, 5], 20], crossbow: [[5, 8, 3], 18], heavycrossbow: [[5, 10, 6], 10], unarmed: [[1, 8, 0], 50] };
eq(Object.keys(ANCH).map(k => [SF.WEAPONS[k].dice, SF.WEAPONS[k].speed]), Object.values(ANCH), 'anchor profiles: longsword, battle axe, mace, dagger, bow, crossbow, heavy crossbow, fists');
eq(Object.fromEntries(['sword', 'glaive', 'battleaxe', 'hatchet', 'knife', 'pickaxe', 'hammer', 'mace', 'waraxe', 'dagger', 'kryss', 'spear', 'shortbow', 'crossbow', 'heavycrossbow'].map(id => [id, SF.weaponOf({ id }).skill])),
  { sword: 'swordsmanship', glaive: 'swordsmanship', battleaxe: 'swordsmanship', hatchet: 'swordsmanship', knife: 'swordsmanship', pickaxe: 'swordsmanship', hammer: 'macefighting', mace: 'macefighting', waraxe: 'macefighting', dagger: 'fencing', kryss: 'fencing', spear: 'fencing', shortbow: 'archery', crossbow: 'archery', heavycrossbow: 'archery' }, 'families by item ID (glaive = halberd; war axe is Mace Fighting)');
eq([SF.ITEMS.hatchet.tool, SF.ITEMS.hatchet.slot, SF.ITEMS.knife.tool, SF.ITEMS.pickaxe.tool], ['lumberjacking', 'weapon', 'carve', 'mining'], 'hatchet, skinning knife and pickaxe stay work tools and can be wielded');
eq([SF.WEAPONS.shortbow.ammo, SF.WEAPONS.crossbow.ammo, SF.WEAPONS.heavycrossbow.ammo], ['arrow', 'bolt', 'bolt'], 'bows use arrows, crossbows bolts');
eq([SF.WEAPONS.glaive.two, SF.WEAPONS.sword.two, SF.WEAPONS.glaive.str, SF.WEAPONS.heavycrossbow.str], [true, undefined, 45, 40], 'handedness and STR requirements');
eq([SF.WEAPONS.hammer.mace, SF.WEAPONS.mace.mace, !!SF.WEAPONS.waraxe.mace], [true, true, false], 'bashing weapons drain stamina and wear armor; the war axe is an axe');
eq(SF.weaponSkillName({ id: 'kryss' }), 'Fencing', 'item card names the skill');
// mitigation: parry → armor → halve → round, each once
let r = SF.mitigate(30, { parry: 100, shieldAR: 7, armorAR: 40, player: true }, seq([.4, 0, 0]));
eq([r.parried, r.shield, r.armor, r.halved, r.final], [true, 4, 20, true, 3], 'parry (50% at 100) absorbs 4–7, plate 20–40, then half: 30 → 26 → 6 → 3');
r = SF.mitigate(30, { parry: 100, shieldAR: 7, armorAR: 40, player: false }, seq([.6, .999]));
eq([r.parried, r.shield, r.armor, r.final], [false, 0, 30, 0], 'missed parry; armor can absorb all of a blow (creature recipient, no halving)');
r = SF.mitigate(38, { armorAR: 13, player: true, mace: true }, seq([.999]));
eq([r.armor, r.armorWear, r.final], [13, 7, 13], 'mace: armor wears by half what it absorbed (13 → 7); 38 − 13 = 25, halved 12.5 → 13');
r = SF.mitigate(38, { armorAR: 0, player: true }, lo); eq(r.final, 19, '38 to an unarmored player → 19');
eq(SF.mitigate(38, { armorAR: 0, player: false }, lo).final, 38, 'creature recipients are not halved');
eq([SF.parryChance(100), SF.parryChance(50), SF.parryChance(0)], [.5, .25, 0], 'parry chance = Parrying / 2 %');
eq([SF.absorbRoll(40, lo), SF.absorbRoll(40, hi), SF.absorbRoll(7, lo), SF.absorbRoll(7, hi)], [20, 40, 4, 7], 'armor absorbs 50–100% of its rating');

// ---- swing timing
eq([SF.swingDelay(100, 30), SF.swingDelay(100, 20), SF.swingDelay(100, 10)], [2.5, 3.75, 7.5], 'stamina 100: mace 2.50 s, bow 3.75 s, heavy crossbow 7.50 s');
eq([SF.swingDelay(100, 25), SF.swingDelay(100, 55), SF.swingDelay(100, 58), SF.swingDelay(100, 50), SF.swingDelay(25, 10), SF.swingDelay(0, 10)], [3, 1.25, 1.25, 1.5, 10, 10], 'halberd 3.00, dagger 1.25 (floor 1.36), katana-speed floor, fists 1.50, 10 s ceiling');
eq(SF.swingDelay(34, 35), 3.0, 'quarter-second flooring: 15000/(134×35) = 3.198 → 3.00');
let st = SF.newSwing(); const S = SF.WEAPONS.sword, F = SF.WEAPONS.unarmed, G = SF.WEAPONS.glaive;
eq(SF.swingTick(st, 0, 100, S), true, 'a fresh fighter is ready'); SF.swingSpend(st, 0);
eq([SF.swingTick(st, 1.9, 100, S), SF.swingTick(st, 2.0, 100, S)], [false, true], 'longsword at stamina 100: ready at 2.00 s (2.14 floored to the tick)');
eq(SF.swingTick(st, 2.3, 10, S), true, 'a ready swing stays ready when stamina falls');
SF.swingSpend(st, 10); SF.swingEquip(st, 11, 100, G); eq([SF.swingTick(st, 13.9, 100, G), SF.swingTick(st, 14, 100, G)], [false, true], 'equipping during recovery restarts the timer for the new weapon (no free swing)');
SF.swingSpend(st, 20); SF.swingEquip(st, 20.25, 100, F); eq(SF.swingTick(st, 21.75, 100, F), true, 'swap to fists after a glaive blow: the 1.5 s wrestling timer completes');
eq(SF.swingEquip(st, 21.8, 100, G), true, 'a ready swing carries over when the glaive goes back on (weapon cycling)');
SF.swingSpend(st, 30); eq([SF.swingEquip(st, 30.5, 100, F), SF.swingEquip(st, 30.6, 100, S), SF.swingTick(st, 32.5, 100, S), SF.swingTick(st, 32.6, 100, S)], [false, false, false, true], 'repeated equips never grant a swing: each restarts the timer');
SF.swingSpend(st, 40); near(SF.swingLeft(st, 41.4, 100, S), .6, 'time left is visible');

// ---- First Aid
eq(SF.healRange(100, 100), [43, 80], 'GM Healing/Anatomy: 43–80');
eq(SF.healRange(0, 0), [3, 10], 'no skill: 3–10'); eq(SF.healRange(60, 60), [27, 52], '60/60: 27–52');
let fa = SF.firstAidResolve({ kind: 'heal', heal: 100, ana: 100, slips: 0, missing: 200 }, seq([0, 0])); eq([fa.success, fa.amount], [true, 43], 'undisturbed GM bandage, lowest roll 43');
fa = SF.firstAidResolve({ kind: 'heal', heal: 100, ana: 100, slips: 0, missing: 200 }, seq([0, .999999])); eq(fa.amount, 80, 'highest roll 80');
{ const seen = new Set(); for (let i = 0; i < 38; i++) seen.add(SF.firstAidResolve({ kind: 'heal', heal: 100, ana: 100, slips: 0, missing: 200 }, seq([0, (i + .5) / 38])).amount); eq([seen.size, Math.min(...seen), Math.max(...seen)], [38, 43, 80], 'every integer 43–80 can be rolled'); }
fa = SF.firstAidResolve({ kind: 'heal', heal: 100, ana: 100, slips: 2, missing: 200 }, seq([0, 0])); eq([fa.amount, fa.note], [35, 'slipped'], 'two slips: −4 HP each (43 → 35)');
fa = SF.firstAidResolve({ kind: 'heal', heal: 100, ana: 100, slips: 0, missing: 12 }, seq([0, .9])); eq(fa.amount, 12, 'capped at missing HP');
fa = SF.firstAidResolve({ kind: 'heal', heal: 100, ana: 100, slips: 0, missing: 39.335 }, seq([0, .9])); eq(fa.amount, 40, 'a whole number even when regeneration left a fraction missing');
fa = SF.firstAidResolve({ kind: 'heal', heal: 0, ana: 0, slips: 5, missing: 50 }, seq([0, 0])); eq([fa.success], [false], 'a heavily slipped novice bandage can fail outright (chance ≤ 0)');
eq([SF.healChance(90, 0), SF.healChance(50, 0), SF.healChance(50, 3)], [1, .6, .54], 'heal success (Healing + 10)%, −2% per slip');
eq([SF.cureChance(60, 60), SF.cureChance(59.9, 100), SF.cureChance(100, 59.9), SF.cureChance(100, 100)], [.8, 0, 0, 1], 'cure: 80% at 60/60; nothing if either skill is 59.9');
fa = SF.firstAidResolve({ kind: 'cure', heal: 59.9, ana: 90, slips: 0 }, lo); eq([fa.success, fa.note], [false, 'unskilled'], 'cure below 60 Healing reports the threshold');
fa = SF.firstAidResolve({ kind: 'cure', heal: 60, ana: 60, slips: 0 }, seq([.79])); eq(fa.success, true, 'cure at 60/60 succeeds under the 80% line');
fa = SF.firstAidResolve({ kind: 'cure', heal: 60, ana: 60, slips: 0 }, seq([.80])); eq(fa.success, false, 'and fails above it');
eq([SF.resChance(80, 80), SF.resChance(79.9, 100), SF.resChance(100, 79.9), SF.resChance(100, 100)], [.25, 0, 0, .65], 'resurrection: 25% at 80/80; nothing if either skill is 79.9');
fa = SF.firstAidResolve({ kind: 'res', heal: 80, ana: 80, slips: 0 }, seq([.24])); eq(fa.success, true, 'res at 80/80 succeeds under 25%');
eq([SF.firstAidTime('heal', true), SF.firstAidTime('heal', false), SF.firstAidTime('cure', true), SF.firstAidTime('cure', false), SF.firstAidTime('res', false)], [15, 5, 18, 6, 10], 'delays: wounds 15/5 s, poison 18/6 s, ghost 10 s');
const pat = (o) => Object.assign({ ghost: false, poisoned: false, hp: 50, max: 80, isPlayer: true }, o);
eq(SF.firstAidCheck(pat({ hp: 80 }), { self: true, bandages: 5 }).reason, 'You are not hurt.', 'full HP: refused before a bandage is spent');
eq(SF.firstAidCheck(pat({ hp: 80 }), { self: false, dist: 1, bandages: 5 }).ok, false, 'a healthy ally cannot be farmed for gains');
eq(SF.firstAidCheck(pat({ ghost: true, hp: 0 }), { self: true, bandages: 5 }).ok, false, 'no self-resurrection');
eq(SF.firstAidCheck(pat({ ghost: true, hp: 0 }), { self: false, dist: 1.5, bandages: 5 }), { ok: true, kind: 'res', time: 10 }, 'a player ghost in reach: resurrection, 10 s');
eq(SF.firstAidCheck(pat({ poisoned: true, hp: 80 }), { self: false, dist: 1, bandages: 5 }), { ok: true, kind: 'cure', time: 6 }, 'poisoned at full HP: cure only, 6 s');
eq(SF.firstAidCheck(pat({}), { self: false, dist: 2.5, bandages: 5 }).ok, false, 'out of reach at the start');
eq(SF.firstAidCheck(pat({}), { self: true, bandages: 0 }).reason, 'You have no bandages.', 'no bandage');
eq(SF.firstAidCheck(pat({}), { self: true, bandages: 3, busy: true }).ok, false, 'one application at a time');
eq(SF.firstAidCheck({ pet: true }, { self: false, dist: 1, bandages: 3 }).reason, 'Pets are treated with Veterinary (Treat pet).', 'pets go through Veterinary');
eq(SF.anatomyRead(100, { str: 63, dex: 41, stam: 30, maxStam: 41 }).stam, [30, 41], 'active Anatomy shows stamina at 80+');
eq(SF.anatomyRead(79.9, { str: 63, dex: 41, stam: 30, maxStam: 41 }).stam, null, 'not below 80');

// ---- save migration
const old = { skills: { blades: { v: 300, lock: 'raise' }, polearms: { v: 500, lock: 'hold' }, hammers: { v: 120, lock: 'raise' }, knives: { v: 0, lock: 'lower' }, brawling: { v: 50, lock: 'raise' }, shieldwork: { v: 200, lock: 'raise' }, medicine: { v: 333, lock: 'hold' }, tactics: { v: 400, lock: 'raise' }, mining: { v: 77, lock: 'raise' } },
  equip: { weapon: { id: 'glaive', qty: 1, quality: 'exceptional', cond: 90, maxc: 121 } }, gainLog: { 'polearms|mon:boar': [1, 2], 'blades|mon:rat': [3], 'mining|node:1,2': [4] }, lowerRank: ['knives', 'mining'] };
const tot0 = Object.values(old.skills).reduce((a, s) => a + s.v, 0);
const res = SF.migrateCombatSkills(old);
eq([old.skills.swordsmanship, old.skills.macefighting, old.skills.fencing, old.skills.wrestling, old.skills.parrying, old.skills.healing], [{ v: 500, lock: 'hold' }, { v: 120, lock: 'raise' }, { v: 0, lock: 'lower' }, { v: 50, lock: 'raise' }, { v: 200, lock: 'raise' }, { v: 333, lock: 'hold' }], 'renamed with values and locks; Polearms 50.0 beats Blades 30.0 on the glaive\'s Swordsmanship');
eq([old.skillPool, res.displaced, res.conserved, res.polearmsTo], [300, 300, true, 'swordsmanship'], 'the 30.0 displaced points go to the pool; nothing cloned or erased');
eq(['blades', 'polearms', 'hammers', 'knives', 'brawling', 'shieldwork', 'medicine'].filter(k => old.skills[k]), [], 'legacy keys are gone');
eq(Object.keys(old.skills).length, SF.SKILLS.length, 'every current skill exists');
eq([old.gainLog['swordsmanship|mon:boar'], old.gainLog['swordsmanship|mon:rat'], old.gainLog['mining|node:1,2'], old.lowerRank], [[1, 2], [3], [4], ['fencing', 'mining']], 'gain history and lower order follow the rename');
eq(old.equip.weapon, { id: 'glaive', qty: 1, quality: 'exceptional', cond: 90, maxc: 121 }, 'equipment and crafted quality untouched');
const snap = JSON.stringify(old); eq([SF.migrateCombatSkills(old).changed, JSON.stringify(old) === snap], [false, true], 'a second run is a no-op');
const o2 = { skills: { polearms: { v: 420, lock: 'raise' }, knives: { v: 100, lock: 'raise' } }, equip: {} }; SF.migrateCombatSkills(o2);
eq([o2.skills.swordsmanship.v, o2.skills.fencing.v, o2.skillPool], [420, 100, 0], 'no glaive equipped: Polearms defaults to Swordsmanship; no collision');
const o3 = { skills: SF.newSkills(), skillPool: 300 }; o3.skills.archery.v = 980; o3.skills.mining.v = 6900 - 980; o3.skills.tactics.v = 0;
eq([SF.assignPool(o3, 'archery', 100), SF.assignPool(o3, 'tactics', 100), o3.skillPool, SF.totalSkill(o3)], [20, 80, 200, 7000], 'placing pool points stops at 100.0 and at the 700.0 total');

console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
