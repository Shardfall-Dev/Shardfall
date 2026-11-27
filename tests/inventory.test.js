// usage: node tests/inventory.test.js Shardfall_v0.28.2.html — inventory conservation regressions (audit v0.28.1 A01, A02), no browser
const fs = require('fs'); const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.28.2.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const g = {}; const m = { exports: {} };
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.METALS')))(m, g); g.SF = m.exports;
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.MAGERY = MG')))({}, g);
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.EQ = EQ')))({}, g);
const SF = g.SF, EQ = SF.EQ;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };
const mk = () => { const c = { id: 'p1', name: 'Aldric', str: 60, dex: 50, int: 40, skills: SF.newSkills(), pack: SF.newContainer('pack'), bank: SF.newContainer('bank'), equip: {} }; for (const s of EQ.SLOT_IDS) c.equip[s] = null; return c; };
const snap = (...cs) => JSON.stringify(cs.map(c => c.items));
const units = (...cs) => { const u = SF.unitsOf(cs), o = {}; for (const k of Object.keys(u).sort()) o[k] = u[k]; return o; };
const uids = (...cs) => { const out = []; const see = it => { out.push(it.uid); (it.items || []).forEach(see); }; cs.forEach(c => c.items.forEach(see)); return out; };
const noDupUid = (...cs) => { const u = uids(...cs); return new Set(u).size === u.length; };

/* ---------- A01: SF.transfer rejects invalid quantities and never mutates on error ---------- */
for (const [q, name] of [[-3, 'negative'], [0, 'zero'], [1.5, 'fraction'], [NaN, 'NaN'], [Infinity, 'Infinity'], [-Infinity, '-Infinity'], [2 ** 60, 'huge integer'], [11, 'more than the stack'], ['3', 'numeric string'], [null, 'null'], [true, 'boolean']]) {
  const a = SF.newContainer('pack'), b = SF.newContainer('bank'); const it = SF.newItem('gold', 10); a.items.push(it);
  const before = snap(a, b), va = a.ver, vb = b.ver; const r = SF.transfer(a, b, it.uid, q);
  eq([r.ok, snap(a, b), a.ver, b.ver], [false, before, va, vb], `transfer ${name} quantity is refused with no change`);
}
{ const a = SF.newContainer('pack'), b = SF.newContainer('bank'); const it = SF.newItem('gold', 10); a.items.push(it);
  const r = SF.transfer(a, b, it.uid); eq([r.ok, r.qty, SF.count(a, 'gold'), SF.count(b, 'gold')], [true, 10, 0, 10], 'omitted quantity moves the whole stack'); }
{ const a = SF.newContainer('pack'), b = SF.newContainer('bank'); const it = SF.newItem('gold', 10); a.items.push(it);
  const r = SF.transfer(a, b, it.uid, 4); eq([r.ok, r.qty, SF.count(a, 'gold'), SF.count(b, 'gold'), noDupUid(a, b)], [true, 4, 6, 4, true], 'partial move of 4 conserves units and makes a new uid'); }
{ const a = SF.newContainer('pack'); const it = SF.newItem('gold', 10); a.items.push(it); const before = snap(a);
  const r = SF.transfer(a, a, it.uid, 10); eq([r.ok, snap(a), SF.count(a, 'gold')], [false, before, 10], 'moving a full stack into its own container keeps it');
  const r2 = SF.transfer(a, a, it.uid, 3); eq([r2.ok, snap(a)], [false, before], 'moving part of a stack into its own container changes nothing'); }
{ const a = SF.newContainer('pack'), b = SF.newContainer('bank'); const sw = SF.newItem('sword', 1); a.items.push(sw); const before = snap(a, b);
  eq([SF.transfer(a, b, sw.uid, 2).ok, snap(a, b)], [false, before], 'cannot move 2 of a single sword'); }
{ const a = SF.newContainer('pack'), b = SF.newContainer('bank'); const bad = { uid: 777001, id: 'no_such_item', qty: 1 }; a.items.push(bad); const before = snap(a, b);
  eq([SF.transfer(a, b, bad.uid).ok, snap(a, b)], [false, before], 'an item with an unknown id is refused before mutation'); }
{ const a = SF.newContainer('pack'), b = SF.newContainer('bank'); const bad = { uid: 777002, id: 'gold', qty: 2.5 }; a.items.push(bad); const before = snap(a, b);
  eq([SF.transfer(a, b, bad.uid).ok, snap(a, b)], [false, before], 'a stored fractional quantity is refused before mutation'); }
{ const a = SF.newContainer('pack'), b = SF.newContainer('bank'); const it = SF.newItem('gold', 10); a.items.push(it); const v = a.ver; const before = snap(a, b);
  eq([SF.transfer(a, b, it.uid, 5, { fromVer: v + 1 }).ok, snap(a, b)], [false, before], 'stale version is refused');
  eq(SF.transfer(a, b, it.uid, 5, { fromVer: v }).ok, true, 'current version is accepted'); }
{ const a = SF.newContainer('pack'), b = SF.newContainer('bank'); const it = SF.newItem('ore', 50); a.items.push(it); const before = snap(a, b);
  const r = SF.transfer(a, b, it.uid, 50, { cap: { slots: 45, kg: 1 } }); eq([r.ok, snap(a, b)], [false, before], 'over-capacity transfer changes nothing'); }
