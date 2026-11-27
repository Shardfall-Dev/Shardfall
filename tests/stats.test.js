// usage: node tests/stats.test.js Shardfall_v0.33.html — attribute locks (SF.STATS) and the stat gains in src/skills.js (SF.SK), no browser
const fs = require('fs'); const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.33.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const g = {}; const m = { exports: {} };
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.METALS')))(m, g); g.SF = m.exports;
for (const mark of ['SF.SK = SK', 'SF.STATS = ST']) new Function('module', 'globalThis', scripts.find(t => t.includes(mark)))({}, g);
const SF = g.SF, ST = SF.STATS, SK = SF.SK;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };
const mk = (s, skills, o) => { const c = Object.assign({ str: s[0], dex: s[1], int: s[2], skills: SF.newSkills() }, o || {}); for (const k in skills || {}) c.skills[k].v = skills[k] * 10; ST.migrateChar(c); return c; };
const learn = (c, k, rng) => SK.learn(c, k, .5, true, { rng: rng || (() => 0), stats: c.base || c, locks: c.statLocks });

eq(SF.statTrainCost, undefined, 'no stat purchase price exists');
eq(['str', 'dex', 'int'].every(s => ST.trainedBy(s).length > 0), true, 'every attribute is trained by some skill');
// migration
{ const c = { str: 60, dex: 50, int: 40, skills: SF.newSkills() }; const f = ST.migrateChar(c); eq([c.str, c.dex, c.int, c.statLocks, f.includes('locks')], [60, 50, 40, { str: 'raise', dex: 'raise', int: 'raise' }, true], 'old character keeps its stats and gets Raise locks');
  eq(ST.migrateChar(c), [], 'migration idempotent');
  const b = { str: 120, dex: 'x', int: 100.5, skills: SF.newSkills() }; ST.migrateChar(b); eq([b.str, b.dex, b.int], [100, 10, 100], 'malformed values repaired deterministically');
  const o = { str: 100, dex: 100, int: 100, skills: SF.newSkills() }; ST.migrateChar(o); eq(o.str + o.dex + o.int, 225, 'over-cap repaired to 225'); }
// locks
{ const c = mk([45, 25, 10]); eq(ST.setLock(c, 'str', 'lower').ok, true, 'set lock'); eq(ST.setLock(c, 'str', 'up').ok, false, 'bad lock rejected'); eq(ST.setLock(c, 'luck', 'raise').ok, false, 'bad stat rejected');
  eq([ST.cycleLock('raise'), ST.cycleLock('hold'), ST.cycleLock('lower')], ['hold', 'lower', 'raise'], 'lock cycle'); }
// gains through the one engine (SK.learn → SK.statGain)
{ const c = mk([45, 25, 10], { blacksmithy: 50 }); const r = learn(c, 'blacksmithy'); eq([r.stat && r.stat.stat, c.str], ['str', 46], 'Blacksmithy raises Strength'); }
{ const c = mk([45, 25, 10], { blacksmithy: 50 }); c.statLocks.str = 'hold'; const r = learn(c, 'blacksmithy'); eq([c.str, !r.stat || r.stat.stat !== 'str'], [45, true], 'a held stat never rises'); }
{ const c = mk([45, 25, 10], { magery: 50 }); c.statLocks.int = 'lower'; const r = learn(c, 'magery'); eq([c.int, !r.stat || r.stat.stat !== 'int'], [10, true], 'a lowered stat never rises'); }
{ const c = mk([100, 20, 10], { mining: 50 }); for (let i = 0; i < 50; i++) learn(c, 'mining'); eq(c.str, 100, 'never above 100'); }
// the 225 cap: one point moves from the highest Lower stat; none → no change; below 225 a Lower stat does not decay
{ const c = mk([100, 100, 25], { magery: 50 }); const snap = JSON.stringify([c.str, c.dex, c.int]); for (let i = 0; i < 20; i++) learn(c, 'magery'); eq(JSON.stringify([c.str, c.dex, c.int]), snap, 'at 225 with no Lower stat nothing changes');
  c.statLocks.str = 'lower'; c.statLocks.dex = 'lower'; const r = learn(c, 'magery');
  eq([r.stat.stat, r.stat.lowered, c.str + c.dex + c.int, c.int], ['int', 'str', 225, 26], 'transfer: +1 Intelligence, −1 Strength (tie → Strength first)');
  eq(ST.message(r.stat), 'Your Intelligence has increased to 26. Your Strength has decreased to 99.', 'journal line'); }
{ const c = mk([11, 100, 100], {}); c.statLocks.str = 'lower'; eq(ST.donor(c, c.statLocks, 'int'), 'str', 'donor above 10'); c.str = 10; eq(ST.donor(c, c.statLocks, 'int'), null, 'no donor at 10'); }
{ const c = mk([45, 25, 10], { magery: 50 }); c.statLocks.str = 'lower'; for (let i = 0; i < 10; i++) learn(c, 'magery'); eq([c.str, c.int > 10], [45, true], 'below 225 a Lower stat does not decay'); }
// the natural store: gains go to ch.base when the magic module keeps one
{ const c = { str: 60, dex: 30, int: 30, base: { str: 40, dex: 30, int: 30 }, skills: SF.newSkills() }; c.skills.mining.v = 500; ST.migrateChar(c); learn(c, 'mining');
  eq([c.base.str, c.str], [41, 60], 'gains go to the natural base, not the buffed value'); }

console.log(fails ? `${fails} FAILED` : 'all stats tests passed'); process.exit(fails ? 1 : 0);
