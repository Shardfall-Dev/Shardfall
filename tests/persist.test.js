// usage: node tests/persist.test.js Shardfall_v0.35.html — Living World phase 6 pure rules (SIM, src/world.js), no browser:
// the simulation tiers (radii from the screen, hysteresis, B-tier staggering) and the population rows (pack, validate, never duplicate).
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.35.html', 'utf8');
const src = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(t => t.includes('SIM.VERSION'));
const m = { exports: {} }; new Function('module', 'globalThis', src)(m, {}); const SIM = m.exports;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };

// ---- tiers
const T = SIM.TIER;
eq([T.A, T.B, T.bEvery], [40, 120, 4], 'defaults: A 40 m, B 120 m, regional actors run one step in four');
eq(Math.round(SIM.viewRadius(422 + 100, 195 + 120) * 10) / 10, 18.1, 'a phone in landscape (844 × 390) sees 18 m to its farthest corner');
let R = SIM.tierRadii(18.1); eq([R.a, R.b], [40, 120], 'a small screen keeps the default radii');
R = SIM.tierRadii(48); eq([R.a, R.b], [56, 120], 'a large screen widens A to its corner + 8 m; B stays at least A + 60');
R = SIM.tierRadii(90); eq([R.a, R.b], [98, 158], 'a very large screen pushes B out too');
R = { a: 40, b: 120 };
eq([0, 39.9, 40, 41, 119, 121, 500].map(d => SIM.tierOf(d, undefined, R)), ['A', 'A', 'A', 'B', 'B', 'C', 'C'], 'tier by distance');
eq([SIM.tierOf(44, 'A', R), SIM.tierOf(47, 'A', R), SIM.tierOf(44, 'B', R)], ['A', 'B', 'B'], 'hysteresis: leaving A takes 6 m more than entering it');
eq([SIM.tierOf(124, 'B', R), SIM.tierOf(124, 'C', R), SIM.tierOf(127, 'B', R)], ['B', 'C', 'C'], 'hysteresis at the B/C boundary');
let walk = [], prev; for (let d = 30; d < 140; d += .5) { prev = SIM.tierOf(d, prev, R); walk.push(prev); } for (let d = 140; d > 30; d -= .5) { prev = SIM.tierOf(d, prev, R); walk.push(prev); }
let flips = 0; for (let i = 1; i < walk.length; i++) if (walk[i] !== walk[i - 1]) flips++; eq(flips, 4, 'walking out and back in changes tier exactly four times');
let jitter = 0; prev = 'A'; for (let i = 0; i < 200; i++) { const n = SIM.tierOf(40 + (i % 2 ? 3 : -3), prev, R); if (n !== prev) jitter++; prev = n; } eq(jitter, 0, 'an actor wobbling on the boundary does not flip tier');
eq([SIM.tierDue('A', 7, 3), SIM.tierDue('C', 0, 0)], [true, false], 'A runs every step, C never');
const due = id => { let n = 0; for (let s = 0; s < 400; s++) if (SIM.tierDue('B', s, id)) n++; return n; };
eq([due(0), due(1), due(2), due(3), due(17)], [100, 100, 100, 100, 100], 'B runs one step in four, whatever the id');
const per = [0, 0, 0, 0]; for (let id = 0; id < 400; id++) for (let s = 0; s < 4; s++) if (SIM.tierDue('B', s, id)) per[s]++; eq(per, [100, 100, 100, 100], 'B actors are spread evenly across the four steps');

// ---- population rows
const MAXHP = { rat: 12, deer: 34, hound: 30 }, CAP = { 'rat@1,1': 2, 'deer@5,5': 3, 'hound@9,9': 3 };
const opt = { validType: t => t in MAXHP, capOf: k => CAP[k] || 0, maxHp: t => MAXHP[t] };
const live = [
  { id: 'mon:rat:4', type: 'rat', sp: 'rat@1,1', x: 1.234, y: 2.26, hp: 11.6, hx: 1, hy: 1, pack: 0, hidden: true, purse: 3, fedAgo: 12.4 },
  { id: 'mon:hound:9', type: 'hound', sp: 'hound@9,9', x: 9, y: 9, hp: 30, hx: 9, hy: 9, pack: 5, lead: true, fedAgo: 0 },
  { id: 'mon:hound:10', type: 'hound', sp: 'hound@9,9', x: 9.5, y: 9, hp: 20, hx: 9, hy: 9, pack: 5 }];
const rows = SIM.packCreatures(live);
eq(rows[0], ['mon:rat:4', 'rat', 'rat@1,1', 1.2, 2.3, 12, 1, 1, 0, 2, 3, 12], 'a row: id, species, spawner, position (0.1 m), health, home, pack, flags, purse, last meal');
eq(rows[1][9], 1, 'flag 1 marks the pack leader');
const back = SIM.unpackCreatures(JSON.parse(JSON.stringify(rows)), opt);
eq([back.list.length, back.dropped, back.list[0].hidden, back.list[1].lead, back.list[2].lead, back.list[0].hp], [3, 0, true, true, false, 12], 'rows read back through JSON');
eq(SIM.packCreatures(back.list), rows, 'pack → unpack → pack is stable');
const bad = rows.concat([rows[0].slice(), ['mon:x:1', 'dragon', 'rat@1,1', 1, 1, 5, 1, 1, 0, 0, 0, 0], ['mon:x:2', 'rat', 'nowhere', 1, 1, 5, 1, 1], ['mon:x:3', 'rat', 'rat@1,1', NaN, 1, 5, 1, 1],
  ['mon:x:4', 'rat', 'rat@1,1', 1, 1, 5, 1, 1], ['mon:x:5', 'rat', 'rat@1,1', 1, 1, 5, 1, 1], 'junk', [1, 2], ['', 'rat', 'rat@1,1', 1, 1, 5, 1, 1], ['mon:x:6', 'deer', 'deer@5,5', 1, 1, 999, 1, 1, 'p', 7, -4, -1]]);
const u = SIM.unpackCreatures(bad, opt);
eq(u.why, { duplicate: 1, species: 1, spawner: 1, number: 1, 'over cap': 1, shape: 2, id: 1 }, 'a repeated id, unknown species or spawner, a broken number, an over-full spawner and junk are dropped and counted');
eq(u.list.map(c => c.id), ['mon:rat:4', 'mon:hound:9', 'mon:hound:10', 'mon:x:4', 'mon:x:6'], 'the valid rows survive, each id once, no spawner beyond its cap');
const d6 = u.list[4]; eq([d6.hp, d6.pack, d6.lead, d6.hidden, d6.purse, d6.fedAgo], [34, 0, true, true, 0, 0], 'health is clamped to the species maximum; broken optional fields fall back to safe values');
eq(SIM.unpackCreatures(null, opt).list, [], 'no rows: nothing to restore');
const many = []; for (let i = 0; i < 2000; i++) many.push({ id: 'mon:deer:' + i, type: 'deer', sp: 'deer@5,5', x: i, y: i, hp: 34, hx: 0, hy: 0 });
eq(SIM.unpackCreatures(SIM.packCreatures(many), opt).list.length, 3, '2000 rows for one spawner restore only as many creatures as it holds');
const kb = JSON.stringify(SIM.packCreatures(many.map((c, i) => Object.assign({}, c, { x: 1234.56 + i % 7, y: 987.65, hx: 1234.5, hy: 987.6, sp: 'deer@1234,987', pack: i % 300, fedAgo: 123 })))).length / 1024;
eq(kb < 170, true, `1000 creatures take about ${(kb / 2).toFixed(0)} KB in the save`);
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
