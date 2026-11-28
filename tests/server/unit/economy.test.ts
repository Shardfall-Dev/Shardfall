/* Server Economy v1: the counters (bankers and shopkeepers at their posts), buying and selling at the build's prices, the bank,
   gold conservation and the protocol v6 counter message. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path = require('node:path');
import COL = require('../../../shared/collision');
import MV = require('../../../shared/movement');
import P = require('../../../shared/protocol');
import adapter = require('../../../shared/game-rules-adapter');
import { loadTerrain } from '../../../server/src/world/terrain';
import { loadPopulation, worldClock, CLOCK_EPOCH_MS } from '../../../server/src/world/creatures';
import { loadEconomy, sellPrice, stockOf, ECONOMY } from '../../../server/src/world/economy';
import { allItems, rowsOf } from '../../../server/src/world/items';
import { World, type Actor } from '../../../server/src/world/world';

const ROOT = path.join(__dirname, '..', '..', '..');
const T = loadTerrain(ROOT); const DATA = loadPopulation(ROOT, T); const SIM = adapter.loadSim(); const ECO = loadEconomy(ROOT, T.hash);
const R = adapter.load(); const SF = R.SF; const CR = SF.CREATION;
let n = 0;
function trader(stats = { str: 45, dex: 25, int: 10 }) {
  const v = R.validateCreation({ name: 'Tess', look: CR.defaultLook('male'), ...stats, skills: [['swordsmanship', 50], ['tactics', 30], ['healing', 20]], town: 'quay' }); const b = R.buildCharacter(v.value);
  return R.characterFromRows({ name: b.name, str: b.str, dex: b.dex, int: b.int, skills: b.skills, stat_locks: b.statLocks, appearance: b.appearance },
    b.items.map(i => Object.assign({ id: '00000000-0000-4000-8000-' + String(++n).padStart(12, '0') }, i)));
}
function world() {
  const w = new World(T, { creatures: { data: DATA, sim: SIM, clock: worldClock(SIM, () => CLOCK_EPOCH_MS), seed: 5 }, combat: { SF, seed: 9 }, economy: ECO });
  const out: [Actor, string, any][] = []; const saved: string[] = []; const trades: any[] = [];
  w.setSink((a, t, p) => out.push([a, t, p])); w.onInventory = a => saved.push(a.characterId); w.onTrade = t => trades.push(t);
  return { w, out, saved, trades };
}
function join(w: World, name: string, x: number, y: number, ch = trader()) {
  return w.add({ characterId: name, accountId: 'acc-' + name, realmId: 'realm', info: { characterId: name, name, body: 'male', appearance: {}, title: null, town: 'quay', equip: {} }, position: { x, y }, stam: SF.maxStam(ch), ctx: MV.ctxFor(SF, ch), ch, bound: 'quay' }).actor;
}
const keeper = (w: World, name: string) => [...w.keepers.values()].find(k => k.post.name === name)!;
/* a character standing beside a keeper (within the counter's reach) */
function beside(w: World, name: string, who: string, ch = trader()) {
  w.placeKeepers('realm'); const k = keeper(w, who); const p = COL.nearestStand(T.world, k.s.x, k.s.y + 1.2, 6)!; assert.ok(p, 'room beside ' + who);
  const a = join(w, name, p.x, p.y, ch); a.s.x = p.x; a.s.y = p.y; assert.ok(Math.hypot(a.s.x - k.s.x, a.s.y - k.s.y) <= ECO.reach, who + ' within reach');
  return { a, k };
}
const last = (out: [Actor, string, any][], a: Actor, type: string) => [...out].reverse().find(m => m[0] === a && m[1] === type)?.[2];
const gold = (c: any) => SF.count(c, 'gold');
const units = (ch: any) => { const m: Record<string, number> = {}; for (const it of allItems(ch)) m[it.id] = (m[it.id] || 0) + it.qty; return m; };

