// usage: node tests/stats.test.js Shardfall_v0.30.html — the attribute rules (SF.STATS, src/stats.js) with no browser
// Covers docs/stats/STAT_SYSTEM_REWORK_v1.0.md "Acceptance": creation, caps, locks, transfer, eligibility, determinism, persistence,
// migration, pools, Strength policy, skill mapping, and a seeded gains-per-hour measurement (printed, tuning not history).
const fs = require('fs'); const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.30.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const g = {}; const m = { exports: {} };
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.METALS')))(m, g); g.SF = m.exports;
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.STATS = ST')))({}, g);
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.MAGERY = MG')))({}, g);
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.EQ = EQ')))({}, g);
const SF = g.SF, ST = SF.STATS, EQ = SF.EQ, MG = SF.MAGERY;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };
const near = (a, b, msg, tol) => eq(Math.abs(a - b) < (tol || 1e-9), true, msg + ` (${a} ≈ ${b})`);
const seq = arr => { let i = 0; return () => arr[i++ % arr.length]; };
const mk = (b, o) => { const c = Object.assign({ id: 'p1', name: 'Tess', skills: SF.newSkills(), pack: SF.newContainer('pack'), bank: SF.newContainer('bank'), equip: {} }, o || {}); for (const s of EQ.SLOT_IDS) c.equip[s] = null; ST.init(c, b || { str: 30, dex: 30, int: 20 }, 7); Object.assign(c, c.base); c.hp = SF.maxHp(c); c.stam = SF.maxStam(c); c.mana = SF.maxMana(c); return c; };
let AID = 0; const act = () => 'a' + (++AID);
const GAIN = () => 0;                          // rng that always picks the first candidate and always succeeds
const roll = (c, k, o) => ST.tryStatGain(c, k, Object.assign({ action: act(), now: 1000 + AID * 100, rng: GAIN }, o || {}));

// ---------- creation ----------
eq(SF.validateStats({ str: 35, dex: 20, int: 25 }), [], '80 points, 10–60 each: valid');
eq(SF.validateStats({ str: 60, dex: 10, int: 10 }), [], '60/10/10 (the classic warrior start) is valid');
eq(SF.validateStats({ str: 35, dex: 20, int: 24 }).length, 1, '79 points rejected');
eq(SF.validateStats({ str: 61, dex: 10, int: 9 }), ['Each attribute must be between 10 and 60.'], '61 and 9 rejected (range), total ok');
eq(SF.validateStats({ str: 62, dex: 9, int: 9 }).length, 1, 'outside 10–60 rejected');
eq(SF.validateStats({ str: 35.5, dex: 20, int: 24.5 }), ['Attributes must be whole numbers.'], 'integers only');
eq(SF.validateStats({ str: '35', dex: 20, int: 25 }), ['Attributes must be whole numbers.'], 'strings rejected');
eq(SF.validateStats({ str: 55, dex: 45, int: 50 }).length > 0, true, 'old 150-point creation rejected');
eq(ST.validateCreation === undefined ? null : ST.validateCreation({ str: 30, dex: 40, int: 10 }), [], 'SF.STATS.validateCreation is the same rule');
eq(SF.validateCreation({ str: 30, dex: 40, int: 10, skills: { fencing: 50, tactics: 30, healing: 20 } }), [], 'full creation check (skills unchanged)');
// presets come from the game itself
const prof = html.match(/const PROFILES = \{([\s\S]*?)\n\};?|const PROFILES = \{([\s\S]*?)\} \};/); const presets = [...(prof[0]).matchAll(/'([^']+)': \{ s: \[(\d+), (\d+), (\d+)\]/g)].map(x => [x[1], +x[2], +x[3], +x[4]]);
eq(presets.length, 6, 'six creation presets found');
eq(presets.map(p => p.slice(1)), [[35, 20, 25], [30, 40, 10], [20, 10, 50], [25, 45, 10], [35, 35, 10], [45, 25, 10]], 'presets are the spec examples');
for (const p of presets) eq(SF.validateStats({ str: p[1], dex: p[2], int: p[3] }), [], `preset ${p[0]} is a legal 80-point start`);
eq([ST.createStep([35, 20, 25], 0, 1), ST.createStep([35, 20, 24], 0, 1), ST.createStep([60, 10, 10], 0, 1), ST.createStep([60, 10, 9], 1, -1), ST.createStep([35, 20, 24], 2, 5)], [null, 36, null, null, null], 'creation +/-: never past 80, 60 or below 10');
eq(ST.createStep([30, 20, 25], 2, 5), 30, '+5 is a secondary control within the rules');

