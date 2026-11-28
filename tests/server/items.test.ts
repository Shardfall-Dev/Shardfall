/* Server Items v1 over the real gateway and database: the live inventory after the welcome, equip / unequip / drop / take
   saved to game.items at once, a pile seen by another character, ownership, and forged item messages refused. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto = require('node:crypto');
import { startServer, signUp, creation, WsClient, Client, sleep, type TestServer } from './helpers';

let srv: TestServer;
before(async () => { srv = await startServer({}); });
after(async () => { await srv?.close(); });
const RT = '/api/realms/anniabreen/characters';
const uniq = (p: string) => p + crypto.randomBytes(3).toString('hex').replace(/\d/g, d => 'abcdefghij'[+d]);
async function player(tag: string) { const u = await signUp(srv); const ch = (await u.c.post(RT, creation(uniq(tag)))).json.character; return Object.assign(u, { ch }); }
async function join(p: { c: Client; ch: any }) { const { w } = await WsClient.open(srv, p.c); assert.ok(w); w!.send('hello', { characterId: p.ch.id }); const welcome = await w!.wait(m => m.type === 'welcome'); return { w: w!, welcome }; }
const rows = async (id: string) => (await srv.db.query('select id, container, slot, item_def, qty from game.items where character_id = $1 order by id', [id])).rows;
async function cmd(w: WsClient, p: any) { const id = w.send('item', p); await sleep(150); const r = w.msgs.find(m => m.id === id && m.type === 'combat'); return r ? r.p.reason : null; }

test('the live inventory follows the welcome; unequip and equip are saved to the database at once', async () => {
  const a = await player('Keeper'); const { w, welcome } = await join(a);
  assert.equal(welcome.p.authoritative.items, true);
  const inv = await w.wait(m => m.type === 'inv'); assert.ok(Array.isArray(inv.p.pack) && typeof inv.p.equip === 'object');
  const weapon = inv.p.equip.weapon; assert.ok(weapon && weapon.id, 'the starter kit is armed');
  assert.equal(await cmd(w, { op: 'unequip', slot: 'weapon' }), null);
  const inv2 = await w.wait(m => m.type === 'inv' && m.p.equip.weapon === null); assert.ok(inv2.p.pack.some((i: any) => i.id === weapon.id));
  await sleep(300); let r = (await rows(a.ch.id)).find((x: any) => x.id === weapon.id); assert.equal(r.container, 'pack'); assert.equal(r.slot, null);
  assert.equal(await cmd(w, { op: 'equip', item: weapon.id }), null); await sleep(300);
  r = (await rows(a.ch.id)).find((x: any) => x.id === weapon.id); assert.equal(r.container, 'equip'); assert.equal(r.slot, 'weapon');
  w.close();
});

test('drop and take: a pile another character sees; the items move in the database, never duplicated', async () => {
  const a = await player('Dropper'); const b = await player('Finder');
  await srv.db.query(`update game.characters set position = $2 where id = any($1)`, [[a.ch.id, b.ch.id], JSON.stringify({ map: 'anniabreen', town: 'quay', x: 92.5, y: 304.5 })]);
  const A = await join(a); const B = await join(b);
  const inv = await A.w.wait(m => m.type === 'inv'); const thing = inv.p.pack.find((i: any) => i.itemDef === 'bandage') || inv.p.pack[0];
  const before = await rows(a.ch.id); const total = before.length;
  const unitsOf = async (def: string) => Number((await srv.db.query('select coalesce(sum(qty), 0) as n from game.items where character_id = any($1) and item_def = $2', [[a.ch.id, b.ch.id], def])).rows[0].n);
  const units0 = await unitsOf(thing.itemDef);
  assert.equal(await cmd(A.w, { op: 'drop', item: thing.id }), null);
  const seen = await B.w.wait(m => m.type === 'actor.enter' && m.p.kind === 'remains', 5000); assert.ok(seen.p.items.some((i: any) => i.id === thing.id));
  await sleep(300); assert.equal((await rows(a.ch.id)).length, total - 1, 'gone from the dropper');
  assert.equal(await cmd(B.w, { op: 'take', from: seen.p.nid, item: thing.id }), null, 'the finder stands on the same spot');
  await sleep(400);
  assert.equal(await unitsOf(thing.itemDef), units0, 'every unit is in the database once: none lost, none duplicated');
  const all = (await srv.db.query('select character_id from game.items where id = $1', [thing.id])).rows;
  assert.ok(all.length <= 1 && (all.length === 0 || all[0].character_id === b.ch.id), 'the dropped stack is the finder\'s, or merged into the finder\'s own stack');
  assert.match(await cmd(A.w, { op: 'take', from: seen.p.nid, item: thing.id }) || '', /gone/, 'it cannot be taken twice');
  A.w.close(); B.w.close(); await sleep(200);
});

test('forged item messages are refused: unknown ids, other people\'s items, bad shapes', async () => {
  const a = await player('Forger'); const b = await player('Victim'); const { w } = await join(a);
  const bItems = await rows(b.ch.id);
  assert.match(await cmd(w, { op: 'equip', item: bItems[0].id }) || '', /gone/, 'someone else\'s item is not yours');
  assert.match(await cmd(w, { op: 'drop', item: crypto.randomUUID() }) || '', /gone/);
  assert.match(await cmd(w, { op: 'takeall', from: 999999 }) || '', /gone/);
  for (const p of [{ op: 'give', item: bItems[0].id }, { op: 'equip', item: 'sword' }, { op: 'drop', item: bItems[0].id, qty: -1 }, { op: 'equip', item: bItems[0].id, owner: a.ch.id }]) {
    const id = w.send('item', p); const e = await w.wait(m => m.type === 'error' && m.id === id); assert.equal(e.p.code, 'bad_payload', JSON.stringify(p));
  }
  assert.deepEqual(await rows(b.ch.id), bItems, 'the victim\'s items are untouched');
  w.close();
});
