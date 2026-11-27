// usage: node tests/inventory.test.js Shardfall_v0.28.3.html — inventory conservation regressions from the v0.28.1 audit (A01, A02)
const fs = require('fs'); const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.28.3.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const g = {}; const m = { exports: {} };
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.METALS')))(m, g); g.SF = m.exports;
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.MAGERY = MG')))({}, g);
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.EQ = EQ')))({}, g);
const SF = g.SF, EQ = SF.EQ;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };
const snap = cs => JSON.stringify(cs.map(c => ({ items: c.items, ver: c.ver })));
const mk = () => { const c = { id: 'p1', name: 'Aldric', str: 60, dex: 50, int: 40, skills: SF.newSkills(), pack: SF.newContainer('pack'), bank: SF.newContainer('bank'), equip: {} }; for (const s of EQ.SLOT_IDS) c.equip[s] = null; return c; };

/* ---- A01: SF.transfer rejects bad quantities and changes nothing when it does ---- */
for (const q of [-3, 0, 1.5, NaN, Infinity, -Infinity, 2 ** 60, '3', 'x', true]) {
  const a = SF.newContainer('pack'), b = SF.newContainer('bank'), it = SF.newItem('gold', 10); a.items.push(it);
  const before = snap([a, b]), r = SF.transfer(a, b, it.uid, q);
  eq([r.ok, snap([a, b]) === before], [false, true], `transfer qty ${String(q)} is refused and nothing moves`);
}
{ // omitted quantity still means the whole stack
  const a = SF.newContainer('pack'), b = SF.newContainer('bank'), it = SF.newItem('gold', 10); a.items.push(it);
  const r = SF.transfer(a, b, it.uid); eq([r.ok, r.qty, SF.count(a, 'gold'), SF.count(b, 'gold')], [true, 10, 0, 10], 'transfer with no quantity moves the whole stack');
  const a2 = SF.newContainer('pack'), b2 = SF.newContainer('bank'), it2 = SF.newItem('gold', 10); a2.items.push(it2);
  const r2 = SF.transfer(a2, b2, it2.uid, null); eq([r2.ok, SF.count(b2, 'gold')], [true, 10], 'null quantity also means the whole stack');
}
{ // a valid partial move conserves units
  const a = SF.newContainer('pack'), b = SF.newContainer('bank'), it = SF.newItem('gold', 10); a.items.push(it);
  const r = SF.transfer(a, b, it.uid, 4); eq([r.ok, SF.count(a, 'gold'), SF.count(b, 'gold')], [true, 6, 4], 'partial move 4 of 10');
  const r2 = SF.transfer(a, b, it.uid, 99); eq([r2.ok, r2.qty, SF.count(a, 'gold'), SF.count(b, 'gold')], [true, 6, 0, 10], 'asking for more than the stack moves the stack, never more');
}
{ // same container: refused, the stack survives
  const a = SF.newContainer('pack'), it = SF.newItem('gold', 10); a.items.push(it);
  const before = snap([a]), r = SF.transfer(a, a, it.uid, 10);
  eq([r.ok, SF.count(a, 'gold'), snap([a]) === before], [false, 10, true], 'moving a stack into its own container is refused and keeps it');
}
{ // a non-stackable item cannot be split by a transfer
  const a = SF.newContainer('pack'), b = SF.newContainer('bank'), it = SF.newItem('sword', 1); a.items.push(it);
  eq(SF.transfer(a, b, it.uid, 1).ok, true, 'a sword moves whole');
  const c = SF.newContainer('pack'), bad = SF.newItem('sword', 3); c.items.push(bad); const before = snap([c, b]);
  const r = SF.transfer(c, b, bad.uid, 1); eq([r.ok, snap([c, b]) === before], [false, true], 'a non-stackable item is never split');
}
{ // malformed items are refused before anything changes
  for (const [lbl, it] of [['unknown id', { uid: 900001, id: 'no_such_item', qty: 1 }], ['negative qty', { uid: 900002, id: 'gold', qty: -5 }], ['fraction qty', { uid: 900003, id: 'gold', qty: 2.5 }]]) {
    const a = SF.newContainer('pack'), b = SF.newContainer('bank'); a.items.push(it); const before = snap([a, b]);
    const r = SF.transfer(a, b, it.uid); eq([r.ok, snap([a, b]) === before], [false, true], 'malformed item (' + lbl + ') is refused');
  }
}
{ // stale version still refused, and the capacity check still holds
  const a = SF.newContainer('pack'), b = SF.newContainer('bank'), it = SF.newItem('ore', 10); a.items.push(it);
  eq(SF.transfer(a, b, it.uid, 1, { fromVer: a.ver + 1 }).ok, false, 'stale version refused');
  const before = snap([a, b]); const r = SF.transfer(a, b, it.uid, 10, { cap: { slots: Infinity, kg: 0.1 } });
  eq([r.ok, snap([a, b]) === before], [false, true], 'too heavy: refused, nothing moves');
}
// EQ wrappers inherit the checks
{ const c = mk(), it = SF.newItem('gold', 10); c.pack.items.push(it); const box = SF.newContainer('corpse'); box.items.push(SF.newItem('gold', 5));
  eq(EQ.moveItem(c.pack, c.bank, { uid: it.uid, qty: -3 }).ok, false, 'EQ.moveItem refuses a negative quantity');
  eq(EQ.pickupItem(c, box, { uid: box.items[0].uid, qty: 1.5 }).ok, false, 'EQ.pickupItem refuses a fractional quantity');
  eq([SF.count(c.pack, 'gold'), SF.count(c.bank, 'gold'), SF.count(box, 'gold')], [10, 0, 5], 'gold conserved after refused moves'); }

