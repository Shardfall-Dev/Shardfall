/* Small wrappers over node:crypto. No custom cryptography: random tokens from the OS CSPRNG, SHA-256 to look tokens up
   without storing them, AES-256-GCM (authenticated encryption) for provider tokens at rest, and the RFC 7636 S256 PKCE pair.
   Passwords never reach this module: Supabase Auth stores and checks them. */
import crypto = require('node:crypto');

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest();

/* encrypt(key, plaintext) → iv(12) | tag(16) | ciphertext. aad binds the blob to its purpose (e.g. 'session-tokens'). */
export function encrypt(key: Buffer, plaintext: string, aad: string): Buffer {
  const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key, iv); c.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), ct]);
}
export function decrypt(key: Buffer, blob: Buffer, aad: string): string {
  if (!Buffer.isBuffer(blob) || blob.length < 29) throw new Error('bad ciphertext');
  const d = crypto.createDecipheriv('aes-256-gcm', key, blob.subarray(0, 12)); d.setAAD(Buffer.from(aad, 'utf8')); d.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([d.update(blob.subarray(28)), d.final()]).toString('utf8');
}

/* PKCE (RFC 7636): a 43–128 character verifier and its S256 challenge */
export function pkcePair() { const verifier = crypto.randomBytes(48).toString('base64url'); return { verifier, challenge: crypto.createHash('sha256').update(verifier).digest('base64url') }; }

/* constant-time string comparison for CSRF tokens */
export function safeEqual(a: string, b: string) { const x = Buffer.from(a, 'utf8'), y = Buffer.from(b, 'utf8'); return x.length === y.length && crypto.timingSafeEqual(x, y); }
