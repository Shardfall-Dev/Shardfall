// Phases C and D: the per-skill rules in SF.SK. Run through tests/skills.test.js (it loads the build).
const T = require('./skills.test.js'); const { SF, SK, eq, near } = T;

/* Meditation (UOSA) */
near(SK.manaRegen(0, 0, 0, false), 1 / 7, 'passive floor: 1 mana / 7 s at 0 INT and 0 Meditation');
near(SK.manaRegen(100, 100, 0, false), 1, 'passive top: 1 mana / s at 100 INT, 100 Meditation, cloth');
near(SK.manaRegen(100, 100, .35, false), 1 / 7, 'full plate: back to 1 mana / 7 s');
near(SK.manaRegen(100, 100, 0, true), 2, 'active doubles, at most 2 mana / s');
near(SK.manaRegen(50, 50, 0, true), 2 * SK.manaRegen(50, 50, 0, false), 'active is double passive');
eq(SK.medWindow(20), [70, 100], 'at 20% mana the trance teaches from 70 to 100 (UOSA: 90 − skill … 120 − skill)');
eq(SK.medWindow(100 - 80), [70, 100], 'an 80 meditator gains best around 20% mana');
/* Stealth */
eq([SK.stealthWindow(0), SK.stealthWindow(14)], [[-20, 80], [8, 108]], 'cloth teaches to 80; more armor carries it on (RunUO −20 + 2 AR … 80 + 2 AR)');
eq(SK.stealthWindow(10)[1] >= 100, true, '10 AR or more keeps teaching to 100');
eq([SK.stealthSteps(0), SK.stealthSteps(55), SK.stealthSteps(100)], [1, 5, 10], 'one step per 10 Stealth');
eq(SK.STEALTH.needHiding, 80, 'Stealth needs 80 Hiding');
/* Detecting Hidden, Tracking */
eq([SK.detectRadius(0), SK.detectRadius(100)], [1, 11], 'detect radius grows with skill');
eq(SK.detectBeats(80, 44, () => 0), true, 'a skilled searcher beats a middling hider');
eq([SK.trackRange(0), SK.trackRange(100)], [25, 50], 'tracking range 10 + skill/10 classic tiles');
/* Animal Taming */
eq([SK.TAME_MIN.boar, SK.TAME_MIN.dire_wolf], [35, 83.1], 'UOSA minimums where creatures match (boar 35, dire wolf 83.1)');
eq(SK.tameWindow(83.1)[1] > 100, true, 'dire wolves teach Animal Taming to 100');
eq(SK.controlChance(0, 0, 45), 1, '45 and under obey anyone');
near(SK.controlChance(83.1, 83.1, 83.1, 10), .70, 'at par: 70%');
eq(SK.controlChance(100, 100, 83.1, 10) > .9 && SK.controlChance(60, 40, 83.1, 10) <= .2, true, '80% Taming + 20% Lore decides obedience');
near(SK.controlChance(83.1, 83.1, 83.1, 6), .66, 'a hungry pet obeys less');
/* Veterinary */
eq([SK.vetCureChance(59.9, 100), SK.vetCureChance(60, 60)], [0, .8], 'pets are cured from 60 / 60');
/* Bard */
eq(SK.bardWindow(40), [15, 65], 'a song teaches ±25 around the creature\'s difficulty');
eq(SK.BARD.musicWin, [0, 120], 'Musicianship is checked across 0–120');
/* Stealing, Poisoning, Lockpicking, Remove Trap */
eq([SK.stealWindow(1), SK.stealWindow(9.5)], [[-12.5, 37.5], [77.5, 127.5]], 'heavier things train stealing higher (RunUO weight ×10 ± 22.5 / 27.5)');
near(SK.caughtChance(100), 1 / 3, 'a master thief is still noticed a third of the time');
eq([1, 2, 3, 4].map(l => SK.POISON_WIN[l]), [[0, 60], [30, 70], [50, 90], [80, 120]], 'poison strengths set the window');
eq([1, 2, 3, 4].map(SK.poisonCharges), [18, 16, 14, 12], 'weapon charges by strength');
eq([SK.lockWindow(80), SK.trapWindow(70)], [[70, 120], [70, 100]], 'lock and trap windows');
eq(SK.REQUIRES.removetrap, [['lockpicking', 50], ['detectinghidden', 50]], 'Remove Trap needs 50 / 50');
/* Magic */
eq([SK.resistMaxFor(1), SK.resistMaxFor(4), SK.resistMaxFor(6), SK.resistMaxFor(7), SK.resistMaxFor(8)], [35, 65, 85, 120, 130], 'resist teaches only below the ceiling of the spell\'s circle');
eq(SF.POISON[4], 6, 'deadly poison ticks hardest');

/* Phase D: every one of the 49 skills has a road from 0 to 100.0 in this build */
const R = SK.routes();
eq(Object.keys(SF.SKILL).filter(k => !R[k]), [], 'every skill has training uses listed');
const taught = new Set(Object.values(SK.TRAINERS).flat());
for (const k of Object.keys(SF.SKILL)) { const gap = SK.roadTo100(k, taught.has(k) ? SK.TRAIN_CAP : 0); eq(gap, null, `${SF.SKILL[k].n}: some use teaches at every value from the trainer's 30.0 to 99.9${gap !== null ? ' (gap at ' + gap / 10 + ')' : ''}`); }
// and the roads are walkable: from 0.0 (trainer to 30.0 where one teaches), always using the highest window that still teaches
{ const rng = T.mulberry(99); const res = {};
  for (const k of Object.keys(SF.SKILL)) { const c = { str: 50, dex: 50, int: 50, skills: SF.newSkills() }; c.skills[k].v = 300; let uses = 0;
    while (c.skills[k].v < 1000 && uses < 400000) { const v = SK.value(c, k), w = R[k].filter(([a, b]) => v >= a && v < b).sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]) || y[0] - x[0])[0]; if (!w) break; SK.check(c, k, w[0], w[1], { rng }); uses++; }
    res[k] = [c.skills[k].v, uses]; }
  const stuck = Object.entries(res).filter(([, [v]]) => v < 1000); eq(stuck, [], 'simulated training reaches 100.0 in every skill');
  const most = Object.entries(res).sort((a, b) => b[1][1] - a[1][1]).slice(0, 3).map(([k, [, u]]) => k + ' ' + u);
  console.log('     slowest 30 → 100 (uses):', most.join(', ')); }
/* the ten added skills are live */
eq(['armslore', 'begging', 'camping', 'cartography', 'forensicevaluation', 'herding', 'inscription', 'snooping', 'spiritspeak', 'tasteidentification'].filter(k => SF.SKILL[k].state !== 'live'), [], 'the ten added skills are usable (live)');
eq(SF.RECIPES.filter(r => r.skill === 'inscription').length, 64, 'Inscription can write every one of the 64 spells');
eq([SK.TMAP_MIN[1], SK.TMAP_MIN[5], SK.tmapWindow(5)], [-3, 70, [70, 130]], 'treasure map levels (RunUO minimums) keep Cartography teaching to 100');
eq([SK.magicDmg({ magic: { k: 'dmg', l: 5 } }), SK.magicAcc({ magic: { k: 'acc', l: 3 } }), SK.magicDef({ magic: { k: 'def', l: 2 } })], [9, 15, 2], 'magic properties: vanquishing +9, accuracy +15, defense +2');
eq(SF.rawDamage({ roll: 10, bonus: 9, scale: 1 }, () => 0).value, 19, 'a magic damage level adds to the roll');
