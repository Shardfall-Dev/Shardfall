/* Server Economy v1 over the real gateway and database: keepers announced in view, buying and selling at the build's prices
   saved to game.items at once, the bank (container 'bank') kept across a reconnect, and forged or out-of-reach counter
   messages refused. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto = require('node:crypto');
import path = require('node:path');
import COL = require('../../shared/collision');
import adapter = require('../../shared/game-rules-adapter');
import { loadTerrain } from '../../server/src/world/terrain';
import { loadEconomy } from '../../server/src/world/economy';
import { startServer, signUp, creation, WsClient, Client, sleep, type TestServer } from './helpers';

const ROOT = path.join(__dirname, '..', '..'); const T = loadTerrain(ROOT); const ECO = loadEconomy(ROOT, T.hash); const SF = adapter.load().SF;
let srv: TestServer;
before(async () => { srv = await startServer({}); });
after(async () => { await srv?.close(); });
const RT = '/api/realms/anniabreen/characters';
const uniq = (p: string) => p + crypto.randomBytes(3).toString('hex').replace(/\d/g, d => 'abcdefghij'[+d]);
const post = (name: string) => ECO.posts.find(p => p.name === name)!;
const spotBy = (name: string) => { const p = post(name); return COL.nearestStand(T.world, p.x, p.y + 1.2, 6)!; };
async function player(tag: string, near: string) {
  const u = await signUp(srv); const ch = (await u.c.post(RT, creation(uniq(tag)))).json.character; const s = spotBy(near);
  await srv.db.query('update game.characters set position = $2 where id = $1', [ch.id, JSON.stringify({ map: 'anniabreen', town: 'quay', x: s.x, y: s.y })]);
  return Object.assign(u, { ch });
}
async function join(p: { c: Client; ch: any }) { const { w } = await WsClient.open(srv, p.c); assert.ok(w); w!.send('hello', { characterId: p.ch.id }); const welcome = await w!.wait(m => m.type === 'welcome'); return { w: w!, welcome }; }
const units = async (id: string, def: string, container = 'pack') => Number((await srv.db.query('select coalesce(sum(qty), 0) as n from game.items where character_id = $1 and item_def = $2 and container = $3', [id, def, container])).rows[0].n);
async function cmd(w: WsClient, p: any) { const id = w.send('counter', p); await sleep(200); const r = w.msgs.find(m => m.id === id && m.type === 'combat'); return r ? r.p.reason : null; }
const keeperIn = (w: WsClient, name: string) => w.wait(m => m.type === 'actor.enter' && m.p.kind === 'npc' && m.p.name === name, 5000);

test('a shop: the keeper is in view, buying and selling at the build’s prices are saved to the database at once', async () => {
  const a = await player('Shopper', 'Gus, provisioner'); const { w, welcome } = await join(a);
  assert.equal(welcome.p.authoritative.economy, true);
  const gus = await keeperIn(w, 'Gus, provisioner'); assert.equal(gus.p.counter, 'shop');
  assert.equal(await cmd(w, { op: 'open', at: gus.p.nid }), null);
  const view = await w.wait(m => m.type === 'counter' && m.p.nid === gus.p.nid); assert.equal(view.p.kind, 'shop');
  assert.ok(view.p.stock.some((s: any) => s.itemDef === 'bandage' && s.price === SF.PRICES.bandage));
  const g0 = await units(a.ch.id, 'gold'), b0 = await units(a.ch.id, 'bandage');
  assert.equal(await cmd(w, { op: 'buy', at: gus.p.nid, itemDef: 'bandage', qty: 5 }), null); await sleep(300);
  assert.equal(await units(a.ch.id, 'gold'), g0 - SF.PRICES.bandage * 5); assert.equal(await units(a.ch.id, 'bandage'), b0 + 5);
  const inv = await w.wait(m => m.type === 'inv' && m.p.pack.some((i: any) => i.itemDef === 'bandage' && i.qty === b0 + 5));
  const band = inv.p.pack.find((i: any) => i.itemDef === 'bandage');
  assert.equal(await cmd(w, { op: 'sell', at: gus.p.nid, item: band.id, qty: 2 }), null); await sleep(300);
  assert.equal(await units(a.ch.id, 'gold'), g0 - SF.PRICES.bandage * 5 + Math.max(1, Math.floor(SF.PRICES.bandage * .4)) * 2);
  assert.equal(await units(a.ch.id, 'bandage'), b0 + 3);
  w.close(); await sleep(200);
});

test('the bank: deposited gold is saved in the bank container and is still there after a reconnect; withdraw brings it back', async () => {
  const a = await player('Saver', 'Odile, banker'); let { w } = await join(a);
  const odile = await keeperIn(w, 'Odile, banker'); const g0 = await units(a.ch.id, 'gold');
  assert.equal(await cmd(w, { op: 'depositgold', at: odile.p.nid }), null); await sleep(300);
  assert.equal(await units(a.ch.id, 'gold'), 0); assert.equal(await units(a.ch.id, 'gold', 'bank'), g0);
  w.close(); await sleep(400); ({ w } = await join(a));
  const again = await keeperIn(w, 'Odile, banker'); assert.equal(await cmd(w, { op: 'open', at: again.p.nid }), null);
  const view = await w.wait(m => m.type === 'counter' && m.p.kind === 'bank'); assert.equal(view.p.gold, g0);
  const coins = view.p.bank.find((i: any) => i.itemDef === 'gold');
  assert.equal(await cmd(w, { op: 'withdraw', at: again.p.nid, item: coins.id }), null); await sleep(300);
  assert.equal(await units(a.ch.id, 'gold'), g0); assert.equal(await units(a.ch.id, 'gold', 'bank'), 0);
  w.close(); await sleep(200);
});

test('forged and out-of-reach counter messages are refused and change nothing', async () => {
  const a = await player('Cheat', 'Gus, provisioner'); const b = await player('Mark', 'Gus, provisioner'); const { w } = await join(a);
  const gus = await keeperIn(w, 'Gus, provisioner'); const g0 = await units(a.ch.id, 'gold');
  for (const p of [{ op: 'buy', at: gus.p.nid, itemDef: 'bandage', price: 0 }, { op: 'sell', at: gus.p.nid, item: crypto.randomUUID(), gold: 1e6 }, { op: 'steal', at: gus.p.nid }, { op: 'buy', at: gus.p.nid, itemDef: 'bandage', qty: -3 }]) {
    const id = w.send('counter', p); const e = await w.wait(m => m.type === 'error' && m.id === id); assert.equal(e.p.code, 'bad_payload', JSON.stringify(p));
  }
  const bRows = (await srv.db.query('select id from game.items where character_id = $1', [b.ch.id])).rows;
  assert.match(await cmd(w, { op: 'sell', at: gus.p.nid, item: bRows[0].id }) || '', /not in your backpack/, 'someone else\'s item is not yours to sell');
  assert.match(await cmd(w, { op: 'buy', at: gus.p.nid, itemDef: 'plate_chest' }) || '', /not for sale here/);
  assert.match(await cmd(w, { op: 'open', at: 999999 }) || '', /no one at that counter/);
  assert.equal(await units(a.ch.id, 'gold'), g0, 'no gold moved');
  w.close(); await sleep(200);
});
