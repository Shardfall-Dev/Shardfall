/* Server-authoritative movement over the real gateway: intents in, positions out; the server's answer is exactly what the
   shared movement rules give for the intents it applied, it cannot be hurried, walls hold, interest management announces only
   nearby characters, and positions persist across sign-outs, reconnects and restarts. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto = require('node:crypto');
import path = require('node:path');
import { startServer, signUp, creation, WsClient, Client, sleep, type TestServer } from './helpers';
import COL = require('../../shared/collision');
import MV = require('../../shared/movement');
import adapter = require('../../shared/game-rules-adapter');
import { loadTerrain } from '../../server/src/world/terrain';

const T = loadTerrain(path.join(__dirname, '..', '..')); const RULES = adapter.load();
let srv: TestServer;
before(async () => { srv = await startServer({ WORLD_VIEW_RADIUS: '12' }); });
after(async () => { await srv?.close(); });
const RT = '/api/realms/anniabreen/characters';
const uniq = (p: string) => p + crypto.randomBytes(3).toString('hex').replace(/\d/g, d => 'abcdefghij'[+d]);
async function player(tag: string, srvx = srv) { const u = await signUp(srvx); const ch = (await u.c.post(RT, creation(uniq(tag)))).json.character; return Object.assign(u, { ch }); }
async function join(p: { c: Client; ch: any }, s = srv) { const { w } = await WsClient.open(s, p.c); assert.ok(w); w!.send('hello', { characterId: p.ch.id }); const welcome = await w!.wait(m => m.type === 'welcome'); return { w: w!, welcome }; }
/* send intents the way the client does: two 50 ms steps every 100 ms */
async function walk(w: WsClient, from: number, steps: number, dir: { x: number; y: number }, sprint = false) {
  let s = from; const sent: any[] = [];
  while (s < from + steps) { const batch = []; for (let k = 0; k < 2 && s < from + steps; k++, s++) batch.push({ s, x: dir.x, y: dir.y, w: 1, r: sprint }); sent.push(...batch); w.send('move', { inputs: batch }); await sleep(100); }
  return { last: s - 1, sent };
}
const lastState = (w: WsClient) => [...w.msgs].reverse().find(m => m.type === 'state');
const ctxOf = (ch: any) => MV.ctxFor(RULES.SF, RULES.characterFromRows({ name: ch.name, str: ch.stats.str, dex: ch.stats.dex, int: ch.stats.int, skills: ch.skills, stat_locks: ch.statLocks, appearance: ch.appearance }, ch.items.map((i: any) => ({ id: i.id, container: i.container, slot: i.slot, item_def: i.itemDef, qty: i.qty, props: i.props }))));

test('welcome carries the world (same hash as the exported game world) and your authoritative position at your town’s spawn', async () => {
  const a = await player('Spawn'); const { w, welcome } = await join(a);
  assert.equal(welcome.p.world.hash, T.hash); assert.equal(welcome.p.world.step, 0.05); assert.equal(welcome.p.authoritative.movement, true);
  assert.equal(welcome.p.you.x, T.spawns.quay.x); assert.equal(welcome.p.you.y, T.spawns.quay.y); assert.equal(welcome.p.you.ack, -1);
  w.close();
});

test('the position the server reports is exactly the shared rules applied to the intents it acknowledged', async () => {
  const a = await player('Exact'); const { w, welcome } = await join(a);
  const r = await walk(w, 0, 16, { x: 1, y: -.4 });
  const st = await w.wait(m => m.type === 'state' && m.p.you.ack === r.last, 3000);
  const s = { x: welcome.p.you.x, y: welcome.p.you.y, stam: welcome.p.you.stam, sect: welcome.p.you.sect, t: 0, lastDrain: -99 }; const ctx = ctxOf(a.ch);
  for (const i of r.sent) MV.step(T.world, s, { x: i.x, y: i.y, want: i.w, sprint: i.r }, ctx, COL);
  assert.ok(Math.abs(st.p.you.x - s.x) < 1e-9 && Math.abs(st.p.you.y - s.y) < 1e-9, `server ${st.p.you.x},${st.p.you.y} vs replay ${s.x},${s.y}`);
  assert.ok(Math.hypot(s.x - welcome.p.you.x, s.y - welcome.p.you.y) > 1, 'it actually walked');
  w.close();
});