/* ---- A02: dropItem never publishes an item the audit would reject ---- */
{ // the same uid in pack and bank: the drop is refused and the world receives nothing
  const c = mk(); const it = SF.newItem('gold', 10); c.pack.items.push(it); c.bank.items.push(Object.assign({}, it));
  const world = []; const r = EQ.dropItem(c, { uid: it.uid }, i => { world.push(i); return true; });
  eq([r.ok, world.length, c.pack.items.length, c.bank.items.length], [false, 0, 1, 1], 'drop of an item whose uid is also in the bank is refused before the world sees it');
}
{ // an unrelated duplicate elsewhere: no world side effect while the pack rolls back
  const c = mk(); const keep = SF.newItem('ore', 3); c.pack.items.push(keep); c.bank.items.push(Object.assign({}, keep)); // pre-existing bad data
  const drop = SF.newItem('gold', 10); c.pack.items.push(drop);
  const world = []; const r = EQ.dropItem(c, { uid: drop.uid }, i => { world.push(i); return true; });
  const units = (r.ok ? world.length : 0) + c.pack.items.filter(i => i.uid === drop.uid).length;
  eq([units, world.length === 0 || !c.pack.items.some(i => i.uid === drop.uid)], [1, true], 'the dropped stack exists exactly once (world or pack, never both)');
}
{ // a refused placement leaves the pack exactly as it was and the world empty
  const c = mk(); const it = SF.newItem('gold', 10); c.pack.items.push(it); const before = snap([c.pack]);
  const r = EQ.dropItem(c, { uid: it.uid, qty: 4 }, () => false);
  eq([r.ok, SF.count(c.pack, 'gold'), JSON.stringify(c.pack.items) === JSON.stringify(JSON.parse(before)[0].items)], [false, 10, true], 'a drop that cannot be placed is undone, split included');
}
{ // bad drop quantities
  for (const q of [-3, 0, 1.5, NaN, Infinity]) { const c = mk(); const it = SF.newItem('gold', 10); c.pack.items.push(it); const world = [];
    const r = EQ.dropItem(c, { uid: it.uid, qty: q }, i => { world.push(i); return true; });
    eq([r.ok, world.length, SF.count(c.pack, 'gold')], [false, 0, 10], `drop qty ${String(q)} is refused`); }
  const c = mk(); const it = SF.newItem('gold', 10); c.pack.items.push(it); const world = [];
  const r = EQ.dropItem(c, { uid: it.uid, qty: 4 }, i => { world.push(i); return true; });
  eq([r.ok, world.length, world[0] && world[0].qty, SF.count(c.pack, 'gold')], [true, 1, 4, 6], 'a valid partial drop splits 4 off');
  eq(EQ.audit(c, [{ items: world }]).ok, true, 'audit across pack, bank and the world pile passes');
}
{ // a placement callback that throws is undone too
  const c = mk(); const it = SF.newItem('gold', 10); c.pack.items.push(it);
  const r = EQ.dropItem(c, { uid: it.uid }, () => { throw new Error('boom'); });
  eq([r.ok, SF.count(c.pack, 'gold')], [false, 10], 'a placement that throws is undone');
}
{ // the audit now checks item shape, not only duplicate uids
  const c = mk(); c.pack.items.push({ uid: 5, id: 'gold', qty: -1 }); eq(EQ.audit(c).ok, false, 'audit flags a negative quantity');
  const c2 = mk(); c2.pack.items.push({ uid: 6, id: 'gold', qty: 1.5 }); eq(EQ.audit(c2).ok, false, 'audit flags a fractional quantity');
  const c3 = mk(); c3.pack.items.push({ uid: 7, id: 'nope', qty: 1 }); eq(EQ.audit(c3).ok, false, 'audit flags an unknown item');
  const c4 = mk(); c4.pack.items.push({ uid: 'x', id: 'gold', qty: 1 }); eq(EQ.audit(c4).ok, false, 'audit flags a bad uid');
  const c5 = mk(); c5.pack.items.push(SF.newItem('gold', 3)); eq(EQ.audit(c5).ok, true, 'a clean pack passes');
}
{ // legacy bad data elsewhere does not lock up unrelated commands that create no new problem
  const c = mk(); c.bank.items.push({ uid: 8, id: 'gold', qty: 2.5 }); const sw = SF.newItem('sword', 1); c.pack.items.push(sw);
  const r = EQ.equipItem(c, { uid: sw.uid }); eq([r.ok, c.equip.weapon === sw], [true, true], 'an equip still works beside an old malformed bank record');
}
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
