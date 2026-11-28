import test from 'node:test';
import assert from 'node:assert/strict';
import crypto = require('node:crypto');
import { encrypt, decrypt, pkcePair, randomToken, safeEqual, sha256 } from '../../../server/src/auth/crypto';

test('AES-256-GCM round trip, tamper and purpose binding', () => {
  const k = crypto.randomBytes(32); const b = encrypt(k, 'refresh-token', 'a');
  assert.equal(decrypt(k, b, 'a'), 'refresh-token');
  assert.throws(() => decrypt(k, b, 'b'));
  const t = Buffer.from(b); t[t.length - 1] ^= 1; assert.throws(() => decrypt(k, t, 'a'));
  assert.throws(() => decrypt(crypto.randomBytes(32), b, 'a'));
});
test('PKCE S256 pair (RFC 7636)', () => {
  const { verifier, challenge } = pkcePair(); assert.ok(verifier.length >= 43 && verifier.length <= 128);
  assert.equal(challenge, crypto.createHash('sha256').update(verifier).digest('base64url'));
});
test('tokens are random and compared in constant time', () => {
  assert.notEqual(randomToken(), randomToken()); assert.equal(randomToken(32).length, 43);
  assert.equal(safeEqual('abc', 'abc'), true); assert.equal(safeEqual('abc', 'abd'), false); assert.equal(safeEqual('abc', 'ab'), false);
  assert.equal(sha256('x').length, 32);
});
