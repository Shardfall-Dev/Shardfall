// usage: node tests/stats.test.js Shardfall_v0.30.html — natural attribute progression (SF.STATS) with no browser
const fs = require('fs'); const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.30.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const g = {}; const m = { exports: {} };
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.METALS')))(m, g); g.SF = m.exports;
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.STATS = ST')))({}, g);
const SF = g.SF, ST = SF.STATS;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };
const mk = (s, skills, o) => { const c = Object.assign({ str: s[0], dex: s[1], int: s[2], skills: SF.newSkills() }, o || {}); for (const k in skills || {}) c.skills[k].v = skills[k] * 10; ST.migrateChar(c); return c; };
const sure = c => { c.statGain.seed = 1; };   // reproducible stream

eq(SF.statTrainCost, undefined, 'no stat purchase price exists');
eq(Object.keys(ST.WEIGHTS).sort(), SF.SKILLS.map(s => s[0]).sort(), 'every skill declares its attribute weights');
eq([ST.chance(10), ST.chance(100), +ST.chance(55).toFixed(4)], [.04, .01, .025], 'chance falls with the stat (4% → 1%)');
// migration
{ const c = { str: 60, dex: 50, int: 40, skills: SF.newSkills() }; const f = ST.migrateChar(c); eq([c.str, c.dex, c.int, c.statLocks, f.includes('locks')], [60, 50, 40, { str: 'raise', dex: 'raise', int: 'raise' }, true], 'old 150-point character keeps its stats, gains locks');
  eq(ST.migrateChar(c), [], 'migration idempotent');
  const b = { str: 120, dex: 'x', int: 100.5, skills: SF.newSkills() }; ST.migrateChar(b); eq([b.str, b.dex, b.int], [100, 10, 100], 'malformed values repaired deterministically');
  const o = { str: 100, dex: 100, int: 100, skills: SF.newSkills() }; ST.migrateChar(o); eq(o.str + o.dex + o.int, 225, 'over-cap repaired to 225'); }
// locks
{ const c = mk([35, 20, 10]); eq(ST.setLock(c, 'str', 'lower').ok, true, 'set lock'); eq(ST.setLock(c, 'str', 'up').ok, false, 'bad lock rejected'); eq(ST.setLock(c, 'luck', 'raise').ok, false, 'bad stat rejected');
  eq([ST.cycleLock('raise'), ST.cycleLock('hold'), ST.cycleLock('lower')], ['hold', 'lower', 'raise'], 'lock cycle'); }