// ---------- derived values ----------
let c = mk({ str: 35, dex: 20, int: 25 });
eq([SF.maxHp(c), SF.maxStam(c), SF.maxMana(c)], [35, 20, 25], 'T2A: Health = STR, Stamina = DEX, Mana = INT');
c.eqDex = -5; eq(SF.maxStam(c), 15, 'stamina after the armor Dexterity penalty (applied once)');
eq([SF.maxHp({ str: 0 }), SF.maxMana({ int: -3 }), SF.maxStam({ dex: 2, eqDex: -9 })], [1, 1, 1], 'each pool maximum floors at 1');
eq(SF.carryCap({ str: 35 }), 40 + 3.5 * 35, 'carrying capacity keeps the Shardfall tuning 40 + 3.5 × STR');
eq(SF.damageScale({ tactics: 50, anatomy: 50, str: 50 }), .5 + .5 + .1 + .1, 'weapon damage scale unchanged');

// ---------- chance curve ----------
near(ST.chanceFor(10), .06, 'chance at stat 10 = 6 %'); near(ST.chanceFor(100), .015, 'chance at stat 100 = 1.5 %'); near(ST.chanceFor(55), .06 * (1 - .75 * .5), 'chance at 55');
eq([ST.challenge(50, 40), ST.challenge(50, 25), ST.challenge(50, 24), ST.challenge(100, 75), ST.challenge(100, 60), ST.challenge(30, undefined)], [1, 1, .25, 1, .25, 1], 'challenge factor: within 25 below the skill counts');

