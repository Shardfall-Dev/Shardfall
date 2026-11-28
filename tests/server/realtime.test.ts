/* The realtime gateway: authenticated upgrade, ownership, two accounts seeing each other, takeover, reconnect, limits. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto = require('node:crypto');
import { startServer, signUp, creation, WsClient, Client, sleep, type TestServer } from './helpers';
import P = require('../../shared/protocol');

let srv: TestServer;
before(async () => { srv = await startServer(); });
after(async () => { await srv?.close(); });
const R = '/api/realms/anniabreen/characters';
const uniq = (p: string) => p + crypto.randomBytes(3).toString('hex').replace(/\d/g, d => 'abcdefghij'[+d]);
async function player(tag: string) { const u = await signUp(srv); const ch = (await u.c.post(R, creation(uniq(tag)))).json.character; return Object.assign(u, { ch }); }
async function join(p: { c: Client; ch: any }) { const { w } = await WsClient.open(srv, p.c); assert.ok(w, 'upgrade accepted'); w!.send('hello', { characterId: p.ch.id }); const welcome = await w!.wait(m => m.type === 'welcome'); return { w: w!, welcome }; }

test('upgrade needs a session and an allowed Origin', async () => {
  assert.equal((await WsClient.open(srv, null)).status, 401);
  const a = await player('Gate');
  assert.equal((await WsClient.open(srv, a.c, 'https://evil.example')).status, 403);
  assert.equal((await WsClient.open(srv, a.c, null)).status, 403);
  const { w } = await WsClient.open(srv, a.c); assert.ok(w); w!.close();
});

test('two separate accounts connect at once and see each other’s presence', async () => {
  const a = await player('Alder'), b = await player('Briar');
  const A = await join(a);
  assert.equal(A.welcome.p.serverAuthoritative, false); assert.equal(A.welcome.p.tickMs, 50); assert.equal(A.welcome.p.character.id, a.ch.id);
  assert.ok(A.welcome.p.character.items.length > 0, 'the snapshot carries the server-owned items');
  const B = await join(b);
  assert.ok(B.welcome.p.presence.some((x: any) => x.characterId === a.ch.id && x.name === a.ch.name), 'B sees A on arrival');
  const j = await A.w.wait(m => m.type === 'presence.join' && m.p.character.characterId === b.ch.id); assert.equal(j.p.character.name, b.ch.name);
  assert.equal(JSON.stringify(B.welcome.p.presence).includes('account'), false, 'presence carries no account ids');
  // sequence numbers increase per connection
  const seqs = A.w.msgs.map(m => m.seq); assert.deepEqual(seqs, [...seqs].sort((x, y) => x - y));
  B.w.send('ping', { t: 1 }); const pong = await B.w.wait(m => m.type === 'pong'); assert.ok(pong.p.tick >= 0);
  B.w.send('resync'); const snap = await B.w.wait(m => m.type === 'snapshot'); assert.equal(snap.p.character.id, b.ch.id);
  // B logs out: A sees the leave at once (no reconnect grace for a sign-out)
  assert.equal((await b.c.post('/api/auth/logout')).status, 200);
  const k = await B.w.wait(m => m.type === 'kicked'); assert.equal(k.p.reason, 'session_ended'); assert.equal((await B.w.waitClose()).code, P.CLOSE.SESSION_ENDED);
  await A.w.wait(m => m.type === 'presence.leave' && m.p.characterId === b.ch.id);
  A.w.close();
});

test('a character of another account cannot be played (closes 4003)', async () => {
  const a = await player('Own'), b = await player('Thief');
  const { w } = await WsClient.open(srv, b.c); w!.send('hello', { characterId: a.ch.id });
  const e = await w!.wait(m => m.type === 'error'); assert.equal(e.p.code, 'not_found'); assert.equal((await w!.waitClose()).code, P.CLOSE.FORBIDDEN);
});

test('client-authoritative messages are refused and change nothing', async () => {
  const a = await player('Cheat'); const { w } = await join(a);
  for (const type of ['move', 'attack', 'gold', 'inventory', 'skill', 'stat', 'damage']) { const id = w.send(type, { gold: 1e9, x: 5, y: 5 }); const e = await w.wait(m => m.type === 'error' && m.id === id); assert.equal(e.p.code, 'not_authoritative'); }
  w.send('', {}, '{"v":1,"type":"hello","p":{"characterId":"' + a.ch.id + '","gold":5}}'); await w.wait(m => m.type === 'error' && m.p.code === 'bad_payload');
  const id2 = w.send('hello', { characterId: a.ch.id }); assert.equal((await w.wait(m => m.id === id2)).p.code, 'already_joined');
  const fresh = (await a.c.get('/api/characters/' + a.ch.id)).json.character; assert.deepEqual(fresh.items, a.ch.items); assert.deepEqual(fresh.stats, a.ch.stats);
  assert.equal(w.closed, null, 'refusals alone do not drop the player');
  w.close();
});

test('protocol mismatch, binary frames, oversize frames and floods are handled', async () => {
  const a = await player('Noisy');
  const { w } = await WsClient.open(srv, a.c); w!.send('', {}, JSON.stringify({ v: 99, type: 'ping', p: {} }));
  assert.equal((await w!.waitClose()).code, P.CLOSE.PROTOCOL);
  const { w: w2 } = await WsClient.open(srv, a.c); w2!.ws.send('x'.repeat(P.MAX_MESSAGE_BYTES + 100));
  assert.equal((await w2!.waitClose()).code, 1009, 'payload limit');
  const { w: w3 } = await WsClient.open(srv, a.c); for (let i = 0; i < 80; i++) w3!.send('ping', { t: i });
  assert.equal((await w3!.waitClose()).code, P.CLOSE.RATE_LIMIT);
  assert.ok(w3!.msgs.some(m => m.type === 'error' && m.p.code === 'rate_limited'));
});

test('a second connection for the same character takes over; the other side sees no leave/join flicker', async () => {
  const a = await player('Twin'), o = await player('Watch');
  const O = await join(o); const first = await join(a);
  await O.w.wait(m => m.type === 'presence.join' && m.p.character.characterId === a.ch.id);
  const second = await join(a);
  assert.equal(second.welcome.p.resumed, true);
  const k = await first.w.wait(m => m.type === 'kicked'); assert.equal(k.p.reason, 'taken_over'); assert.equal((await first.w.waitClose()).code, P.CLOSE.TAKEN_OVER);
  await sleep(300);
  assert.equal(O.w.msgs.filter(m => m.type === 'presence.leave' && m.p.characterId === a.ch.id).length, 0);
  assert.equal(O.w.msgs.filter(m => m.type === 'presence.join' && m.p.character.characterId === a.ch.id).length, 1);
  O.w.close(); second.w.close();
});

test('one character per account per realm: joining with another character takes over the first', async () => {
  const a = await player('First'); const ch2 = (await a.c.post(R, creation(uniq('Second')))).json.character;
  const one = await join(a);
  const { w } = await WsClient.open(srv, a.c); w!.send('hello', { characterId: ch2.id }); await w!.wait(m => m.type === 'welcome');
  assert.equal((await one.w.wait(m => m.type === 'kicked')).p.reason, 'another_character');
  w!.close();
});

test('a dropped connection reconnects within the grace period without a leave; after it the leave is sent', async () => {
  const a = await player('Drop'), o = await player('Seer');
  const O = await join(o); const A = await join(a); await O.w.wait(m => m.type === 'presence.join' && m.p.character.characterId === a.ch.id);
  A.w.ws.terminate(); await sleep(500);
  const again = await join(a); assert.equal(again.welcome.p.resumed, true);
  await sleep(300); assert.equal(O.w.msgs.filter(m => m.type === 'presence.leave' && m.p.characterId === a.ch.id).length, 0, 'no leave for a quick reconnect');
  again.w.close();
  await O.w.wait(m => m.type === 'presence.leave' && m.p.characterId === a.ch.id, P.RECONNECT_GRACE_MS + 3000);
  O.w.close();
});

test('deleting a character ends its connection and its presence at once', async () => {
  const a = await player('Doomed'), o = await player('Mourn');
  const O = await join(o); const A = await join(a); await O.w.wait(m => m.type === 'presence.join' && m.p.character.characterId === a.ch.id);
  assert.equal((await a.c.post(`/api/characters/${a.ch.id}/delete`, { confirmName: a.ch.name })).status, 200);
  assert.equal((await A.w.wait(m => m.type === 'kicked')).p.reason, 'character_deleted');
  await O.w.wait(m => m.type === 'presence.leave' && m.p.characterId === a.ch.id);
  O.w.close();
});

test('the world tick advances at the game step', async () => {
  const t0 = srv.app.world.tick; await sleep(520); const n = srv.app.world.tick - t0; assert.ok(n >= 8 && n <= 12, 'about 10 ticks in 0.5 s, got ' + n);
  assert.equal(srv.app.world.submit({ kind: 'move', characterId: 'x', payload: {} }), false, 'no gameplay command has a handler yet');
});