// fuzz: random valid and invalid moves between three containers conserve every unit and never duplicate a uid
{ let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cs = [SF.newContainer('pack'), SF.newContainer('bank'), SF.newContainer('pile')]; cs[0].items.push(SF.newItem('gold', 500), SF.newItem('arrow', 200), SF.newItem('sword', 1), SF.newItem('ore', 40));
  const start = units(...cs); const qs = [undefined, 1, 2, 7, 0, -1, 1.5, NaN, 1e9, 3];
  for (let i = 0; i < 4000; i++) { const f = cs[Math.floor(rnd() * 3)], t = cs[Math.floor(rnd() * 3)]; if (!f.items.length) continue; const it = f.items[Math.floor(rnd() * f.items.length)]; SF.transfer(f, t, it.uid, qs[Math.floor(rnd() * qs.length)]); }
  const allOk = cs.every(c => c.items.every(it => Number.isSafeInteger(it.qty) && it.qty >= 1));
  eq([units(...cs), noDupUid(...cs), allOk], [start, true, true], '4000 random transfers conserve units, uids and integer quantities'); }

/* ---------- A02: dropItem publishes to the world only after validation, and audit sees every container ---------- */
{ const ch = mk(); ch.pack.items.push(SF.newItem('gold', 10)); ch.bank.items.push(Object.assign({}, ch.pack.items[0])); const world = [];
  const before = snap(ch.pack, ch.bank); const r = EQ.dropItem(ch, { uid: ch.pack.items[0].uid }, i => { world.push(i); return true; });
  eq([r.ok, world.length, snap(ch.pack, ch.bank)], [false, 0, before], 'drop of an item whose uid is also in the bank is refused and nothing reaches the world'); }
{ const ch = mk(); const keep = SF.newItem('arrow', 5); ch.pack.items.push(SF.newItem('gold', 10), keep); ch.bank.items.push(Object.assign({}, keep)); const world = [];
  const gold = ch.pack.items[0]; const r = EQ.dropItem(ch, { uid: gold.uid }, i => { world.push(i); return true; });
  const inPack = ch.pack.items.includes(gold), inWorld = world.includes(gold);
  eq([inPack && inWorld, r.ok === inWorld, r.ok === !inPack], [false, true, true], 'unrelated duplicate elsewhere never leaves the dropped item in both pack and world'); }
{ const ch = mk(); ch.pack.items.push(SF.newItem('gold', 10)); const world = []; const uid = ch.pack.items[0].uid;
  const r = EQ.dropItem(ch, { uid }, i => { world.push(i); return true; }); eq([r.ok, world.length, ch.pack.items.length, EQ.audit(ch, [{ items: world }]).ok], [true, 1, 0, true], 'a clean drop moves the item to the world exactly once'); }
{ const ch = mk(); ch.pack.items.push(SF.newItem('gold', 10)); const world = []; let calls = 0;
  const r = EQ.dropItem(ch, { uid: ch.pack.items[0].uid, qty: 4 }, i => { calls++; world.push(i); return true; });
  eq([r.ok, calls, SF.count(ch.pack, 'gold'), world[0].qty, noDupUid(ch.pack, { items: world })], [true, 1, 6, 4, true], 'partial drop splits with a fresh uid and calls place once'); }