// ---------- gains, caps, locks ----------
c = mk({ str: 30, dex: 30, int: 20 }); c.skills.mining.v = 500;
let r = roll(c, 'mining', { diff: 50 }); eq([r.gained, r.stat, r.value, c.base.str, ST.total(c)], [true, 'str', 31, 31, 81], 'mining raises Strength by exactly one point');
eq([c.str, c.dex], [30, 30], 'the pure module never writes effective fields (the game recomputes them)');
r = roll(c, 'mining', { diff: 50, now: c.statState.last + 10 }); eq(r.reason, 'cooldown', 'global cooldown of 30 active seconds after a gain');
r = roll(c, 'mining', { diff: 50, now: c.statState.last + 30 }); eq(r.gained, true, 'next gain allowed after 30 s');
// per-stat 100
c = mk({ str: 100, dex: 50, int: 20 }); c.skills.mining.v = 500; r = roll(c, 'mining', { diff: 50 }); eq([r.gained, r.reason, c.base.str], [false, 'blocked: no attribute can rise', 100], 'STR at 100: mining (STR only) is blocked');
c.skills.swordsmanship.v = 500; r = roll(c, 'swordsmanship', { diff: 50 }); eq([r.stat, c.base.str, c.base.dex], ['dex', 100, 51], 'STR at 100: swordsmanship falls back to its secondary DEX');
// 225 with nothing lowered
c = mk({ str: 100, dex: 100, int: 25 }); c.skills.spellcraft.v = 500; r = roll(c, 'spellcraft', { diff: 50 }); eq([r.gained, ST.total(c)], [false, 225], 'at 225 with no stat set to Lower: no gain, nothing changes');
// atomic transfer
ST.setLock(c, 'str', 'lower'); r = roll(c, 'spellcraft', { diff: 50 }); eq([r.gained, r.stat, r.value, r.lowered, r.lowerValue, ST.total(c)], [true, 'int', 26, 'str', 99, 225], 'at 225: one point moves from the lowered STR to INT');
eq(ST.gainText(r), 'Your Intelligence has increased to 26. Your Strength has decreased to 99.', 'journal text once per event, with the donor');
// below cap a lowered stat never decays
c = mk({ str: 50, dex: 50, int: 50 }); ST.setLock(c, 'str', 'lower'); c.skills.spellcraft.v = 500; r = roll(c, 'spellcraft', { diff: 50 }); eq([r.lowered, c.base.str, c.base.int], [null, 50, 51], 'below 225 a stat set to Lower does not decay');
// donor rules
c = mk({ str: 25, dex: 100, int: 100 }); c.skills.mining.v = 500; ST.setLock(c, 'dex', 'hold'); ST.setLock(c, 'int', 'hold');
eq(roll(c, 'mining', { diff: 50 }).gained, false, 'held stats never donate');
c = mk({ str: 25, dex: 100, int: 100 }); c.base = { str: 25, dex: 100, int: 100 }; ST.setLock(c, 'dex', 'lower'); ST.setLock(c, 'int', 'lower'); eq(ST.donor(c, 'str'), 'dex', 'tie between lowered stats: DEX before INT (STR, DEX, INT order)');
c.base = { str: 25, dex: 90, int: 100 }; c.base.str = 35; eq(ST.donor(c, 'str'), 'int', 'donor = highest lowered stat');
c.base = { str: 105, dex: 10, int: 110 }; eq(ST.donor({ base: { str: 100, dex: 10, int: 115 }, statState: { locks: { str: 'raise', dex: 'lower', int: 'hold' } } }, 'str'), null, 'a lowered stat at 10 never donates');
eq(ST.donor({ base: { str: 100, dex: 50, int: 75 }, statState: { locks: { str: 'lower', dex: 'raise', int: 'raise' } } }, 'str'), null, 'the stat being raised is never its own donor');
// every lock permutation at the cap and below it
{ const L = ST.LOCKS; let bad = 0, n = 0;
  for (const a of L) for (const b of L) for (const d of L) for (const total of [150, 225]) for (const sk of ['mining', 'swordsmanship', 'camping']) {
    const base = total === 225 ? { str: 75, dex: 75, int: 75 } : { str: 50, dex: 50, int: 50 };
    const ch = mk(base); ch.statState.locks = { str: a, dex: b, int: d }; ch.skills.mining.v = 500; ch.skills.swordsmanship.v = 500;
    const wts = ST.weights(sk); const before = Object.assign({}, ch.base); const res = sk === 'camping' ? ST.tryStatGain(ch, 'mining', { action: act(), now: 5, rng: GAIN }) : roll(ch, sk, { diff: 50 });
    const ww = sk === 'camping' ? ST.weights('mining') : wts;
    const can = ST.KEYS.filter(k => ww[k] && ch.statState.locks[k] === 'raise' && before[k] < 100 && (total < 225 || ST.KEYS.some(x => x !== k && ch.statState.locks[x] === 'lower' && before[x] > 10)));
    n++;
    const tot = ST.KEYS.reduce((s, k) => s + ch.base[k], 0);
    if (res.gained !== can.length > 0) bad++;
    if (res.gained && (ch.statState.locks[res.stat] !== 'raise' || (res.lowered && ch.statState.locks[res.lowered] !== 'lower'))) bad++;
    if (tot > 225 || (total === 225 && tot !== 225) || (total < 225 && res.gained && tot !== total + 1) || (!res.gained && tot !== total)) bad++;
  }
  eq([n, bad], [162, 0], 'all 27 lock permutations × below/at cap × skills: only Raise gains, only Lower donates, totals exact');
}
// minimum and integers hold under long random play
{ const ch = mk({ str: 60, dex: 10, int: 10 }); ch.skills.mining.v = 1000; ch.skills.spellcraft.v = 1000; ch.skills.fencing.v = 1000; let t = 0, ok = true;
  ch.statState.seed = 12345;
  for (let i = 0; i < 40000; i++) { t += 3; const k = ['mining', 'spellcraft', 'fencing'][i % 3]; if (i % 997 === 0) for (const s of ST.KEYS) ST.setLock(ch, s, ST.LOCKS[(i + ST.KEYS.indexOf(s)) % 3]); ST.tryStatGain(ch, k, { action: 'x' + i, now: t, diff: 100, target: 'n' + (i % 13) });
    if (!ST.valid(ch.base)) { ok = false; break; } }
  eq([ok, ST.total(ch) <= 225, ST.KEYS.every(k => Number.isInteger(ch.base[k]))], [true, true, true], '40 000 seeded actions with random locks: 10–100 each, ≤ 225, integers');
}

