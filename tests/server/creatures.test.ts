/* Server Creatures v1 over the real gateway: the welcome carries the world clock and says creatures are server-authoritative;
   a character out in the wilds is told about the creatures around it (kind 'creature', a species from the exported population,
   full health), receives their steps in state, and still cannot send anything but intents. */
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
/* a wilderness point beside a busy spawner (deer and hares graze by day, hounds roam at dusk: any of them will do) */
function wilds() {
  const s = [...DATA.spawners].filter(o => !o.camp && o.max >= 2).sort((a, b) => b.max - a.max)[0];
  const q = COL.nearestStand(T.world, s.x + 6, s.y, 12); assert.ok(q); return q!;
}

test('the welcome carries the world clock and says creatures and combat are server-authoritative, items still are not', async () => {
  const a = await player('Clock'); const { w, welcome } = await join(a);
  assert.equal(welcome.p.authoritative.creatures, true); assert.equal(welcome.p.authoritative.combat, true); assert.equal(welcome.p.authoritative.items, false);
  const c = welcome.p.clock; assert.ok(c && c.hour >= 0 && c.hour < 24 && c.dayMinutes === 120 && typeof c.period === 'string');
  assert.match(welcome.p.notice, /creatures/i);
  w.close();
});

test('out in the wilds the creatures around a character are announced, move in state, and are the server’s alone', async () => {
  const a = await player('Ranger'); const at = wilds();
  await srv.db.query(`update game.characters set position = $2 where id = $1`, [a.ch.id, JSON.stringify({ map: 'anniabreen', town: 'quay', x: at.x, y: at.y })]);
  const { w } = await join(a);
  const e = await w.wait(m => m.type === 'actor.enter' && m.p.kind === 'creature', 5000);
  assert.ok(DATA.species[e.p.type], 'a species from the exported population: ' + e.p.type); assert.equal(e.p.name, DATA.species[e.p.type].n);
  assert.equal(e.p.hp, e.p.max); assert.equal(e.p.hp, DATA.species[e.p.type].hp); assert.equal('characterId' in e.p, false);
  const creatures = new Set(w.msgs.filter(m => m.type === 'actor.enter' && m.p.kind === 'creature').map(m => m.p.nid));
  await w.wait(m => m.type === 'state' && m.p.moves.some((mv: any) => creatures.has(mv[0]) || w.msgs.some(x => x.type === 'actor.enter' && x.p.nid === mv[0] && x.p.kind === 'creature')), 15000);
  // nothing about creatures can be sent by a client
  for (const type of ['attack', 'damage', 'loot', 'position']) { const id = w.send(type, { nid: e.p.nid, x: 1, y: 1 }); const r = await w.wait(m => m.type === 'error' && m.id === id); assert.equal(r.p.code, 'not_authoritative'); }
  assert.ok(srv.app.world.stats.creatures > 300, 'the realm is populated: ' + srv.app.world.stats.creatures);
  w.close(); await sleep(100);
});
