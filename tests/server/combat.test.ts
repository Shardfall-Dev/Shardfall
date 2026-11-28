/* Server Combat v1 over the real gateway: arming on a creature with target, the server's swings reported as combat events,
   refusals, health and death saved to the database, a ghost restored only by the rules. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto = require('node:crypto');
import path = require('node:path');
import { startServer, signUp, creation, WsClient, Client, sleep, type TestServer } from './helpers';
import COL = require('../../shared/collision');
import { loadTerrain } from '../../server/src/world/terrain';
import { loadPopulation } from '../../server/src/world/creatures';

const ROOT = path.join(__dirname, '..', '..'); const T = loadTerrain(ROOT); const DATA = loadPopulation(ROOT, T);
let srv: TestServer;
before(async () => { srv = await startServer({}); });
after(async () => { await srv?.close(); });
const RT = '/api/realms/anniabreen/characters';
const uniq = (p: string) => p + crypto.randomBytes(3).toString('hex').replace(/\d/g, d => 'abcdefghij'[+d]);
async function player(tag: string) { const u = await signUp(srv); const ch = (await u.c.post(RT, creation(uniq(tag)))).json.character; return Object.assign(u, { ch }); }
async function join(p: { c: Client; ch: any }) { const { w } = await WsClient.open(srv, p.c); assert.ok(w); w!.send('hello', { characterId: p.ch.id }); const welcome = await w!.wait(m => m.type === 'welcome'); return { w: w!, welcome }; }
async function placeAt(id: string, x: number, y: number) { await srv.db.query(`update game.characters set position = $2 where id = $1`, [id, JSON.stringify({ map: 'anniabreen', town: 'quay', x, y })]); }

test('arming: an unknown creature is refused with a reason; a creature in view is accepted and the server swings when it is in reach', async () => {
  const a = await player('Hunter'); const { w, welcome } = await join(a);
  assert.equal(welcome.p.authoritative.combat, true); assert.equal(typeof welcome.p.you.hp, 'number'); assert.equal(welcome.p.you.ghost, false);
  const id = w.send('target', { nid: 987654321 }); const r = await w.wait(m => m.type === 'combat' && m.id === id); assert.equal(r.p.k, 'refused'); assert.match(r.p.reason, /target/i);
  w.close(); await sleep(100);
  // the hunter joins once, placed beside a creature the server already has (the first player populated the realm); a quick
  // rejoin of the same character would keep its old place (the reconnect grace), so a second character is used
  const world = srv.app.world; const pop = world.populations.get(a.ch.realmId)!;
  const c = [...pop.creatures].find(x => x.type === 'deer' || x.type === 'boar' || x.type === 'hare')!; assert.ok(c, 'a creature to fight');
  const spot = COL.nearestStand(T.world, c.s.x + .8, c.s.y, 3)!;
  const h = await player('Stalker'); await placeAt(h.ch.id, spot.x, spot.y); const J = await join(h);
  await J.w.wait(m => m.type === 'actor.enter' && m.p.nid === c.nid, 5000);
  const tid = J.w.send('target', { nid: c.nid }); await sleep(200);
  assert.equal(J.w.msgs.some(m => m.type === 'combat' && m.id === tid), false, 'accepted silently');
  const swing = await J.w.wait(m => m.type === 'combat' && m.p.a === J.welcome.p.you.nid && (m.p.k === 'hit' || m.p.k === 'miss'), 15000).catch(() => null);
  assert.ok(swing || !pop.byNid.has(c.nid) || c.state === 'flee', 'the server swung (or the creature ran off first)');
  J.w.close(); await sleep(100);
});

test('health, death and the ghost are saved; a ghost is restored only by the rules', async () => {
  const a = await player('Revenant');
  await srv.db.query('update game.characters set ghost = true, hp = 0 where id = $1', [a.ch.id]);
  const { w, welcome } = await join(a);
  assert.equal(welcome.p.you.ghost, true); assert.equal(welcome.p.you.hp, 0); assert.equal(welcome.p.character.ghost, true);
  const t = w.send('target', { nid: 1 }); const r = await w.wait(m => m.type === 'combat' && m.id === t); assert.equal(r.p.k, 'refused');
  const q = w.send('resurrect', { at: 'bound' }); const r2 = await w.wait(m => m.type === 'combat' && m.id === q); assert.match(r2.p.reason, /Wait/);
  const s = w.send('resurrect', { at: 'shrine' }); const r3 = await w.wait(m => m.type === 'combat' && m.id === s);
  assert.equal(r3.p.k, 'refused', 'the quay spawn is not within reach of the shrine');
  w.close(); await sleep(300);
  const row = (await srv.db.query('select ghost, hp from game.characters where id = $1', [a.ch.id])).rows[0]; assert.equal(row.ghost, true); assert.equal(row.hp, 0);
});

test('a client still cannot send a blow, damage or loot', async () => {
  const a = await player('Cheat'); const { w } = await join(a);
  for (const type of ['attack', 'damage', 'loot', 'skill']) { const id = w.send(type, { nid: 1, dmg: 999 }); const e = await w.wait(m => m.type === 'error' && m.id === id); assert.equal(e.p.code, 'not_authoritative'); }
  const id = w.send('target', { nid: 5, dmg: 999 }); const e = await w.wait(m => m.type === 'error' && m.id === id); assert.equal(e.p.code, 'bad_payload');
  w.close();
});
