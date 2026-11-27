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
eq([SK.stealthWindow(0), SK.stealthWindow(14)], [[35, 85], [49, 99]], 'cloth teaches to 85; 14 AR toward 100 (UOSA AR table)');
eq(SK.stealthWindow(16)[1] > 100, true, '16 AR keeps teaching at 99.9');
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