// ---------- eligibility (late T2A skill rules) ----------
c = mk(); c.skills.mining.v = 500; c.skills.mining.lock = 'hold'; eq(roll(c, 'mining', { diff: 50 }).reason, 'skill is not set to Raise', 'a held skill does not train stats');
c.skills.mining.lock = 'lower'; eq(roll(c, 'mining', { diff: 50 }).reason, 'skill is not set to Raise', 'a lowered skill does not train stats');
c = mk(); c.skills.mining.v = 1000; eq(roll(c, 'mining', { diff: 100 }).gained, true, 'a Grandmaster (100.0, Raise) still trains stats (no SF.tryGain GM early return)');
const K7 = Object.keys(SF.newSkills()).filter(k => k !== 'mining').slice(0, 7);
c = mk(); for (const k of K7) c.skills[k].v = 1000; const k7 = Object.keys(c.skills).filter(k => c.skills[k].v === 1000); eq(SF.totalSkill(c), 7000, '700.0 skill total');
c.skills[k7[0]].v = 990; c.skills.mining.v = 10; eq(roll(c, 'mining', { diff: 10 }).reason, 'skill cap reached with no skill set to Lower', 'below GM at the 700 cap: no stat gain without a skill set to Lower');
c.skills[k7[1]].lock = 'lower'; const sv0 = JSON.stringify(c.skills); eq(roll(c, 'mining', { diff: 10 }).gained, true, '… with a skill set to Lower it qualifies');
eq(JSON.stringify(c.skills), sv0, 'no skill point is consumed by a stat check');
c.skills[k7[1]].lock = 'raise'; c.skills[k7[2]].lock = 'raise'; eq(roll(c, k7[0], { diff: 99, now: 1e6 }).reason, 'skill cap reached with no skill set to Lower', 'pre-action state: 99.0 at the cap is not a GM');
eq(roll(c, k7[3], { diff: 100, now: 2e6 }).gained, true, 'a GM skill at the 700 cap still trains stats');
// pre-action snapshot: the action's own skill gain took the last donor tenth
c = mk(); for (const k of K7) c.skills[k].v = 1000; c.skills[k7[0]].v = 999; c.skills[k7[1]].v = 1; c.skills[k7[1]].lock = 'lower'; c.skills[k7[2]].v = 1000;
const snap = ST.skillSnapshot(c, k7[0]); c.skills[k7[1]].v = 0; c.skills[k7[0]].v = 1000;   // simulate the simultaneous skill transfer
eq(ST.tryStatGain(c, k7[0], { action: act(), now: 9e6, rng: GAIN, pre: snap, diff: 100 }).gained, true, 'eligibility uses the pre-action state');
eq(roll(c, 'notaskill', {}).reason, 'skill trains no attribute', 'unknown skill never qualifies');

// ---------- action contract: validity, duplicates, cooldown persistence ----------
c = mk(); c.skills.mining.v = 500;
eq(ST.tryStatGain(c, 'mining', { now: 5, rng: GAIN }).reason, 'no action id', 'an action needs an id');
eq(ST.tryStatGain(c, 'mining', { action: 'q1', rng: GAIN }).reason, 'no time', 'an action needs a time');
eq(ST.tryStatGain(c, 'mining', { action: 'q2', now: 5, valid: false, rng: GAIN }).reason, 'action did not resolve', 'cancelled / impossible / targetless actions never qualify');
eq(ST.tryStatGain(c, 'mining', { action: 'q3', now: 5, rng: GAIN }).gained, true, 'resolved action gains');
eq(ST.tryStatGain(c, 'mining', { action: 'q3', now: 500, rng: GAIN }).reason, 'duplicate action', 'the same action id never rolls twice (multi-skill actions share one roll)');
{ const saved = JSON.parse(JSON.stringify({ base: c.base, statState: c.statState, name: c.name }));
  const d = mk(saved.base); d.statState = ST.cleanState(saved.statState); d.skills.mining.v = 500;
  eq(ST.tryStatGain(d, 'mining', { action: 'q4', now: 20, rng: GAIN }).reason, 'cooldown', 'cooldown survives save and reload (active time)');
  eq(ST.tryStatGain(d, 'mining', { action: 'q3', now: 90, rng: GAIN }).reason, 'duplicate action', 'resolved-action log survives reload');
  eq(ST.tryStatGain(d, 'mining', { action: 'q5', now: 40, rng: GAIN }).gained, true, 'gain again after the cooldown, from the reloaded state');
}
eq(ST.cleanState({ locks: { str: 'up', dex: 'lower' }, last: 'x', seed: -1, recent: [['a', 'b'], ['k|', 3]], seen: [1, 'z'], gains: -2 }, 9), { v: 1, locks: { str: 'raise', dex: 'lower', int: 'raise' }, last: -1e9, seed: 4294967295, recent: [['k|', 3]], seen: ['z'], gains: 0 }, 'malformed saved state cleaned field by field');
{ const ch = mk(); for (let i = 0; i < 300; i++) ST.tryStatGain(ch, 'mining', { action: 'b' + i, now: i, target: 'n' + i }); eq([ch.statState.seen.length <= ST.CFG.seenMax, ch.statState.recent.length <= ST.CFG.recentMax], [true, true], 'dedup and repeat logs stay bounded'); }