test('protocol v6: counter commands are validated; a price or an amount of gold is never accepted', () => {
  const ok = (p: any) => P.parseClient(JSON.stringify({ v: P.PROTOCOL_VERSION, type: 'counter', p }));
  const id = '11111111-1111-4111-8111-111111111111';
  assert.equal(P.PROTOCOL_VERSION, 6);
  for (const p of [{ op: 'open', at: 3 }, { op: 'buy', at: 3, itemDef: 'bandage', qty: 10 }, { op: 'buy', at: 3, itemDef: 'plate_chest' }, { op: 'sell', at: 3, item: id }, { op: 'sell', at: 3, item: id, qty: 4 },
    { op: 'deposit', at: 3, item: id }, { op: 'depositgold', at: 3 }, { op: 'depositworn', at: 3, slot: 'weapon' }, { op: 'withdraw', at: 3, item: id }])
    assert.ok(ok(p).ok, JSON.stringify(p));
  for (const p of [{ op: 'steal', at: 3 }, { op: 'open' }, { op: 'open', at: 0 }, { op: 'open', at: 'banker' }, { op: 'buy', at: 3 }, { op: 'buy', at: 3, itemDef: 'Bandage!' }, { op: 'buy', at: 3, itemDef: 'bandage', price: 0 },
    { op: 'sell', at: 3, item: id, gold: 999 }, { op: 'sell', at: 3 }, { op: 'sell', at: 3, item: 'sword' }, { op: 'buy', at: 3, itemDef: 'bandage', qty: 0 }, { op: 'buy', at: 3, itemDef: 'bandage', qty: 2.5 }, { op: 'withdraw', at: 3 }, { op: 'depositworn', at: 3 }])
    assert.equal(ok(p).ok, false, JSON.stringify(p));
  assert.equal(P.parseClient(JSON.stringify({ v: P.PROTOCOL_VERSION, type: 'trade', p: {} })).ok, false, 'player trading stays reserved');
  assert.ok(P.SERVER.includes('counter'));
});

test('the exported counters are the build’s: every bank and shop, stock that exists, the price list the rules use', () => {
  assert.equal(ECO.world, T.hash);
  assert.ok(ECO.posts.length >= 20); assert.equal(ECO.posts.filter(p => p.kind === 'bank').length, 6);
  for (const name of ['Odile, banker', 'Gus, provisioner', 'Harl, smith', 'Crow, camp strongbox', 'Quill, Vespar banker', 'Sela, college bank']) assert.ok(ECO.posts.some(p => p.name === name), name);
  assert.ok(!ECO.posts.some(p => p.role === 'trader'), 'the travelling merchant has no post');
  for (const p of ECO.posts) { assert.ok(COL.nearestStand(T.world, p.x, p.y, 3), p.name + ' stands in the world'); if (p.kind === 'shop') assert.ok(ECO.shops[p.role] && ECO.shops[p.role].length, p.name + ' sells something'); }
  for (const r of Object.keys(ECO.shops)) for (const id of ECO.shops[r]) { assert.ok(SF.ITEMS[id], r + ' ' + id); assert.equal(ECO.prices[id], SF.PRICES[id], 'price of ' + id); }
  for (const id of Object.keys(ECO.prices)) assert.equal(ECO.prices[id], SF.PRICES[id], 'the server rules price ' + id + ' like the build');
  assert.throws(() => loadEconomy(ROOT, 'deadbeef'), /exported for world/);
});

test('keepers stand at their posts and are announced like any body in view (actor.enter kind npc)', () => {
  const { w, out } = world(); const { a, k } = beside(w, 'Look', 'Gus, provisioner');
  assert.equal(w.keepers.size, ECO.posts.length); w.step();
  const e = out.find(m => m[0] === a && m[1] === 'actor.enter' && m[2].nid === k.nid); assert.ok(e, 'the provisioner is announced');
  assert.deepEqual({ kind: e![2].kind, role: e![2].role, counter: e![2].counter, name: e![2].name }, { kind: 'npc', role: 'provisioner', counter: 'shop', name: 'Gus, provisioner' });
  const x = k.s.x; for (let i = 0; i < 40; i++) w.step(); assert.equal(k.s.x, x, 'a keeper keeps the post');
  join(w, 'Second', a.s.x, a.s.y); assert.equal(w.keepers.size, ECO.posts.length, 'one set of keepers per realm');
});

