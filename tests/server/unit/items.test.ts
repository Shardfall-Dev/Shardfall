/* Server Items v1: item commands on the shared rules, remains (creature loot, a dead character's body, dropped piles), wear,
   arrows, identities and the saved rows. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path = require('node:path');
import COL = require('../../../shared/collision');
import MV = require('../../../shared/movement');
import P = require('../../../shared/protocol');
import adapter = require('../../../shared/game-rules-adapter');
import { loadTerrain } from '../../../server/src/world/terrain';
import { loadPopulation, worldClock, CLOCK_EPOCH_MS } from '../../../server/src/world/creatures';
import { rollLoot, rowsOf, allItems, ITEMS, wear } from '../../../server/src/world/items';
import { World, type Actor } from '../../../server/src/world/world';

const ROOT = path.join(__dirname, '..', '..', '..');
const T = loadTerrain(ROOT); const DATA = loadPopulation(ROOT, T); const SIM = adapter.loadSim();
const R = adapter.load(); const SF = R.SF; const CR = SF.CREATION;
let n = 0;
function fighter(skills: [string, number][] = [['swordsmanship', 50], ['tactics', 30], ['healing', 20]], stats = { str: 45, dex: 25, int: 10 }) {
  const v = R.validateCreation({ name: 'Tess', look: CR.defaultLook('male'), ...stats, skills, town: 'quay' }); const b = R.buildCharacter(v.value);
  return R.characterFromRows({ name: b.name, str: b.str, dex: b.dex, int: b.int, skills: b.skills, stat_locks: b.statLocks, appearance: b.appearance },
    b.items.map(i => Object.assign({ id: '00000000-0000-4000-8000-' + String(++n).padStart(12, '0') }, i)));
}
const at = (hour: number) => () => CLOCK_EPOCH_MS + (((hour - 9) % 24 + 24) % 24) * 300_000;
function world(hour = 12) {
  const w = new World(T, { creatures: { data: DATA, sim: SIM, clock: worldClock(SIM, at(hour)), seed: 5 }, combat: { SF, seed: 9 } });
  const out: [Actor, string, any][] = []; const saved: string[] = []; w.setSink((a, t, p) => out.push([a, t, p])); w.onInventory = a => saved.push(a.characterId);
  return { w, out, saved };
}
const stand = (x: number, y: number) => COL.canStand(T.world, x, y) && !(DATA.ground[Math.floor(y) * T.world.W + Math.floor(x)] & 1);
function openPatch(r: number) {
  for (let y = 400; y < 1400; y += 7) for (let x = 700; x < 2500; x += 9) { let ok = true; for (let k = 0; k < 24 && ok; k++) { const a = k / 24 * 6.283; for (const d of [r * .33, r * .66, r]) ok = ok && stand(x + Math.cos(a) * d, y + Math.sin(a) * d); } if (ok) return { x, y }; }
  throw new Error('no open patch');
}
function join(w: World, name: string, x: number, y: number, ch = fighter(), extra: any = {}) {
  return w.add({ characterId: name, accountId: 'acc-' + name, realmId: 'realm', info: { characterId: name, name, body: 'male', appearance: {}, title: null, town: 'quay', equip: {} }, position: { x, y }, stam: SF.maxStam(ch), ctx: MV.ctxFor(SF, ch), ch, bound: 'quay', ...extra }).actor;
}
const pop = (w: World) => w.populations.get('realm')!;
const keyOf = (type: string) => DATA.spawners.find(o => o.type === type)!.key;
const last = (out: [Actor, string, any][], a: Actor, type: string) => [...out].reverse().find(m => m[0] === a && m[1] === type)?.[2];
const units = (items: any[]) => { const m: Record<string, number> = {}; for (const it of items) m[it.id] = (m[it.id] || 0) + it.qty; return m; };

test('protocol v5: item commands are validated; nothing but the server id, a slot, a quantity and the remains id is accepted', () => {
  const ok = (p: any) => P.parseClient(JSON.stringify({ v: P.PROTOCOL_VERSION, type: 'item', p }));
  const id = '11111111-1111-4111-8111-111111111111';
  assert.equal(P.PROTOCOL_VERSION, 5);
  for (const p of [{ op: 'equip', item: id }, { op: 'equip', item: id, slot: 'weapon' }, { op: 'unequip', slot: 'helm' }, { op: 'drop', item: id, qty: 3 }, { op: 'take', item: id, from: 9 }, { op: 'takeall', from: 9 }, { op: 'split', item: id, qty: 2 }, { op: 'merge', item: id, into: id }, { op: 'mergeall' }])
    assert.ok(ok(p).ok, JSON.stringify(p));
  for (const p of [{ op: 'give', item: id }, { op: 'equip', item: 'sword' }, { op: 'equip', item: 7 }, { op: 'drop', item: id, qty: 0 }, { op: 'drop', item: id, qty: 1.5 }, { op: 'take', item: id }, { op: 'equip', item: id, uid: 3 }, { op: 'equip', item: id, slot: 'Weapon!' }, { op: 'split', item: id }, { op: 'equip', item: id, gold: 5 }])
    assert.equal(ok(p).ok, false, JSON.stringify(p));
});

test('a character’s items get session uids and persistent ids; rows are what the world holds', () => {
  const { w } = world(); const o = openPatch(8); const a = join(w, 'Ids', o.x, o.y);
  const items = allItems(a.ch); assert.ok(items.length > 3);
  for (const it of items) { assert.ok(Number.isSafeInteger(it.uid) && it.uid > 0); assert.match(it.sid, /^[0-9a-f-]{36}$/); }
  assert.equal(new Set(items.map(i => i.uid)).size, items.length); assert.equal(new Set(items.map(i => i.sid)).size, items.length);
  const rows = rowsOf(a.ch); assert.equal(rows.length, items.length);
  for (const r of rows) { assert.equal('uid' in r.props, false); assert.equal('sid' in r.props, false); assert.ok(['pack', 'bank', 'equip'].includes(r.container)); assert.equal(r.container === 'equip', r.slot !== null); }
});

test('equip and unequip go through SF.EQ: the server answers with the inventory, saves at once, and others see the new look', () => {
  const { w, out, saved } = world(); const o = openPatch(8); const a = join(w, 'Dress', o.x, o.y); const b = join(w, 'Look', o.x + 2, o.y);
  const weapon = a.ch.equip.weapon; assert.ok(weapon, 'the kit armed the character');
  assert.equal(w.item('Dress', { op: 'unequip', slot: 'weapon' }), null);
  assert.equal(a.ch.equip.weapon, null); assert.ok(a.ch.pack.items.includes(weapon));
  const inv = last(out, a, 'inv'); assert.ok(inv && inv.pack.some((i: any) => i.id === weapon.sid) && inv.equip.weapon === null);
  assert.deepEqual(saved, ['Dress']);
  assert.ok(out.some(m => m[0] === b && m[1] === 'combat' && m[2].k === 'look' && m[2].t === a.nid), 'the other player sees the change');
  assert.equal(w.item('Dress', { op: 'equip', item: weapon.sid }), null); assert.equal(a.ch.equip.weapon, weapon);
  assert.match(w.item('Dress', { op: 'equip', item: '99999999-9999-4999-8999-999999999999' })!, /gone/);
  assert.match(w.item('Dress', { op: 'unequip', slot: 'nosuch' })!, /slot/);
  const none = a.ch.pack.items.find((i: any) => !SF.ITEMS[i.id].slot); if (none) assert.ok(w.item('Dress', { op: 'equip', item: none.sid }), 'a non-wearable item cannot be equipped');
});

test('drop makes a pile at your feet (one pile per spot), others see it, and taking it back conserves every unit', () => {
  const { w, out } = world(); const o = openPatch(8); const a = join(w, 'Drop', o.x, o.y); const b = join(w, 'Seer', o.x + 3, o.y); pop(w).clear();
  const before = units(allItems(a.ch));
  const stack = a.ch.pack.items.find((i: any) => SF.ITEMS[i.id].stack && i.qty >= 2 && SF.ITEMS[i.id].trade); assert.ok(stack, 'a tradeable stack in the starter kit');
  const q = stack.qty; assert.equal(w.item('Drop', { op: 'drop', item: stack.sid, qty: 1 }), null);
  assert.equal(stack.qty, q - 1); assert.equal(w.remains.size, 1); const pile = [...w.remains.values()][0];
  assert.equal(pile.pile, true); assert.equal(pile.cont.items[0].qty, 1); assert.notEqual(pile.cont.items[0].sid, stack.sid, 'the split-off unit has its own id');
  w.step(); assert.ok(out.some(m => m[0] === b && m[1] === 'actor.enter' && m[2].kind === 'remains' && m[2].nid === pile.nid && m[2].items.length === 1));
  const other = a.ch.pack.items.find((i: any) => SF.ITEMS[i.id].trade && i !== stack); assert.equal(w.item('Drop', { op: 'drop', item: other.sid }), null);
  assert.equal(w.remains.size, 1, 'the second drop joins the same pile'); assert.equal(pile.cont.items.length, 2);
  assert.ok(out.some(m => m[0] === b && m[1] === 'remains' && m[2].nid === pile.nid && m[2].items.length === 2), 'viewers get the new contents');
  assert.match(w.item('Seer', { op: 'take', from: pile.nid, item: pile.cont.items[0].sid })!, /within/, 'from 3 tiles away: too far');
  assert.equal(w.item('Drop', { op: 'takeall', from: pile.nid }), null);
  assert.deepEqual(units(allItems(a.ch)), before, 'every unit is back'); assert.equal(w.remains.size, 0, 'an emptied pile goes');
  assert.match(w.item('Drop', { op: 'takeall', from: pile.nid })!, /gone/);
  const notrade = allItems(a.ch).find((i: any) => !SF.ITEMS[i.id].trade); if (notrade) assert.ok(w.item('Drop', { op: 'drop', item: notrade.sid }), 'untradeable items cannot be dropped');
});

test('split and merge inside the backpack, and the capacity check on taking', () => {
  const { w } = world(); const o = openPatch(8); const a = join(w, 'Stack', o.x, o.y);
  const stack = a.ch.pack.items.find((i: any) => SF.ITEMS[i.id].stack && i.qty >= 3); assert.ok(stack);
  const q = stack.qty, n0 = a.ch.pack.items.length;
  assert.equal(w.item('Stack', { op: 'split', item: stack.sid, qty: 1 }), null); assert.equal(a.ch.pack.items.length, n0 + 1); assert.equal(stack.qty, q - 1);
  const piece = a.ch.pack.items.find((i: any) => i.id === stack.id && i !== stack); assert.ok(piece.sid && piece.sid !== stack.sid);
  assert.equal(w.item('Stack', { op: 'merge', item: piece.sid, into: stack.sid }), null); assert.equal(stack.qty, q); assert.equal(a.ch.pack.items.length, n0);
  assert.match(w.item('Stack', { op: 'split', item: stack.sid, qty: q })!, /split/i, 'splitting off everything is not a split');
  // a pile of iron bars far beyond what this character can carry: taking stops at the weight limit, nothing is lost
  pop(w).clear(); const heavy = SF.newItem('ironbar', 5000); assert.ok(SF.ITEMS.ironbar);
  const pile = (w as any).addRemains('realm', { name: 'dropped items', items: [heavy], x: a.s.x, y: a.s.y, sect: 0, life: 600, pile: true });
  const r = w.item('Stack', { op: 'take', from: pile.nid, item: heavy.sid });
  assert.ok(r, 'refused: too heavy'); assert.equal(pile.cont.items[0].qty, 5000, 'nothing taken, nothing lost');
});

test('a creature killed online leaves remains with its species’ loot; its killer can take it', () => {
  const { w } = world(12); const o = openPatch(12); const ch = fighter([['swordsmanship', 50], ['tactics', 50]], { str: 60, dex: 10, int: 10 }); const a = join(w, 'Looter', o.x, o.y, ch); pop(w).clear();
  let rem: any = null;
  for (let round = 0; round < 8 && !rem; round++) {
    const c = pop(w).spawnAt(keyOf('bandit'), a.s.x + .9, a.s.y) || pop(w).spawnAt(keyOf('orc'), a.s.x + .9, a.s.y); if (!c) continue;
    assert.equal(w.target('Looter', c.nid), null);
    for (let i = 0; i < 4000 && !c.dead && !a.ghost; i++) { c.s.x = a.s.x + .9; c.s.y = a.s.y; c.state = c.state === 'flee' ? 'stalk' : c.state; a.hp = 999; w.step(); }
    if (c.dead) rem = [...w.remains.values()].find(r => r.mon === c.type);
  }
  assert.ok(rem, 'remains appeared'); assert.equal(rem.owner, null); assert.equal(rem.killer, 'Looter');
  const d = DATA.species[rem.mon] as any;
  for (const it of rem.cont.items) { assert.ok(it.id in (d.loot || {}) || it.id === 'gold', it.id + ' is from the loot table'); const rg = d.loot[it.id] || [0, 1e9]; if (it.id !== 'gold') assert.ok(it.qty >= rg[0] && it.qty <= rg[1]); }
  assert.ok(Math.abs(rem.expires - w.now - (d.boss ? ITEMS.bossCorpseLife : ITEMS.corpseLife)) < 1);
  const before = units(allItems(ch)), loot = units(rem.cont.items);
  if (rem.cont.items.length) { assert.equal(w.item('Looter', { op: 'takeall', from: rem.nid }), null); for (const k in loot) assert.equal((units(allItems(ch))[k] || 0) - (before[k] || 0), loot[k], k); }
});

test('rollLoot follows the loot table, the purse and the gear wear state', () => {
  const rng = (() => { let s = 3; return () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
  for (let i = 0; i < 300; i++) for (const t of ['bandit', 'orc', 'boar', 'gargoyle']) {
    const d = DATA.species[t] as any; const items = rollLoot(SF, d, rng); const gold = items.filter(it => it.id === 'gold').reduce((s, it) => s + it.qty, 0);
    const g = (d.loot && d.loot.gold) || [0, 0], pu = d.purse || [0, 0]; assert.ok(gold >= 0 && gold <= g[1] + pu[1], t + ' gold ' + gold);
    for (const it of items) assert.ok(SF.ITEMS[it.id], it.id);
  }
});

test('death away from protected ground leaves a body with the tradeable belongings; only its owner can take them back', () => {
  const { w, out } = world(12); const o = openPatch(12); const a = join(w, 'Fallen', o.x, o.y); const b = join(w, 'Grave', o.x + 1, o.y); pop(w).clear();
  const tradeable = allItems(a.ch).filter((i: any) => SF.ITEMS[i.id].trade).length; assert.ok(tradeable > 0);
  (w as any).damagePlayer(a, 9999, 'test');
  assert.ok(a.ghost); const body = [...w.remains.values()].find(r => r.owner === 'Fallen')!; assert.ok(body, 'a body');
  assert.equal(body.cont.items.length, tradeable); assert.ok(allItems(a.ch).some((i: any) => i.id === 'garment') || a.ch.equip.armor, 'the garment stays');
  assert.ok(Math.abs(body.expires - w.now - SF.CORPSE_LIFE) < 1);
  assert.ok(last(out, a, 'inv'), 'the owner is told'); assert.match(w.item('Fallen', { op: 'takeall', from: body.nid })!, /Ghosts/);
  assert.match(w.item('Grave', { op: 'takeall', from: body.nid })!, /only they/, 'someone else cannot loot it online');
  for (let i = 0; i < 260; i++) w.step(); assert.equal(w.resurrect('Fallen', 'bound'), null);
  a.s.x = body.s.x + .5; a.s.y = body.s.y;   // walked back to the body
  assert.equal(w.item('Fallen', { op: 'takeall', from: body.nid }), null); assert.equal(body.cont.items.length, 0, 'everything taken back');
});

test('death on protected ground keeps the belongings', () => {
  const { w } = world(12); const q = T.spawns.quay; const a = join(w, 'Townsman', q.x, q.y);
  const n0 = allItems(a.ch).length; (w as any).damagePlayer(a, 9999, 'test'); assert.ok(a.ghost);
  assert.equal(w.remains.size, 0); assert.equal(allItems(a.ch).length, n0);
});

test('remains decay: creature remains after 4 minutes, piles after 10', () => {
  const { w } = world(12); const o = openPatch(8); join(w, 'Watch', o.x, o.y); pop(w).clear();
  const c = (w as any).addRemains('realm', { name: 'x remains', items: [SF.newItem('gold', 3)], x: o.x + 1, y: o.y, sect: 0, life: ITEMS.corpseLife, mon: 'rat' });
  const p = (w as any).addRemains('realm', { name: 'dropped items', items: [SF.newItem('gold', 3)], x: o.x - 1, y: o.y, sect: 0, life: ITEMS.pileLife, pile: true });
  for (let i = 0; i < (ITEMS.corpseLife + 2) / MV.STEP; i++) w.step(); assert.equal(w.remains.has(c.nid), false); assert.equal(w.remains.has(p.nid), true);
  for (let i = 0; i < (ITEMS.pileLife - ITEMS.corpseLife + 2) / MV.STEP; i++) w.step(); assert.equal(w.remains.has(p.nid), false);
});

test('wear: weapons, armour and shields lose condition in fights and break at 0', () => {
  const it = SF.newItem('sword', 1, { cond: 1, maxc: 100 }); assert.deepEqual(wear(SF, it, .5), { worn: true, broke: false }); assert.deepEqual(wear(SF, it, 2), { worn: true, broke: true }); assert.equal(it.cond, 0);
  assert.deepEqual(wear(SF, SF.newItem('gold', 3), 1), { worn: false, broke: false });
  const { w } = world(20); const o = openPatch(12); const ch = fighter(); const a = join(w, 'Worn', o.x, o.y, ch); pop(w).clear();
  const weapon = ch.equip.weapon; const c0 = weapon.cond ?? 100;
  const c = pop(w).spawnAt(keyOf('boar'), a.s.x + .9, a.s.y)!; w.target('Worn', c.nid);
  for (let i = 0; i < 1200 && !c.dead; i++) { c.s.x = a.s.x + .9; c.s.y = a.s.y; a.hp = 999; w.step(); }
  assert.ok((weapon.cond ?? 100) < c0, 'the weapon wore'); assert.ok(a.invDirty || !c.dead, 'saved with the next save');
});

test('arrows: a bow needs arrows, each release spends one, and the shot lands a second later', () => {
  const { w, out } = world(12); const o = openPatch(14); const ch = fighter([['archery', 50], ['tactics', 30], ['healing', 20]]);
  const a = join(w, 'Archer', o.x, o.y, ch); pop(w).clear();
  ch.equip.weapon = SF.newItem('shortbow', 1, { cond: 100, maxc: 100 }); ch.pack.items = ch.pack.items.filter((i: any) => i.id !== 'arrow'); w.inventoryChanged(a, false);
  const c = pop(w).spawnAt(keyOf('boar'), o.x + 6, o.y)!;
  assert.match(w.target('Archer', c.nid)!, /arrow/);
  ch.pack.items.push(SF.newItem('arrow', 3)); w.inventoryChanged(a, false); assert.equal(w.target('Archer', c.nid), null);
  let shots = 0, landed = 0;
  for (let i = 0; i < 600; i++) { c.s.x = o.x + 6; c.s.y = o.y; c.state = 'idle'; w.step(); for (const m of out) if (m[0] === a && m[1] === 'combat') { if (m[2].k === 'shot') shots++; if ((m[2].k === 'hit' || m[2].k === 'miss') && m[2].a === a.nid) landed++; } out.length = 0; if (c.dead) break; }
  assert.ok(shots >= 1 && shots <= 3, 'shots ' + shots); assert.equal(SF.count(ch.pack, 'arrow'), 3 - shots, 'one arrow per release');
  assert.ok(landed >= 1, 'the shots landed'); if (shots === 3 && !c.dead) assert.equal(a.armed, 0, 'out of arrows: stands down');
});