// ---------- repeat penalty: no single-target exploit ----------
c = mk(); c.skills.mining.v = 500; { const st = c.statState; const t0 = 0; for (let i = 0; i < 8; i++) st.recent.push(['mining|rock1', t0 + i]); eq(ST.repeatFactor(st, 'mining', 'rock1', 10), 1, '8 uses of one node in 10 min: no penalty yet');
  for (let i = 0; i < 14; i++) st.recent.push(['mining|rock1', 10 + i]); eq(ST.repeatFactor(st, 'mining', 'rock1', 30), 0, '22 uses of the same node: no stat gain from it');
  eq(ST.repeatFactor(st, 'mining', 'rock2', 30), 1 - 2 * .08, 'a fresh node: only the skill-wide penalty (22 uses, 20 free)');
  for (let i = 0; i < 40; i++) st.recent.push(['mining|r' + i, 25]); eq(ST.repeatFactor(st, 'mining', 'rockX', 30), .25, 'hammering one skill: the skill-wide penalty floors at 25 %');
  eq(ST.repeatFactor(st, 'mining', 'rock1', 30 + 700), 1, 'the window passes: full chance again'); }
{ const ch = mk({ str: 20, dex: 30, int: 30 }); ch.skills.wrestling.v = 500; let gains = 0; for (let i = 0; i < 4000; i++) { const r2 = ST.tryStatGain(ch, 'wrestling', { action: 'd' + i, now: i * 3, target: 'dummy', diff: 50 }); if (r2.gained) gains++; }
  eq(gains <= 5, true, `one stationary target for 3.3 h gives at most a handful of gains (${gains})`); }

// ---------- determinism ----------
{ const run = () => { const ch = mk({ str: 30, dex: 30, int: 20 }); ch.statState.seed = 4242; ch.skills.swordsmanship.v = 500; const out = []; for (let i = 0; i < 3000; i++) { const r2 = ST.tryStatGain(ch, 'swordsmanship', { action: 'e' + i, now: i * 3, target: 'm' + (i % 9), diff: 50 }); if (r2.gained) out.push(i + r2.stat); } return out.join(','); };
  const a = run(); const save = Math.random; Math.random = () => 0; const b = run(); Math.random = save;
  eq(a === b && a.length > 0, true, 'seeded stream: identical gains on replay and independent of Math.random'); }
{ const ch = mk({ str: 30, dex: 30, int: 20 }); ch.skills.swordsmanship.v = 500; let s = 0, d = 0; ch.statState.seed = 99; for (let i = 0; i < 200000; i++) { ch.base = { str: 30, dex: 30, int: 20 }; ch.statState.last = -1e9; ch.statState.recent = []; ch.statState.seen = []; const r2 = ST.tryStatGain(ch, 'swordsmanship', { action: 'w', now: 0, rng: (() => { let k = 0; return () => k++ === 0 ? (i + .5) / 200000 : 0; })() }); if (r2.stat === 'str') s++; else d++; }
  eq([s, d], [150000, 50000], 'weighted pick: Swordsmanship 75 % STR / 25 % DEX'); }