test('a shop: open shows the stock at the build’s prices and what it pays; buying charges gold and saves at once', () => {
  const { w, out, saved, trades } = world(); const { a, k } = beside(w, 'Buyer', 'Gus, provisioner');
  assert.equal(w.counter('Buyer', { op: 'open', at: k.nid }), null);
  const v = last(out, a, 'counter'); assert.equal(v.kind, 'shop'); assert.equal(v.gold, 100);
  assert.equal(JSON.stringify(v.stock), JSON.stringify(stockOf(SF, ECO, k.post))); assert.ok(v.stock.some((s: any) => s.itemDef === 'bandage' && s.price === SF.PRICES.bandage));
  assert.ok(Object.keys(v.offers).every(sid => a.ch.pack.items.some((i: any) => i.sid === sid && !i.starter)), 'offers only for what it would buy');
  const b0 = SF.count(a.ch.pack, 'bandage');
  assert.equal(w.counter('Buyer', { op: 'buy', at: k.nid, itemDef: 'bandage', qty: 10 }), null);
  assert.equal(gold(a.ch.pack), 100 - SF.PRICES.bandage * 10); assert.equal(SF.count(a.ch.pack, 'bandage'), b0 + 10);
  assert.deepEqual(saved, ['Buyer']); assert.ok(last(out, a, 'inv')); assert.equal(last(out, a, 'counter').gold, gold(a.ch.pack));
  assert.deepEqual(trades.map(t => [t.op, t.itemDef, t.gold]), [['buy', 'bandage', -SF.PRICES.bandage * 10]]);
  assert.equal(w.counter('Buyer', { op: 'buy', at: k.nid, itemDef: 'hatchet' }), null);
  const hatchet = a.ch.pack.items.find((i: any) => i.id === 'hatchet'); assert.ok(hatchet && typeof hatchet.sid === 'string', 'a bought item gets a server id');
});

test('buying is refused for what the shop does not sell, without the gold, beyond the carrying capacity, or more than one non-stacking item', () => {
  const { w, saved } = world(); const { a, k } = beside(w, 'Poor', 'Gus, provisioner'); const before = JSON.stringify(units(a.ch));
  assert.match(w.counter('Poor', { op: 'buy', at: k.nid, itemDef: 'plate_chest' })!, /not for sale here/);
  assert.match(w.counter('Poor', { op: 'buy', at: k.nid, itemDef: 'nosuchthing' })!, /not for sale here/);
  assert.match(w.counter('Poor', { op: 'buy', at: k.nid, itemDef: 'hatchet', qty: 2 })!, /one at a time/);
  assert.match(w.counter('Poor', { op: 'buy', at: k.nid, itemDef: 'bandage', qty: ECONOMY.maxBuy + 1 })!, /not for sale/);
  assert.equal(JSON.stringify(units(a.ch)), before, 'refusals change nothing');
  SF.removeQty(a.ch.pack, 'gold', gold(a.ch.pack));
  assert.match(w.counter('Poor', { op: 'buy', at: k.nid, itemDef: 'bandage' })!, /Not enough gold/);
  const h = beside(w, 'Laden', 'Harl, smith', trader({ str: 10, dex: 25, int: 45 })); SF.addItem(h.a.ch.pack, SF.newItem('gold', 3000));
  let why: string | null = null; for (let i = 0; i < 40 && !why; i++) why = w.counter('Laden', { op: 'buy', at: h.k.nid, itemDef: 'plate_chest' });
  assert.match(why!, /too heavy/i, 'plate until the weight limit stops it'); assert.ok(SF.containerKg(h.a.ch.pack) <= SF.EQ.capFor(h.a.ch).kg + 1e-9);
  assert.ok(!saved.includes('Poor'), 'a refused purchase changes and saves nothing');
});

