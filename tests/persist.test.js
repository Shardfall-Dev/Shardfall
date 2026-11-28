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

// ---- phase 6 step 2 (v0.43): creature remains, merchant cargo, the phone back buffer
{
  const ok = { validType: t => ['wolf', 'rat'].includes(t), validItem: it => ['hide', 'gold'].includes(it.id) };
  const rows = [
    { key: 'r1@5', type: 'wolf', x: 1, y: 2, left: 100, items: [{ id: 'hide', qty: 2, uid: 7 }, { id: 'ghost', qty: 1, uid: 8 }], skinned: 1 },
    { key: 'r1@5', type: 'wolf', x: 1, y: 2, left: 100, items: [] },
    { key: 'r2@6', type: 'dragon', x: 1, y: 2, left: 100, items: [] },
    { key: 'r3@6', type: 'rat', x: 1, y: 2, left: 0, items: [] },
    { key: 'r4@6', type: 'rat', x: 'a', y: 2, left: 5, items: [] },
    { key: 'r5@6', type: 'rat', x: 1, y: 2, left: 5, items: null },
    7,
    { key: 'r6@9', type: 'rat', x: 3, y: 4, left: 9, items: [{ id: 'gold', qty: 3, uid: 9 }] }];
  const r = SIM.remainsRows(rows, ok);
  eq(r.rows.map(x => x.key), ['r1@5', 'r6@9'], 'remains: one row per key, the valid ones');
  eq(r.rows[0].items.map(i => i.id), ['hide'], 'remains: unknown items dropped');
  eq(r.rows[0].skinned, true, 'remains: the carving state is kept');
  eq(r.dropped, { duplicate: 1, species: 1, number: 2, items: 1, shape: 1 }, 'remains: every bad row counted');
  eq(SIM.remainsRows(rows, Object.assign({ max: 1 }, ok)).rows.length, 1, 'remains: at most `max` rows');
  eq(SIM.remainsRows(undefined, ok).rows, [], 'remains: an older save has none');
}
{
  const prices = { bandage: 2, arrow: 1, hatchet: 25, pickaxe: 30, cloth: 3, ironbar: 12, none: 0 };
  const c = SIM.traderCargo(Object.keys(prices), prices, () => .5, 160), v = c.reduce((a, x) => a + prices[x.id] * x.qty, 0);
  eq(c.length > 0 && c.length <= 6 && v <= 160 && v > 60, true, `cargo: goods worth ${v} of 160 gold, at most six kinds`);
  eq(c.every(x => prices[x.id] > 0 && x.qty > 0), true, 'cargo: only goods with a price, never zero');
  eq(c[0].id, 'pickaxe', 'cargo: the dearest goods first');
  eq(JSON.stringify(SIM.traderCargo(Object.keys(prices), prices, () => .5, 160)) === JSON.stringify(c), true, 'cargo: the same draws give the same cargo');
  eq(SIM.traderCargo([], prices, Math.random), [], 'cargo: nothing to carry, nothing carried');
}
{
  const B = SIM.backBuffer, o = { budget: 600000, phone: true };
  eq(B(1280, 720, 1, .7, { budget: 600000, phone: false }), 1, 'back buffer: a desktop keeps the whole number (not a phone)');
  eq(B(1440, 900, 2, .7, { budget: 600000, phone: false }), 1, 'back buffer: a retina desktop keeps the whole number as before');
  eq(B(390, 844, 1, .7, o), 1, 'back buffer: a pixel-ratio-1 phone within budget keeps 1');
  const d2 = B(390, 844, 2, .7, o), d3 = B(390, 844, 3, .7, o);
  eq(d2 > 1.4 && 390 * 844 * 4 / (d2 * d2) <= 600001, true, `back buffer: a pixel-ratio-2 phone fits the budget (d ${d2.toFixed(2)}, was 1)`);
  eq(d3 >= 2 && 390 * 844 * 9 / (d3 * d3) <= 600001, true, `back buffer: a pixel-ratio-3 phone fits the budget (d ${d3.toFixed(2)}, was 2)`);
  eq(B(390, 844, 2, .7, { budget: 0, phone: true }), 1, 'back buffer: no budget (?bb=full) keeps the old divisor');
  eq(B(844, 390, 3, .5, o) >= 1.5, true, 'back buffer: the zoom setting still counts');
}
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
