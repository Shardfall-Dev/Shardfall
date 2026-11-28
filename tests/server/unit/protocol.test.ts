/* shared/protocol.js — the realtime envelope and its validation (no server needed) */
import test from 'node:test';
import assert from 'node:assert/strict';
import P = require('../../../shared/protocol');

const env = (o: object) => JSON.stringify(Object.assign({ v: P.PROTOCOL_VERSION }, o));
const ID = '0b6f5c3e-8a1d-4c7e-9f2a-1d2e3f4a5b6c';

test('valid client messages parse', () => {
  assert.deepEqual(P.parseClient(env({ type: 'hello', id: 'r1', p: { characterId: ID } })), { ok: true, msg: { type: 'hello', id: 'r1', p: { characterId: ID } } });
  assert.equal(P.parseClient(env({ type: 'ping', p: { t: 5 } })).ok, true);
  assert.equal(P.parseClient(env({ type: 'resync' })).ok, true);
  assert.equal(P.parseClient(env({ type: 'hello', p: { characterId: ID, lastSeq: 12 } })).ok, true);
});

test('every gameplay message a client could forge is refused as not authoritative', () => {
  for (const type of ['move', 'attack', 'cast', 'equip', 'pickup', 'drop', 'trade', 'gold', 'skill', 'stat', 'inventory', 'damage', 'craft', 'loot']) {
    const r = P.parseClient(env({ type, p: { gold: 1e9, x: 1, y: 2 } }));
    assert.equal(r.ok, false); assert.equal((r as any).code, 'not_authoritative', type);
  }
});

test('malformed frames are refused with a reason, never thrown', () => {
  const bad: [unknown, string][] = [
    [123, 'bad_frame'], ['not json', 'bad_json'], ['[]', 'bad_envelope'], [JSON.stringify({ type: 'ping' }), 'protocol_mismatch'],
    [JSON.stringify({ v: 99, type: 'ping' }), 'protocol_mismatch'], [env({ type: 'nope' }), 'unknown_type'], [env({ type: 'ping', extra: 1 }), 'bad_envelope'],
    [env({ type: 'hello', p: { characterId: 'abc' } }), 'bad_payload'], [env({ type: 'hello', p: { characterId: ID, gold: 5 } }), 'bad_payload'],
    [env({ type: 'hello', p: [] }), 'bad_payload'], [env({ type: 'ping', id: '' }), 'bad_envelope'], [env({ type: 'ping', id: 'x'.repeat(65) }), 'bad_envelope'],
    [env({ type: 'ping', p: { t: 'x' } }), 'bad_payload'], ['x'.repeat(P.MAX_MESSAGE_BYTES + 1), 'too_big'], [env({ type: '__proto__' }), 'unknown_type'],
  ];
  for (const [t, code] of bad) { const r = P.parseClient(t); assert.equal(r.ok, false); assert.equal((r as any).code, code, String(t).slice(0, 40)); }
});

test('encode / parseServer round trip carries id and sequence', () => {
  const t = P.encode('pong', { tick: 3 }, { id: 'a', seq: 7 }); const r = P.parseServer(t);
  assert.equal(r.ok, true); assert.deepEqual((r as any).msg, { v: P.PROTOCOL_VERSION, type: 'pong', p: { tick: 3 }, id: 'a', seq: 7 });
  assert.equal(P.parseServer(P.encode('move', {})).ok, false);
});

test('the server tick is the game simulation step', () => {
  const world = require('fs').readFileSync(require('path').join(__dirname, '../../../src/world.js'), 'utf8');
  assert.match(world, /50/); assert.equal(P.TICK_MS, 50);
});