test('selling: anything tradeable at 40 % (a worn tool by its uses), never gold or starter gear; any shop buys', () => {
  const { w, out } = world(); const { a, k } = beside(w, 'Seller', 'Harl, smith');
  const ore = SF.newItem('ironbar', 5); SF.addItem(a.ch.pack, ore); w.inventoryChanged(a, false);
  const g0 = gold(a.ch.pack), each = Math.max(1, Math.floor(SF.PRICES.ironbar * .4));
  assert.equal(sellPrice(SF, ECO, ore), each);
  assert.equal(w.counter('Seller', { op: 'sell', at: k.nid, item: ore.sid, qty: 2 }), null);
  assert.equal(gold(a.ch.pack), g0 + each * 2); assert.equal(ore.qty, 3);
  assert.equal(w.counter('Seller', { op: 'sell', at: k.nid, item: ore.sid, qty: 3 }), null); assert.ok(!a.ch.pack.items.includes(ore));
  assert.equal(gold(a.ch.pack), g0 + each * 5);
  const coins = a.ch.pack.items.find((i: any) => i.id === 'gold'); assert.match(w.counter('Seller', { op: 'sell', at: k.nid, item: coins.sid })!, /will not buy/);
  const journal = a.ch.pack.items.find((i: any) => i.starter); assert.match(w.counter('Seller', { op: 'sell', at: k.nid, item: journal.sid })!, /starter/);
  const meat = a.ch.pack.items.find((i: any) => i.id === 'cookedmeat'); assert.match(w.counter('Seller', { op: 'sell', at: k.nid, item: meat.sid, qty: meat.qty + 1 })!, /that many/);
  assert.match(w.counter('Seller', { op: 'sell', at: k.nid, item: '99999999-9999-4999-8999-999999999999' })!, /not in your backpack/);
  const tool = SF.newItem('pickaxe', 1, { cond: 100 }); tool.uses = 25; assert.equal(sellPrice(SF, ECO, tool), Math.max(1, Math.floor(SF.PRICES.pickaxe * .4 * .25)));
  assert.equal(w.counter('Seller', { op: 'open', at: k.nid }), null); const offers = last(out, a, 'counter').offers;
  assert.equal(offers[meat.sid], Math.max(1, Math.floor(SF.PRICES.cookedmeat * .4))); assert.equal(offers[journal.sid], undefined); assert.equal(offers[coins.sid], undefined);
});

test('the bank: deposit, all gold, a worn piece, withdraw within capacity — one account, saved, units conserved', () => {
  const { w, out, saved } = world(); const { a, k } = beside(w, 'Saver', 'Odile, banker'); const total0 = units(a.ch);
  assert.equal(w.counter('Saver', { op: 'open', at: k.nid }), null); assert.equal(last(out, a, 'counter').bank.length, 0);
  assert.equal(w.counter('Saver', { op: 'depositgold', at: k.nid }), null);
  assert.equal(gold(a.ch.pack), 0); assert.equal(gold(a.ch.bank), 100); assert.equal(last(out, a, 'counter').gold, 100);
  const meat = a.ch.pack.items.find((i: any) => i.id === 'cookedmeat'); assert.equal(w.counter('Saver', { op: 'deposit', at: k.nid, item: meat.sid }), null);
  assert.ok(a.ch.bank.items.includes(meat));
  assert.equal(w.counter('Saver', { op: 'depositworn', at: k.nid, slot: 'weapon' }), null);
  assert.equal(a.ch.equip.weapon, null); assert.ok(a.ch.bank.items.some((i: any) => i.id === 'sword'));
  assert.ok(out.some(m => m[0] === a && m[1] === 'combat' && m[2].k === 'look'), 'others see the sword go');
  const rows = rowsOf(a.ch); assert.equal(rows.filter(r => r.container === 'bank').length, 3, 'the bank is in the saved rows');
  assert.deepEqual(units(a.ch), total0, 'nothing made or lost');
  const coins = a.ch.bank.items.find((i: any) => i.id === 'gold'); assert.equal(w.counter('Saver', { op: 'withdraw', at: k.nid, item: coins.sid }), null);
  assert.equal(gold(a.ch.pack), 100); assert.deepEqual(units(a.ch), total0);
  assert.match(w.counter('Saver', { op: 'withdraw', at: k.nid, item: '99999999-9999-4999-8999-999999999999' })!, /not in your bank/);
  assert.equal(w.counter('Saver', { op: 'depositgold', at: k.nid }), null);
  assert.match(w.counter('Saver', { op: 'depositgold', at: k.nid })!, /no gold/);
  assert.match(w.counter('Saver', { op: 'depositworn', at: k.nid, slot: 'weapon' })!, /Nothing is worn/);
  assert.ok(saved.filter(s => s === 'Saver').length >= 5, 'saved after every change');
  // the same account at another bank (game.js: one account at every bank)
  const far = keeper(w, 'Quill, Vespar banker'); const p = COL.nearestStand(T.world, far.s.x, far.s.y + 1.2, 6)!; a.s.x = p.x; a.s.y = p.y;
  assert.equal(w.counter('Saver', { op: 'open', at: far.nid }), null); assert.equal(last(out, a, 'counter').bank.length, a.ch.bank.items.length);
  // withdrawing beyond the carrying capacity is refused
  const heavy = SF.EQ.make('plate_chest', { origin: 'npc' }); a.ch.bank.items.push(heavy); w.inventoryChanged(a, false);
  for (let i = 0; i < 60; i++) SF.addItem(a.ch.pack, SF.EQ.make('plate_chest', { origin: 'npc' }));
  assert.match(w.counter('Saver', { op: 'withdraw', at: far.nid, item: heavy.sid })!, /heavy/i);
});