test('a flood of intents cannot make anyone faster than real time', async () => {
  const a = await player('Speedy'); const { w, welcome } = await join(a);
  const t0 = Date.now(); let s = 0;
  for (let k = 0; k < 12; k++) { w.send('move', { inputs: Array.from({ length: 10 }, () => ({ s: s++, x: 0, y: 1, w: 1, r: true })) }); await sleep(20); }
  await sleep(900); const el = (Date.now() - t0) / 1000;
  const st = lastState(w)!; const d = Math.hypot(st.p.you.x - welcome.p.you.x, st.p.you.y - welcome.p.you.y);
  const max = 5.3 * 1.5 * (el + 0.15);
  assert.ok(d <= max, `moved ${d.toFixed(2)} tiles in ${el.toFixed(2)} s; at most ${max.toFixed(2)}`);
  w.close();
});

test('walls and water hold: walking into the harbour leaves the character on standable ground', async () => {
  const a = await player('Swim'); const { w } = await join(a);
  const r = await walk(w, 0, 60, { x: -1, y: 0 }, true);
  const st = await w.wait(m => m.type === 'state' && m.p.you.ack === r.last, 3000);
  assert.ok(COL.canStand(T.world, st.p.you.x, st.p.you.y)); assert.ok(st.p.you.x > 36, 'did not walk out onto the sea');
  w.close();
});

test('interest management: a nearby character is announced and its steps arrive; a distant one is not; walking away drops it', async () => {
  const a = await player('Near'), b = await player('Watcher'), far = await player('Faraway');
  await srv.db.query(`update game.characters set position = '{"map":"anniabreen","town":"quay","x":2342.5,"y":860.7}' where id = $1`, [far.ch.id]);
  const B = await join(b); const F = await join(far); const A = await join(a);
  const e = await B.w.wait(m => m.type === 'actor.enter' && m.p.characterId === a.ch.id); assert.equal(e.p.name, a.ch.name);
  assert.equal(JSON.stringify(e).includes(a.ch.id) && JSON.stringify(e.p).includes('account'), false, 'no account id');
  await sleep(200); assert.equal(F.w.msgs.some(m => m.type === 'actor.enter'), false, 'the far character sees nobody');
  const r = await walk(A.w, 0, 10, { x: 1, y: 0 });
  await B.w.wait(m => m.type === 'state' && m.p.moves.some((mv: any) => mv[0] === e.p.nid && mv[1] > e.p.x + .5));
  await walk(A.w, r.last + 1, 60, { x: 1, y: 0 }, true);   // radius 12 + margin: about 3 s of sprinting gets well clear
  await B.w.wait(m => m.type === 'actor.leave' && m.p.nid === e.p.nid, 8000);
  A.w.close(); B.w.close(); F.w.close();
});

test('positions persist: sign out and back in, reconnect within the grace period, and across a server restart', async () => {
  const a = await player('Keep'); const A = await join(a);
  const r = await walk(A.w, 0, 12, { x: 1, y: .5 }); const st = await A.w.wait(m => m.type === 'state' && m.p.you.ack === r.last, 3000);
  // a quick reconnect: the character never left the world
  A.w.ws.terminate(); await sleep(300); const B = await join(a);
  assert.equal(B.welcome.p.resumed, true); assert.equal(B.welcome.p.you.x, st.p.you.x); assert.equal(B.welcome.p.you.y, st.p.you.y);
  // sign out: saved at once
  await a.c.post('/api/auth/logout'); await B.w.waitClose(); await sleep(300);
  const row = (await srv.db.query('select position from game.characters where id = $1', [a.ch.id])).rows[0].position;
  assert.ok(Math.abs(row.x - st.p.you.x) < 0.001 && Math.abs(row.y - st.p.you.y) < 0.001, 'saved on sign-out: ' + JSON.stringify(row));
  assert.equal((await a.c.post('/api/auth/login', { email: a.email, password: a.password })).status, 200);
  const C = await join(a); assert.equal(C.welcome.p.resumed, false);
  assert.ok(Math.abs(C.welcome.p.you.x - st.p.you.x) < 0.001 && Math.abs(C.welcome.p.you.y - st.p.you.y) < 0.001, 'back where they left');
  C.w.close();
});

test('a restart saves every position', async () => {
  const s2 = await startServer();
  const u = await signUp(s2); const ch = (await u.c.post(RT, creation(uniq('Rest')))).json.character;
  const { w } = await WsClient.open(s2, u.c); w!.send('hello', { characterId: ch.id }); await w!.wait(m => m.type === 'welcome');
  const r = await walk(w!, 0, 10, { x: 0, y: 1 }); const st = await w!.wait(m => m.type === 'state' && m.p.you.ack === r.last, 3000);
  await s2.app.gateway.shutdown();
  const row = (await s2.db.query('select position from game.characters where id = $1', [ch.id])).rows[0].position;
  assert.ok(Math.abs(row.y - st.p.you.y) < 0.001, 'saved on shutdown');
  await s2.close();
});