// ---------- buffs, curses and pools (magic deltas live outside the natural values) ----------
c = mk({ str: 50, dex: 30, int: 20 }); const mods = {}; MG.applyStatMod(mods, 'str', 11, 100); MG.applyStatMod(mods, 'int', -8, 100);
const eff = () => { for (const k of ST.KEYS) c[k] = MG.effectiveStat(c.base[k], mods, k, 50); };
eff(); eq([c.str, c.int, c.base.str, c.base.int], [61, 12, 50, 20], 'boon and hex change effective values only');
c.skills.mining.v = 500; c.hp = 61; roll(c, 'mining', { diff: 50 }); eff(); ST.clampPools(c); eq([c.base.str, c.str, c.hp], [51, 62, 61], 'a gain during a boon adds one natural point, no free healing');
for (const k of ST.KEYS) c[k] = MG.effectiveStat(c.base[k], mods, k, 200); ST.clampPools(c); eq([c.str, c.hp, c.base.str], [51, 51, 51], 'boon expires: pools clamp down, the natural point stays');
c.base = { str: 100, dex: 100, int: 25 }; ST.setLock(c, 'str', 'lower'); ST.setLock(c, 'int', 'raise'); c.skills.spellcraft.v = 500; for (const k of ST.KEYS) c[k] = MG.effectiveStat(c.base[k], mods, k, 50);
roll(c, 'spellcraft', { diff: 50, now: 1e7 }); eq([c.base.str, c.base.int, ST.total(c)], [99, 26, 225], 'cap transfer while buffed/cursed moves natural points only');
const rt = JSON.parse(JSON.stringify({ str: c.str, dex: c.dex, int: c.int, base: c.base })); eq(rt.base, { str: 99, dex: 100, int: 26 }, 'saved natural values exclude the active boon');
c = mk({ str: 40, dex: 30, int: 10 }); c.hp = 1; c.mana = 3; ST.clampPools(c); eq([c.hp, c.mana], [1, 3], 'no refill on recompute');
c.hp = 0; c.ghost = true; ST.clampPools(c); eq(c.hp, 0, 'a ghost stays at 0 HP'); c.ghost = false; c.hp = 0; ST.clampPools(c); eq(c.hp, 1, 'a living character keeps at least 1 HP');
c.hp = 40; c.str = 20; ST.clampPools(c); eq(c.hp, 20, 'Strength loss clamps Health without killing');

// ---------- Strength policy: gear the character can no longer wear goes to the backpack ----------
c = mk({ str: 60, dex: 30, int: 10 }); const plate = EQ.make('plate_chest', { origin: 'npc' }); eq(EQ.equipItem(c, { uid: (c.pack.items.push(plate), plate.uid) }).ok, true, 'plate chest worn at 60 STR');
const before = EQ.totalWt(c); c.base.str = EQ.strReq(plate) - 1; c.str = c.base.str; const moved = ST.enforceStrength(c);
eq([moved.length, c.equip.chest, c.pack.items.includes(plate), EQ.totalWt(c) === before], [1, null, true, true], 'below the requirement: unequipped into the backpack, nothing lost, weight unchanged');
c.str = 80; eq(ST.enforceStrength(c).length, 0, 'nothing else moves');

// ---------- migration of saved characters ----------
let sc = { name: 'Old', str: 55, dex: 45, int: 50 }; let mr = ST.migrateChar(sc, 3); eq([mr.changed, sc.base, sc.statState.locks, sc.statMig, mr.repairs], [true, { str: 55, dex: 45, int: 50 }, { str: 'raise', dex: 'raise', int: 'raise' }, 1, []], 'legacy 150-point character keeps its natural stats; locks Raise');
const once = JSON.stringify(sc); mr = ST.migrateChar(sc, 3); eq([mr.changed, JSON.stringify(sc)], [false, once], 'migration is idempotent');
sc = { str: 120, dex: 90, int: '40', base: null }; mr = ST.migrateChar(sc); eq([sc.base, mr.repairs.length > 0], [{ str: 95, dex: 90, int: 40 }, true], 'over-cap and string values repaired deterministically (excess from the highest)');
sc = { str: 61, dex: 41, int: 40, base: { str: 50, dex: 40, int: 40 } }; ST.migrateChar(sc); eq([sc.base, sc.str], [{ str: 50, dex: 40, int: 40 }, 50], 'a valid explicit base wins over buffed str/dex/int');
sc = { str: null, dex: 3.6, int: NaN }; mr = ST.migrateChar(sc); eq(sc.base, { str: 10, dex: 10, int: 10 }, 'garbage becomes the minimum, logged'); eq(mr.repairs.length, 3, 'each repair logged');
sc = { str: 100, dex: 100, int: 100 }; ST.migrateChar(sc); eq([ST.total(sc), sc.base], [225, { str: 75, dex: 75, int: 75 }], '300 points trimmed to 225 by taking from the highest in turn');