test('the counter is checked every time: reach, the right kind of keeper, a ghost, another realm, an unknown keeper', () => {
  const { w } = world(); const { a, k } = beside(w, 'Check', 'Gus, provisioner'); const bank = keeper(w, 'Odile, banker');
  assert.match(w.counter('Check', { op: 'depositgold', at: k.nid })!, /no bank/);
  if (Math.hypot(bank.s.x - a.s.x, bank.s.y - a.s.y) > ECO.reach + .5) assert.match(w.counter('Check', { op: 'open', at: bank.nid })!, /no longer at the counter/);
  const b = beside(w, 'Banker2', 'Odile, banker'); assert.match(w.counter('Banker2', { op: 'buy', at: b.k.nid, itemDef: 'bandage' })!, /does not trade/);
  a.s.x += 8; assert.match(w.counter('Check', { op: 'buy', at: k.nid, itemDef: 'bandage' })!, /no longer at the counter/); a.s.x -= 8;
  a.ghost = true; assert.match(w.counter('Check', { op: 'open', at: k.nid })!, /cannot see you/); a.ghost = false;
  assert.match(w.counter('Check', { op: 'open', at: 999999 })!, /no one at that counter/);
  const other = w.add({ characterId: 'Elsewhere', accountId: 'acc-x', realmId: 'realm-2', info: { characterId: 'Elsewhere', name: 'E', body: 'male', appearance: {}, title: null, town: 'quay', equip: {} }, position: { x: a.s.x, y: a.s.y }, stam: 50, ctx: MV.ctxFor(SF, trader()), ch: trader(), bound: 'quay' }).actor;
  other.s.x = a.s.x; other.s.y = a.s.y; assert.match(w.counter('Elsewhere', { op: 'open', at: k.nid })!, /no one at that counter/, 'keepers belong to their realm');
  const plain = new World(T, {}); assert.match(plain.counter('x', { op: 'open', at: 1 })!, /not available/);
});

test('gold is conserved through the bank and only buying and selling change it, by exactly the posted prices', () => {
  const { w } = world(); const s = beside(w, 'Ledger', 'Gus, provisioner'); const g0 = gold(s.a.ch.pack) + gold(s.a.ch.bank);
  w.counter('Ledger', { op: 'buy', at: s.k.nid, itemDef: 'bandage', qty: 3 }); w.counter('Ledger', { op: 'buy', at: s.k.nid, itemDef: 'cloth', qty: 2 });
  const spent = SF.PRICES.bandage * 3 + SF.PRICES.cloth * 2;
  const band = s.a.ch.pack.items.find((i: any) => i.id === 'bandage'); w.counter('Ledger', { op: 'sell', at: s.k.nid, item: band.sid, qty: 1 });
  const got = Math.max(1, Math.floor(SF.PRICES.bandage * .4));
  assert.equal(gold(s.a.ch.pack) + gold(s.a.ch.bank), g0 - spent + got);
});
