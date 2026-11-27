// Phase B: skill checks and gains, stats, creation, trainers. Run through tests/skills.test.js (it loads the build).
const T = require('./skills.test.js'); const { SF, SK, eq, near, seq, mulberry } = T;
const ch = (sk, st) => { const c = Object.assign({ id: 'p1', name: 'Tess', str: 0, dex: 0, int: 0, skills: SF.newSkills(), pack: SF.newContainer('pack') }, st || {}); for (const k in sk || {}) c.skills[k].v = Math.round(sk[k] * 10); return c; };

/* windows */
eq([0, 30, 50, 80, 90, 99.9, 100].map(v => +SK.windowChance(v, 0, 100).toFixed(3)), [0, .3, .5, .8, .9, .999, 1], 'window [0,100] chance at 0/30/50/80/90/99.9/100');
eq([SK.windowChance(10, 20, 60), SK.windowChance(60, 20, 60)], [0, 1], 'below min impossible, at max certain');
near(SK.gainChance(0, .5, true), (1 + .25) / 2, 'gain chance at 0 real, 50% success');
near(SK.gainChance(999, .999, true), .01, 'gain chance never below 1%');
near(SK.gainChance(500, .5, false), (.5 + .1) / 2, 'a failure teaches a little less');

/* checks at 0/30/50/80/90/99.9/100: a [0,100] use is a challenge until 100.0 and teaches nothing at 100.0 */
for (const v of [0, 30, 50, 80, 90, 99.9]) { const c = ch({ hiding: v }); const r = SK.check(c, 'hiding', 0, 100, { rng: () => 0 }); eq([r.success, r.learn.gained, c.skills.hiding.v > Math.round(v * 10)], [v > 0, true, true], `hiding ${v}: an eligible use can teach`); }
{ const c = ch({ hiding: 100 }); const r = SK.check(c, 'hiding', 0, 100, { rng: () => 0 }); eq([r.success, r.learn.gained, c.skills.hiding.v], [true, false, 1000], 'at 100.0 nothing more to learn'); }
{ const c = ch({ hiding: 99.9 }); SK.check(c, 'hiding', 0, 100, { rng: () => 0 }); eq(c.skills.hiding.v, 1000, '99.9 → 100.0 and never past it'); }
{ const c = ch({ magery: 40 }); const r = SK.check(c, 'magery', ...SK.magCircleWindow(1), { rng: () => 0 }); eq(r.learn.reason, 'too easy to learn from', 'a first-circle spell stops teaching at 20.0'); }
{ const c = ch({ magery: 99.9 }); const w = SK.magCircleWindow(8); eq(w, [80, 120], 'eighth circle teaches 80 … 120'); const r = SK.check(c, 'magery', w[0], w[1], { rng: () => 0 }); eq(r.learn.gained, true, 'eighth circle still teaches at 99.9'); }
/* fast gains under 10.0: every eligible use teaches 0.1 – 0.4 */
{ const c = ch({}); const r = SK.learn(c, 'cooking', .5, false, { rng: seq([.99, .99]) }); eq([r.gained, r.amount], [true, 4], 'under 10.0 a use always teaches, up to 0.4'); }
/* no same-target limit and no recipe taper: 2000 uses on one target keep teaching */
{ const c = ch({ tactics: 50 }); const rng = mulberry(7); let gains = 0; for (let i = 0; i < 2000; i++) { const r = SK.check(c, 'tactics', 0, 100, { rng, target: 'mon:1', now: i }); if (r.learn.gained) gains++; }
  eq(gains > 100 && c.skills.tactics.v > 600, true, `repeating one target keeps teaching (${gains} gains, ${c.skills.tactics.v / 10})`); }
eq(SK.POLICY.antiMacro, false, 'the anti-automation hook is off');
/* locks */
{ const c = ch({ tactics: 50 }); c.skills.tactics.lock = 'hold'; eq(SK.learn(c, 'tactics', .5, true, { rng: () => 0 }).reason, 'skill is on Hold', 'hold blocks'); c.skills.tactics.lock = 'lower'; eq(SK.learn(c, 'tactics', .5, true, { rng: () => 0 }).reason, 'skill is set to Lower', 'lower blocks'); }
/* cap transfer: at 700.0 a gain takes from a skill set to lower, and never adds without one */
{ const c = ch({ tactics: 100, swordsmanship: 100, anatomy: 100, healing: 100, parrying: 100, magery: 100, mining: 99.9 }); c.skills.mining.v = 1000; c.skills.cooking.v = 0; c.skills.tactics.v = 990;
  eq(SF.totalSkill(c), 6990, 'set up at 699.0');
  c.skills.alchemy.v = 10; eq(SF.totalSkill(c), 7000, 'at 700.0');
  let r = SK.learn(c, 'alchemy', .5, true, { rng: () => 0 }); eq([r.gained, r.reason, SF.totalSkill(c)], [false, 'skill cap 700 reached: set a skill to Lower', 7000], 'at the cap with nothing lowered: no gain');
  c.skills.mining.lock = 'lower'; r = SK.learn(c, 'alchemy', .5, true, { rng: () => 0 }); eq([r.gained, r.lowered, SF.totalSkill(c) <= 7000, c.skills.mining.v < 1000], [true, 'mining', true, true], 'a lowered skill pays for the gain, total stays 700.0'); }