for (const [q, name] of [[-3, 'negative'], [0, 'zero'], [1.5, 'fraction'], [NaN, 'NaN'], [Infinity, 'Infinity'], [11, 'more than held']]) {
  const ch = mk(); ch.pack.items.push(SF.newItem('gold', 10)); let calls = 0; const before = snap(ch.pack);
  const r = EQ.dropItem(ch, { uid: ch.pack.items[0].uid, qty: q }, () => { calls++; return true; }); eq([r.ok, calls, snap(ch.pack)], [false, 0, before], `drop with ${name} quantity is refused before the world is touched`); }
{ const ch = mk(); ch.pack.items.push(SF.newItem('gold', 10)); const before = snap(ch.pack);
  const r = EQ.dropItem(ch, { uid: ch.pack.items[0].uid }, () => { throw new Error('boom'); }); eq([r.ok, snap(ch.pack)], [false, before], 'a placement that throws undoes the drop'); }
{ const ch = mk(); const sw = SF.newItem('sword', 1); ch.equip.weapon = sw; const world = [];
  const r = EQ.dropItem(ch, { uid: sw.uid }, i => { world.push(i); return true; }); eq([r.ok, ch.equip.weapon, world[0] === sw], [true, null, true], 'dropping a worn weapon clears the slot'); }
// audit validates shape, not just duplicates
{ const ch = mk(); ch.pack.items.push({ uid: 5001, id: 'gold', qty: 1.5 }); eq(EQ.audit(ch).ok, false, 'audit flags a fractional quantity'); }
{ const ch = mk(); ch.pack.items.push({ uid: 5002, id: 'gold', qty: 0 }); eq(EQ.audit(ch).ok, false, 'audit flags a zero quantity'); }
{ const ch = mk(); ch.pack.items.push({ uid: 5003, id: 'nope', qty: 1 }); eq(EQ.audit(ch).ok, false, 'audit flags an unknown item id'); }
{ const ch = mk(); ch.pack.items.push({ uid: 'x', id: 'gold', qty: 1 }); eq(EQ.audit(ch).ok, false, 'audit flags a non-integer uid'); }
{ const ch = mk(); ch.pack.items.push(SF.newItem('gold', 3)); ch.bank.items.push(SF.newItem('gold', 4)); ch.equip.weapon = SF.newItem('sword', 1); eq(EQ.audit(ch).ok, true, 'a clean character passes the audit'); }
// existing commands still refuse to create new duplicates but are not blocked by an unrelated earlier problem
{ const ch = mk(); const sw = SF.newItem('sword', 1); const dupe = SF.newItem('arrow', 3); ch.pack.items.push(sw, dupe); ch.bank.items.push(Object.assign({}, dupe));
  const r = EQ.equipItem(ch, { uid: sw.uid }); eq([r.ok, ch.equip.weapon === sw], [true, true], 'equipping is not blocked by an unrelated duplicate in the bank'); }
// normalize repairs duplicate uids and bad quantities without losing items (used when a save loads)
{ const ch = mk(); const a = SF.newItem('gold', 10); ch.pack.items.push(a); ch.bank.items.push(Object.assign({}, a)); ch.pack.items.push({ uid: 9901, id: 'arrow', qty: 2.7 }, { uid: 9902, id: 'arrow', qty: -1 });
  const r = EQ.normalize(ch); eq([r.reassigned, r.fixedQty, r.removed, noDupUid(ch.pack, ch.bank), SF.count(ch.pack, 'gold') + SF.count(ch.bank, 'gold'), SF.count(ch.pack, 'arrow'), EQ.audit(ch).ok], [1, 1, 1, true, 20, 2, true], 'normalize gives duplicates fresh uids, floors fractions and drops empty stacks'); }
{ const ch = mk(); ch.pack.items.push(SF.newItem('gold', 10)); const before = snap(ch.pack); const r = EQ.normalize(ch); eq([r.reassigned + r.fixedQty + r.removed, snap(ch.pack)], [0, before], 'normalize leaves a clean character untouched'); }

console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
