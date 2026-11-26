// usage: node tests/rules.test.js Shardfall_v0.16.html  — runs the pure rules module (the <script> that defines SF) with no browser
const fs = require('fs'); const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.16.html', 'utf8');
const src = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(t => t.includes('SF.METALS'));
const m = { exports: {} }; new Function('module', 'globalThis', src)(m, {}); const SF = m.exports;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, a, '!=', b); } else console.log('ok  ', msg); };
const near = (a, b, msg) => eq(Math.abs(a - b) < 1e-9, true, msg + ` (${a} ≈ ${b})`);
const seq = arr => { let i = 0; return () => arr[i++ % arr.length]; };
const ch = (skills) => { const c = { id: 'p1', name: 'Tess', skills: SF.newSkills(), pack: SF.newContainer('pack') }; for (const k in skills) c.skills[k].v = skills[k] * 10; return c; };
const cap = { slots: 45, kg: 999 };
// worked smith roll §4
let c = ch({ smithing: 80 }); SF.addItem(c.pack, SF.newItem('ingot_copper', 3)); SF.addItem(c.pack, SF.newItem('strap', 1));
let p = SF.craftPlan(c, c.pack, SF.RECIPE.sword, 'copper');
eq([p.effMin, p.diff], [50, 65], 'copper sword effMin/diff'); near(p.chance, .7375, 'copper sword success'); near(p.exc, .20, 'exceptional conditional'); near(p.perExc, .1475, 'per-attempt exceptional');
let r = SF.craftAttempt(c, c.pack, p, seq([.1, .9]), cap, {}); eq([r.success, r.exceptional, r.items[0].omax, r.items[0].maxc, r.items[0].material, r.items[0].maker], [true, false, 110, 110, 'copper', undefined], 'normal copper sword 110/110');
eq(SF.itemName(r.items[0]), 'Copper Quay sword', 'display name');
c = ch({ smithing: 80 }); SF.addItem(c.pack, SF.newItem('ingot_copper', 3)); SF.addItem(c.pack, SF.newItem('strap', 1)); p = SF.craftPlan(c, c.pack, SF.RECIPE.sword, 'copper');
r = SF.craftAttempt(c, c.pack, p, seq([.1, .1]), cap, { mark: true }); eq([r.exceptional, r.items[0].omax, r.items[0].maker], [true, 121, undefined], 'exceptional 121/121, mark hidden at 80');
c = ch({ smithing: 80 }); SF.addItem(c.pack, SF.newItem('ingot_copper', 3)); SF.addItem(c.pack, SF.newItem('strap', 1)); p = SF.craftPlan(c, c.pack, SF.RECIPE.sword, 'copper');
r = SF.craftAttempt(c, c.pack, p, seq([.9]), cap, {}); eq([r.success, SF.count(c.pack, 'ingot_copper'), SF.count(c.pack, 'strap')], [false, 2, 0], 'failure costs 1 copper + 1 strap');
c = ch({ smithing: 80 }); SF.addItem(c.pack, SF.newItem('ingot_copper', 2)); SF.addItem(c.pack, SF.newItem('ingot_golden', 1)); SF.addItem(c.pack, SF.newItem('strap', 1));
p = SF.craftPlan(c, c.pack, SF.RECIPE.sword, 'copper'); eq(p.ok, false, '2 copper + 1 golden cannot make a copper sword');
eq(SF.count(c.pack, 'ironbar'), 0, 'ironbar count ignores coloured ingots');
// S6 odds
c = ch({ smithing: 100 }); const gb = { id: 'gb', out: 'sword', qty: 1, skill: 'smithing', min: 95, prim: 'metal', defMat: 'iron', lines: [{ form: 'ingot', qty: 8 }] };
p = SF.craftPlan(c, c.pack, gb, 'valorite'); near(p.chance, .55, 'S6 success 55%'); near(p.exc, .15, 'S6 exceptional 15%'); near(p.perExc, .0825, 'S6 8.25% per attempt');
// iron compatibility
c = ch({ smithing: 30 }); SF.addItem(c.pack, SF.newItem('ironbar', 3)); SF.addItem(c.pack, SF.newItem('strap', 1)); p = SF.craftPlan(c, c.pack, SF.RECIPE.sword);
eq([p.mat, p.diff, p.lines.map(l => l.id + ':' + l.qty)], ['iron', 35, ['ironbar:3', 'strap:1']], 'iron sword keeps authored diff and costs');
r = SF.craftAttempt(c, c.pack, p, seq([0]), cap, {}); eq([SF.count(c.pack, 'ironbar'), SF.count(c.pack, 'strap'), r.items[0].omax], [0, 0, 100], 'iron sword consumes 3 bars + strap');
// rivets and hinges
c = ch({ smithing: 0 }); SF.addItem(c.pack, SF.newItem('ironbar', 2)); p = SF.craftPlan(c, c.pack, SF.RECIPE.rivets);
eq([p.diff, p.ok], [15, true], 'rivets at smithing 0'); near(p.chance, .3625, 'rivet chance at 0');
r = SF.craftAttempt(c, c.pack, p, seq([0]), cap, {}); eq([SF.countMat(c.pack, 'rivet', 'iron'), r.items[0].material], [8, 'iron'], '8 iron rivets');
c.skills.smithing.v = 100; p = SF.craftPlan(c, c.pack, SF.RECIPE.hinges, 'iron'); r = SF.craftAttempt(c, c.pack, p, seq([0]), cap, {}); eq([SF.countMat(c.pack, 'rivet', 'iron'), SF.countMat(c.pack, 'hinge', 'iron')], [4, 2], 'hinges take 4 matching rivets');
SF.addItem(c.pack, SF.newItem('rivet', 4, { material: 'copper' })); eq(c.pack.items.filter(i => i.id === 'rivet').length, 2, 'copper rivets stack apart from iron');
// smelting gates
c = ch({ mining: 64.9 }); p = SF.craftPlan(c, c.pack, SF.RECIPE.smelt_dull_copper); eq(p.ok, false, '64.9 cannot smelt dull copper');
eq([SF.strokeMaterial('mining', 'dull_copper', 64.9, () => 0), SF.strokeMaterial('mining', 'dull_copper', 65, () => 0)], ['iron', 'dull_copper'], '65.0 Mining gate for Dull Copper');
eq([SF.strokeMaterial('mining', 'copper', 74.9, () => 0), SF.strokeMaterial('mining', 'copper', 75, () => 0)], ['iron', 'copper'], '75.0 for Copper');
eq([SF.strokeMaterial('mining', 'valorite', 98.9, () => 0), SF.strokeMaterial('mining', 'valorite', 99, () => 0)], ['iron', 'valorite'], '99.0 for Valorite');
eq([SF.strokeMaterial('woodcutting', 'frostwood', 99.9, () => 0), SF.strokeMaterial('woodcutting', 'frostwood', 100, () => 0)], ['pine', 'frostwood'], '100.0 for GM woods');
// repair
const it = { id: 'sword', qty: 1, cond: 32, maxc: 100 }; SF.repair(it); eq([it.cond, it.maxc], [97, 97], 'repair 32/100 → 97/97');
const ex = { id: 'sword', qty: 1, cond: 32, maxc: 121, omax: 121 }; SF.repair(ex); eq([ex.cond, ex.maxc], [117, 117], 'exceptional 32/121 → 117/117');
eq(SF.repairPlan({ id: 'sword', qty: 1, cond: 10, maxc: 42 }).ok, false, 'reject 42 → 39 under 40');
eq(SF.repairPlan({ id: 'sword', qty: 1, cond: 97, maxc: 97 }).ok, false, 'reject full condition');
// capacity
c = ch({ smithing: 50 }); SF.addItem(c.pack, SF.newItem('ironbar', 1)); p = SF.craftPlan(c, c.pack, SF.RECIPE.rivets);
r = SF.craftAttempt(c, c.pack, p, seq([.99]), { slots: 45, kg: .7 }, {}); eq([r.ok, r.free, SF.count(c.pack, 'ironbar')], [false, true, 1], 'insufficient post-exchange capacity costs nothing');
// tool uses
c = ch({}); SF.addItem(c.pack, SF.newItem('pickaxe', 1)); const pk = SF.findTool(c.pack, 'pickaxe'); for (let i = 0; i < 99; i++) SF.spendTool(c.pack, pk); eq([pk.uses, SF.count(c.pack, 'pickaxe')], [1, 1], '99 uses spent'); SF.spendTool(c.pack, pk); eq(SF.count(c.pack, 'pickaxe'), 0, 'tool breaks at 0');
// mass multiplier
eq(+SF.itemKg({ id: 'sword', qty: 1, kgMul: .8 }).toFixed(2), 2, 'golden sword is 0.8 × mass');
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