// gain mechanics
const always = { now: 100, challenge: 1 };
{ // a fixed, low-roll stream: force a gain by pre-seeding until one happens
  const c = mk([35, 20, 10], { swordsmanship: 50 }); let r, t = 0, n = 0; for (let i = 0; i < 4000; i++) { t += 46; r = ST.tryStatGain(c, 'swordsmanship', { now: t, action: i }); if (r.gained) n++; }
  eq(c.str + c.dex + c.int, 65 + n, 'gains add points one at a time'); eq(c.int, 10, 'Swordsmanship never trains Intelligence'); eq(c.str > c.dex - 20, true, 'Strength is the main gain');
  const before = c.str + c.dex + c.int; ST.tryStatGain(c, 'swordsmanship', { now: t + 1, action: 'x' }); const r2 = Object.assign({}, c.statGain); void r2;
  const cd = mk([35, 20, 10], { swordsmanship: 50 }); cd.statGain.cd = 1000; eq(ST.tryStatGain(cd, 'swordsmanship', { now: 999.9 }).reason, 'attribute gain cooling down', 'cooldown blocks'); void before; }
{ const c = mk([35, 20, 10], { swordsmanship: 50 }); eq(ST.tryStatGain(c, 'swordsmanship', { now: 1, aux: true }).reason, 'auxiliary check', 'auxiliary checks never roll');
  ST.tryStatGain(c, 'swordsmanship', { now: 1, action: 7 }); eq(ST.tryStatGain(c, 'tactics', { now: 1, action: 7 }).reason, 'one attribute roll per action', 'one roll per action');
  eq(ST.tryStatGain(c, 'swordsmanship', { now: 1, action: 8, challenge: 0 }).reason, 'no challenge', 'invalid action never rolls');
  c.skills.swordsmanship.lock = 'hold'; eq(ST.tryStatGain(c, 'swordsmanship', { now: 1, action: 9 }).reason, 'skill is not set to Raise', 'held skill trains no stats'); }
{ const c = mk([35, 20, 10], { swordsmanship: 100 }); let g2 = 0; for (let i = 0; i < 3000; i++) if (ST.tryStatGain(c, 'swordsmanship', { now: i * 46, action: i }).gained) g2++; eq(g2 > 0, true, 'a Grandmaster still trains stats'); }
{ // 700 cap: below GM needs a Lower skill with points
  const c = mk([35, 20, 10], { swordsmanship: 90, tactics: 100, anatomy: 100, healing: 100, parrying: 100, wrestling: 100, mining: 100, fishing: 10 });
  eq(SF.totalSkill(c), 7000, 'at 700.0'); eq(ST.eligible(c, 'swordsmanship').ok, false, 'at 700 with nothing Lower: no stat training');
  c.skills.fishing.lock = 'lower'; eq(ST.eligible(c, 'swordsmanship').ok, true, 'with a Lower skill it trains again'); eq(ST.eligible(c, 'tactics').ok, true, 'a GM skill trains regardless'); }
{ // per-stat cap and locks
  const c = mk([100, 20, 10], { mining: 50 }); for (let i = 0; i < 500; i++) ST.tryStatGain(c, 'mining', { now: i * 46, action: i }); eq(c.str, 100, 'never above 100');
  eq(ST.tryStatGain(c, 'mining', { now: 1e6, action: 'z' }).reason, 'no attribute can rise', 'Mining at 100 STR has nothing to raise');
  const h = mk([35, 20, 10], { swordsmanship: 50 }); h.statLocks.str = 'hold'; h.statLocks.dex = 'hold'; eq(ST.tryStatGain(h, 'swordsmanship', { now: 1, action: 1 }).reason, 'no attribute can rise', 'held stats do not rise'); }
{ // the 225 cap: atomic one-point transfer from the highest Lower stat; none → no change
  const c = mk([100, 100, 25], { spellcraft: 50 }); const snap = JSON.stringify([c.str, c.dex, c.int]);
  for (let i = 0; i < 200; i++) ST.tryStatGain(c, 'spellcraft', { now: i * 46, action: i }); eq(JSON.stringify([c.str, c.dex, c.int]), snap, 'at 225 with no Lower stat nothing changes');
  c.statLocks.str = 'lower'; c.statLocks.dex = 'lower'; let r = null; for (let i = 0; i < 4000 && !(r && r.gained); i++) r = ST.tryStatGain(c, 'spellcraft', { now: 1e5 + i * 46, action: 'a' + i });
  eq([r.gained, r.stat, r.lowered, c.str + c.dex + c.int, c.int], [true, 'int', 'str', 225, 26], 'transfer: +1 Intelligence, −1 Strength (tie → Strength first)');
  eq(ST.message(r), 'Your Intelligence has increased to 26. Your Strength has decreased to 99.', 'journal line');
  const d = mk([10, 115 - 10, 100], {}); void d; }
{ const c = mk([11, 100, 100], { spellcraft: 50 }); c.statLocks.str = 'lower'; eq(ST.donor(c, 'int'), 'str', 'donor above 10'); c.str = 10; eq(ST.donor(c, 'int'), null, 'no donor at 10'); }
{ // below 225 a Lower stat does not decay
  const c = mk([35, 20, 10], { spellcraft: 50 }); c.statLocks.str = 'lower'; let n = 0; for (let i = 0; i < 3000; i++) if (ST.tryStatGain(c, 'spellcraft', { now: i * 46, action: i }).gained) n++; eq([c.str, c.int, n > 0], [35, 10 + n, true], 'Lower below the cap: no decay, gains are free'); }
{ // base object is the natural store (magic buffs live elsewhere)
  const c = { str: 60, dex: 30, int: 30, base: { str: 40, dex: 30, int: 30 }, skills: SF.newSkills() }; c.skills.mining.v = 500; ST.migrateChar(c); let r; for (let i = 0; i < 4000 && !(r && r.gained); i++) r = ST.tryStatGain(c, 'mining', { now: i * 46, action: i });
  eq([c.base.str, c.str], [41, 60], 'gains go to the natural base, not the buffed value'); }
{ // determinism and persistence of the stream
  const a = mk([35, 20, 10], { swordsmanship: 50 }), b = mk([35, 20, 10], { swordsmanship: 50 }); const ra = [], rb = [];
  for (let i = 0; i < 300; i++) { ra.push(ST.tryStatGain(a, 'swordsmanship', { now: i * 46, action: i }).gained); }
  const half = JSON.parse(JSON.stringify(b)); for (let i = 0; i < 150; i++) rb.push(ST.tryStatGain(b, 'swordsmanship', { now: i * 46, action: i }).gained);
  const saved = JSON.parse(JSON.stringify(b)); for (let i = 150; i < 300; i++) rb.push(ST.tryStatGain(saved, 'swordsmanship', { now: i * 46, action: i }).gained); void half;
  eq(ra, rb, 'seeded rolls identical through a save/load'); }
{ // trivial use counts less: measured over the same stream
  const rate = ch => { const c = mk([35, 20, 10], { mining: 50 }); let n = 0; for (let i = 0; i < 20000; i++) if (ST.tryStatGain(c, 'mining', { now: i * 46, action: i, challenge: ch }).gained) { n++; c.str = 35; } return n; };
  const full = rate(1), triv = rate(.25); eq(triv < full * .5, true, `trivial use gains less (${triv} vs ${full})`); }
// measured rate for the docs: active seconds per point at 30 / 60 / 90 with one fitting action every 3 s
for (const v of [30, 60, 90]) { const c = mk([v, 10, Math.max(10, 65 - v - 10)], { mining: 60 }); let n = 0; const T = 3600 * 5; for (let t = 0; t < T; t += 3) { if (ST.tryStatGain(c, 'mining', { now: t, action: t }).gained) { n++; c.str = v; } } console.log(`info  STR ${v}: ${(n / 5).toFixed(1)} points per hour of mining (one swing / 3 s)`); }

console.log(fails ? `${fails} FAILED` : 'all stats tests passed'); process.exit(fails ? 1 : 0);