/* stats: gain on skill gain, 100 per stat, 225 total with atrophy, never below 10 */
{ const c = ch({ blacksmithy: 50 }, { str: 50, dex: 50, int: 50 }); const r = SK.learn(c, 'blacksmithy', .5, true, { rng: () => 0 }); eq([r.stat && r.stat.stat, c.str], ['str', 51], 'Blacksmithy raises Strength'); }
{ const c = ch({ magery: 50 }, { str: 100, dex: 25, int: 100 }); const r = SK.learn(c, 'magery', .5, true, { rng: () => 0 }); eq([c.int, r.stat], [100, null], 'a stat at 100 stays'); }
{ const c = ch({ magery: 50 }, { str: 100, dex: 50, int: 75 }); const r = SK.learn(c, 'magery', .5, true, { rng: () => 0 }); eq([c.int, c.str + c.dex + c.int, r.stat.lowered], [76, 225, 'str'], 'at 225 a gain lowers another stat'); }
{ const c = ch({ magery: 50 }, { str: 10, dex: 10, int: 205 }); eq(SK.raiseStat(c, 'int', () => 0), null, 'nothing to lower below 10: no gain'); }
{ const c = ch({ tactics: 100 }, { str: 50 }); const r = SK.learn(c, 'tactics', .5, true, { rng: () => 0 }); eq([r.gained, c.str], [false, 51], 'stats still rise from a skill at 100.0'); }
{ const c = ch({ begging: 50 }, { str: 50, dex: 50, int: 50 }); SK.learn(c, 'begging', .5, true, { rng: () => 0 }); eq([c.str, c.dex, c.int], [50, 50, 50], 'Begging moves no stat'); }
{ const c = ch({ tactics: 40 }, { str: 50 }); const rng = mulberry(3); for (let i = 0; i < 3000; i++) SK.check(c, 'tactics', 0, 100, { rng }); eq(c.str > 60 && c.str <= 100, true, `training Tactics builds Strength (${c.str})`); }
/* real and displayed */
{ const c = ch({ magery: 50 }, { int: 100 }); eq([SK.base(c, 'magery'), SK.value(c, 'magery')], [50, 52.5], 'displayed Magery 52.5 over real 50.0 at INT 100'); c.skills.magery.v = 1000; eq(SK.value(c, 'magery'), 100, 'no lift at 100.0'); eq(SK.value(ch({ tactics: 50 }, { str: 100 }), 'tactics'), 50, 'Tactics takes no stat lift'); }
eq(SF.totalSkill(ch({ magery: 50 }, { int: 100 })), 500, 'the 700 total counts real values only');
/* creation */
eq(SK.validateCreation({ str: 60, dex: 10, int: 10, skills: { magery: 50, meditation: 50 } }), [], '60/10/10 with two 50s is valid');
eq(SK.validateCreation({ str: 55, dex: 45, int: 50, skills: {} }).length > 0, true, 'the old 150-point spread is refused');
eq(SK.validateCreation({ str: 61, dex: 10, int: 9, skills: {} }).length, 1, 'stats stay within 10–60');
eq(SK.validateCreation({ str: 40, dex: 20, int: 20, skills: { magery: 30, tactics: 30, wrestling: 20, healing: 20 } }), ['Choose at most 3 starting skills.'], 'at most three skills');
eq(SK.validateCreation({ str: 40, dex: 20, int: 20, skills: { stealth: 50 } }), ['Stealth and Remove Trap cannot be starting skills.'], 'no Stealth at creation');
/* trainers */
{ const c = ch({ magery: 12 }); let q = SK.trainQuote(c, 'magery', 1000, false); eq([q.ok, q.tenths, q.price, q.to], [true, 180, 180, 300], 'a mage teaches 12.0 → 30.0 for 180 gold');
  q = SK.trainQuote(c, 'magery', 50, false); eq([q.tenths, q.to], [50, 170], 'fifty gold buys five points'); SK.train(c, 'magery', 50, false); eq(c.skills.magery.v, 170, 'lesson applied');
  c.skills.magery.v = 300; eq(SK.trainQuote(c, 'magery', 999, false).reason, 'You already know all I can teach.', 'no lessons past 30.0');
  eq(SK.trainQuote(ch({}), 'stealth', 999, false).ok, false, 'Stealth lessons need 80 Hiding first'); eq(SK.trainQuote(ch({ hiding: 80 }), 'stealth', 999, false).ok, true, 'and then work');
  const h = ch({ tactics: 0 }); h.skills.tactics.lock = 'hold'; eq(SK.trainQuote(h, 'tactics', 999, false).ok, false, 'a held skill cannot be taught'); }
eq(Object.values(SK.TRAINERS).flat().filter(k => !SF.SKILL[k]), [], 'every trainer teaches real skills');
eq(Object.keys(SF.SKILL).filter(k => !Object.values(SK.TRAINERS).some(l => l.includes(k))), [], 'every one of the 49 skills has a teacher somewhere');
/* crafting: every trade skill has a recipe (with its material choices) that still teaches at 99.9 */
const MATS = r => r.prim === 'metal' ? SF.METALS.map(m => m[0]) : r.prim === 'wood' ? SF.WOODS.map(w => w[0]) : r.prim === 'hide' ? (SF.HIDES || []).map(h => h[0] || h.id).concat([undefined]) : [undefined];
const topWin = {}; for (const r of SF.RECIPES) for (const m of MATS(r)) { let p; try { p = SF.craftPlan(ch({ [r.skill]: 99.9 }), SF.newContainer('pack'), r, m); } catch (e) { continue; } const w = SK.CRAFT_WINDOW(p.diff); topWin[r.skill] = Math.max(topWin[r.skill] || 0, w[1]); }
for (const k of ['alchemy', 'blacksmithy', 'bowcraft', 'carpentry', 'cooking', 'tailoring', 'tinkering']) eq((topWin[k] || 0) > 100, true, `${SF.SKILL[k].n}: a recipe still teaches at 99.9 (window top ${topWin[k]})`);