// ---------- skill mapping ----------
eq(SF.SKILLS.filter(([k]) => !ST.MAP[k] && !ST.NO_MAP[k]).map(s => s[0]), [], 'every runtime skill declares stat weights (or a reason for none)');
eq(Object.entries(ST.MAP).filter(([, w]) => Object.values(w).reduce((a, b) => a + b, 0) !== 100).map(e => e[0]), [], 'weights total 100');
eq(Object.entries(ST.ALIAS).filter(([a, k]) => !ST.MAP[k] || ST.MAP[a] || SF.SKILL[a]).map(e => e[0]), [], 'aliases point at runtime rows and duplicate none');
eq([ST.weights('magery'), ST.weights('enticement'), ST.weights('lumberjacking')], [{ int: 100 }, { int: 75, dex: 25 }, { str: 75, dex: 25 }], 'planned canonical ids resolve to the same rows');
eq([ST.weights('mining'), ST.weights('fencing'), ST.weights('healing'), ST.weights('smithing'), ST.weights('appraisal')], [{ str: 100 }, { dex: 75, str: 25 }, { dex: 75, int: 25 }, { str: 100 }, { int: 100 }], 'spec table rows');
eq(ST.trainedBy('str').slice(0, 3).map(x => x.k), ['mining', 'smithing', 'carpentry'], 'tooltip list of what trains Strength');
eq(ST.cycleLock(mk(), 'str'), { ok: true, stat: 'str', mode: 'hold' }, 'lock cycles Raise → Hold'); eq(ST.setLock(mk(), 'luck', 'raise').ok, false, 'only STR/DEX/INT have locks'); eq(ST.setLock(mk(), 'str', 'up').ok, false, 'only raise/hold/lower');

// ---------- gains per hour (seeded; tuning, not historical). A player acting every 3 s on varied, challenging targets ----------
const perHour = (b, skill, gap, targets, diff) => { const ch = mk(b); ch.statState.seed = 777; ch.skills[skill].v = 600; let t = 0, n = 0; const hours = 20;
  for (let i = 0; t < hours * 3600; i++) { t += gap; const st0 = Object.assign({}, ch.base); const r2 = ST.tryStatGain(ch, skill, { action: 'h' + i, now: t, target: 't' + (i % targets), diff }); if (r2.gained) { n++; ch.base = st0; ch.statState.last = t; } }   // hold the stat level fixed to measure that level
  return n / hours; };
const rows = [[{ str: 25, dex: 25, int: 30 }, 'low (25)'], [{ str: 55, dex: 15, int: 10 }, 'mid (55)'], [{ str: 90, dex: 60, int: 60 }, 'high (90)']].map(([b, n]) => [n, perHour(b, 'mining', 3, 40, 60).toFixed(1), perHour(b, 'mining', 3, 3, 60).toFixed(1), perHour(b, 'mining', 3, 40, 20).toFixed(1)]);
console.log('info gains/hour of Strength by Mining (every 3 s) — [level, varied nodes, 3 nodes, trivial nodes]:', JSON.stringify(rows));
eq(+rows[0][1] > +rows[1][1] && +rows[1][1] > +rows[2][1] && +rows[2][1] > 5, true, 'progress slows with the stat but stays noticeable at 90');
eq(+rows[0][1] <= 120, true, 'never more than one gain per 30 s');
eq(+rows[0][3] < +rows[0][1], true, 'trivial use gains less');

console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
