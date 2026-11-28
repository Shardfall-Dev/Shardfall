/* Accounts and sessions against the real stack: PostgreSQL + Supabase Auth + Mailpit (server/dev/docker-compose.yml). */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client, signUp, uniqueEmail, waitForEmail, PASSWORD, type TestServer, sleep } from './helpers';

let srv: TestServer;
before(async () => { srv = await startServer(); });
after(async () => { await srv?.close(); });

test('config and health', async () => {
  const c = new Client(srv.base);
  assert.equal((await c.get('/api/health')).status, 200);
  const ready = await c.get('/api/ready'); assert.equal(ready.status, 200, ready.text); assert.equal(ready.json.db, true); assert.equal(ready.json.auth, true);
  const cfg = (await c.get('/api/config')).json;
  assert.equal(cfg.online, true); assert.equal(cfg.serverAuthoritative, false);
  assert.equal(cfg.providers.google, true, 'google enabled in this server and in the local Supabase Auth fixture');
  assert.equal(cfg.providers.apple, false, 'apple enabled here but not configured in Supabase Auth: hidden');
  assert.deepEqual((await c.get('/api/session')).json, { authenticated: false });
});

test('register → verification email → confirmed and signed in; account row keyed by the provider user id', async () => {
  const { c, email } = await signUp(srv, undefined, undefined, 'Tess of the Quay');
  const s = await c.session(); assert.equal(s.authenticated, true); assert.equal(s.kind, 'full'); assert.equal(s.account.displayName, 'Tess of the Quay');
  const acc = await c.get('/api/account'); assert.equal(acc.status, 200); assert.equal(acc.json.email, email); assert.equal(acc.json.emailVerified, true);
  assert.deepEqual(acc.json.identities.map((i: any) => i.provider), ['email']);
  const rows = (await srv.db.query('select auth_subject, display_name from game.accounts')).rows;
  assert.ok(rows.some((r: any) => /^[0-9a-f-]{36}$/.test(r.auth_subject) && r.display_name === 'Tess of the Quay'), 'auth_subject is the Supabase user id, not the email');
  assert.equal(rows.some((r: any) => r.auth_subject.includes('@')), false);
  const cookie = [...c.cookies.keys()]; assert.deepEqual(cookie, ['sf_session'], 'flow cookie cleared, one session cookie');
  const raw = (await srv.db.query('select token_hash, provider_tokens from game.sessions')).rows;
  for (const r of raw) { assert.equal(r.token_hash.length, 32); assert.equal(r.provider_tokens.toString('utf8').includes('eyJ'), false, 'provider tokens are encrypted at rest'); }
});

test('an unverified address cannot sign in; wrong passwords get one generic error', async () => {
  const email = uniqueEmail('unverified'); const c = new Client(srv.base);
  assert.equal((await c.post('/api/auth/register', { email, password: PASSWORD })).status, 200);
  const r = await c.post('/api/auth/login', { email, password: PASSWORD }); assert.equal(r.status, 403); assert.equal(r.json.error.code, 'email_not_confirmed');
  await waitForEmail(email);   // drain
  const { email: e2 } = await signUp(srv);
  const bad = await new Client(srv.base).post('/api/auth/login', { email: e2, password: 'wrong-password-123' });
  const none = await new Client(srv.base).post('/api/auth/login', { email: uniqueEmail('nobody'), password: 'wrong-password-123' });
  assert.equal(bad.status, 401); assert.equal(none.status, 401); assert.deepEqual(bad.json, none.json, 'no account enumeration');
});

test('registering an existing address reveals nothing', async () => {
  const { email } = await signUp(srv);
  const r = await new Client(srv.base).post('/api/auth/register', { email, password: PASSWORD });
  const r2 = await new Client(srv.base).post('/api/auth/register', { email: uniqueEmail('fresh'), password: PASSWORD });
  assert.equal(r.status, 200); assert.equal(r.json.message, r2.json.message);
});

test('login rotates the session id; logout revokes it server-side', async () => {
  const { c, email } = await signUp(srv);
  const first = c.cookies.get('sf_session');
  const l = await c.post('/api/auth/login', { email, password: PASSWORD }); assert.equal(l.status, 200);
  const second = c.cookies.get('sf_session'); assert.ok(second && second !== first, 'a new session id on sign-in');
  const stale = new Client(srv.base); stale.cookies.set('sf_session', first!); assert.equal((await stale.session()).authenticated, false, 'the old session id is dead');
  const copy = new Client(srv.base); copy.cookies.set('sf_session', second!); await copy.session();
  assert.equal((await c.post('/api/auth/logout')).status, 200);
  assert.equal(c.cookies.has('sf_session'), false);
  assert.equal((await copy.session()).authenticated, false, 'a copied cookie stops working after logout');
});

test('CSRF and origin: mutations need the session CSRF token, an allowed Origin and the client header', async () => {
  const { c } = await signUp(srv);
  assert.equal((await c.req('PATCH', '/api/account', { displayName: 'Ok Name' })).status, 200);
  assert.equal((await c.req('PATCH', '/api/account', { displayName: 'Nope' }, { csrf: false })).json.error.code, 'bad_csrf');
  assert.equal((await c.req('PATCH', '/api/account', { displayName: 'Nope' }, { origin: 'https://evil.example' })).json.error.code, 'bad_origin');
  assert.equal((await c.req('PATCH', '/api/account', { displayName: 'Nope' }, { origin: null })).status, 403, 'no Origin and no Referer: refused');
  assert.equal((await c.req('PATCH', '/api/account', { displayName: 'Nope' }, { clientHeader: false })).status, 403);
  assert.equal((await new Client(srv.base).post('/api/auth/login', { email: 'a@b.cd', password: 'x' }, { origin: 'https://evil.example' })).status, 403, 'login CSRF refused');
});

test('expired, idle, revoked and garbage sessions are rejected', async () => {
  const { c } = await signUp(srv);
  const tok = c.cookies.get('sf_session')!;
  await srv.db.query(`update game.sessions set expires_at = now() - interval '1 second' where revoked_at is null and account_id = (select account_id from game.sessions order by created_at desc limit 1)`);
  assert.equal((await c.get('/api/realms')).status, 401); assert.equal(c.cookies.has('sf_session'), false, 'cookie cleared');
  const { c: c2 } = await signUp(srv);
  await srv.db.query(`update game.sessions set last_seen_at = now() - interval '200 hours' where id = (select id from game.sessions order by created_at desc limit 1)`);
  assert.equal((await c2.get('/api/realms')).status, 401, 'idle timeout');
  const { c: c3 } = await signUp(srv);
  await srv.db.query(`update game.sessions set revoked_at = now() where id = (select id from game.sessions order by created_at desc limit 1)`);
  assert.equal((await c3.get('/api/realms')).status, 401, 'revoked');
  const g = new Client(srv.base); g.cookies.set('sf_session', 'x'.repeat(43)); assert.equal((await g.get('/api/realms')).status, 401, 'unknown token');
  void tok;
});

test('a user deleted in Supabase Auth loses the session at the next provider check', async () => {
  const { c } = await signUp(srv);
  const sub = (await srv.db.query('select a.auth_subject from game.sessions s join game.accounts a on a.id = s.account_id order by s.created_at desc limit 1')).rows[0].auth_subject;
  await srv.app.sessions.auth.adminDeleteUser(sub);
  await srv.db.query(`update game.sessions set provider_checked_at = now() - interval '1 hour' where id = (select id from game.sessions order by created_at desc limit 1)`);
  assert.equal((await c.get('/api/realms')).status, 401);
  const r = (await srv.db.query('select revoked_reason from game.sessions order by created_at desc limit 1')).rows[0]; assert.equal(r.revoked_reason, 'provider_revoked');
});

test('password recovery: email link in the same browser → recovery session → new password → full session; old password fails', async () => {
  const { email } = await signUp(srv);
  const b = new Client(srv.base);
  const r = await b.post('/api/auth/recover', { email }); assert.equal(r.status, 200);
  const unknown = await new Client(srv.base).post('/api/auth/recover', { email: uniqueEmail('ghost') }); assert.equal(unknown.json.message, r.json.message, 'same answer for unknown addresses');
  const mail = await waitForEmail(email);
  const end = await b.follow(mail.link); assert.match(end.url, /online=reset/);
  const s = await b.session(); assert.equal(s.kind, 'recovery');
  assert.equal((await b.get('/api/realms')).json.error.code, 'recovery_only', 'a recovery session cannot play');
  assert.equal((await b.post('/api/auth/password', { password: 'short' })).status, 400);
  const p = await b.post('/api/auth/password', { password: 'a-brand-new-password-9' }); assert.equal(p.status, 200, p.text);
  assert.equal((await b.session()).kind, 'full');
  assert.equal((await new Client(srv.base).post('/api/auth/login', { email, password: PASSWORD })).status, 401);
  assert.equal((await new Client(srv.base).post('/api/auth/login', { email, password: 'a-brand-new-password-9' })).status, 200);
});

test('a reset link opened in another browser does not sign anyone in', async () => {
  const { email } = await signUp(srv);
  await new Client(srv.base).post('/api/auth/recover', { email });
  const mail = await waitForEmail(email);
  const other = new Client(srv.base); const end = await other.follow(mail.link);
  assert.match(end.url, /auth_notice=open_in_same_browser/); assert.equal((await other.session()).authenticated, false);
});

test('sensitive actions need a recent sign-in; reauth with the password unlocks them', async () => {
  const { c } = await signUp(srv);
  await srv.db.query(`update game.sessions set authenticated_at = now() - interval '1 hour' where id = (select id from game.sessions order by created_at desc limit 1)`);
  assert.equal((await c.req('DELETE', '/api/account', { confirm: 'DELETE MY ACCOUNT' })).json.error.code, 'reauth_required');
  assert.equal((await c.post('/api/auth/reauth', { password: 'not-it-at-all' })).status, 401);
  assert.equal((await c.post('/api/auth/reauth', { password: PASSWORD })).status, 200);
  assert.equal((await c.get('/api/account')).json.recentAuth, true);
});

test('logout everywhere ends every session of the account', async () => {
  const { c, email } = await signUp(srv);
  const d = new Client(srv.base); assert.equal((await d.post('/api/auth/login', { email, password: PASSWORD })).status, 200);
  assert.equal((await c.post('/api/auth/logout-all')).json.ended, 2);
  assert.equal((await d.session()).authenticated, false);
});

test('account export and deletion (identity first, then the game data)', async () => {
  const { c, email } = await signUp(srv);
  const ex = await c.get('/api/account/export'); assert.equal(ex.status, 200); assert.ok(ex.json.account.id); assert.equal(JSON.stringify(ex.json).includes('token'), false);
  assert.equal((await c.req('DELETE', '/api/account', { confirm: 'delete' })).json.error.code, 'confirm_phrase');
  const del = await c.req('DELETE', '/api/account', { confirm: 'DELETE MY ACCOUNT' }); assert.equal(del.status, 200, del.text);
  assert.equal((await c.session()).authenticated, false);
  assert.equal((await new Client(srv.base).post('/api/auth/login', { email, password: PASSWORD })).status, 401, 'the identity is gone');
});

test('Google / Apple plumbing: start redirects to Supabase Auth with PKCE; callback refuses missing, reused or foreign flows', async () => {
  const c = new Client(srv.base);
  const start = await c.get('/api/auth/oauth/google'); assert.equal(start.status, 303);
  const loc = new URL(start.headers.get('location')!); assert.equal(loc.origin + loc.pathname, srv.app.sessions.auth.url('/authorize'));
  assert.equal(loc.searchParams.get('provider'), 'google'); assert.equal(loc.searchParams.get('code_challenge_method'), 's256'); assert.ok((loc.searchParams.get('code_challenge') || '').length >= 43);
  assert.equal(loc.searchParams.get('redirect_to'), srv.base + '/api/auth/callback'); assert.ok(c.cookies.has('sf_flow'));
  // Supabase Auth itself sends the browser on to Google (nothing is sent to Google with the placeholder fixture credentials)
  const sb = await fetch(loc, { redirect: 'manual' }); assert.equal(sb.status, 302); assert.match(sb.headers.get('location') || '', /^https:\/\/accounts\.google\.com\//);
  assert.equal((await c.get('/api/auth/oauth/apple')).status, 404, 'apple not configured in Supabase Auth → not offered');
  assert.equal((await c.get('/api/auth/oauth/github')).status, 404);
  const cancelled = await c.get('/api/auth/callback?error=access_denied&error_description=User+cancelled'); assert.match(cancelled.headers.get('location')!, /auth_error=cancelled/);
  assert.equal(c.cookies.has('sf_flow'), false, 'the flow is spent');
  const noFlow = await new Client(srv.base).get('/api/auth/callback?code=abcdefghijklmnop'); assert.match(noFlow.headers.get('location')!, /auth_notice=open_in_same_browser/);
  const c2 = new Client(srv.base); await c2.get('/api/auth/oauth/google'); const forged = await c2.get('/api/auth/callback?code=forged-code-123456');
  assert.match(forged.headers.get('location')!, /auth_error=link_expired/, 'a code that is not ours fails the PKCE exchange');
  const odd = await new Client(srv.base).get('/api/auth/callback?code=%3Cscript%3E'); assert.match(odd.headers.get('location')!, /^\/\?online=signin/);
  for (const r of [cancelled, noFlow, forged, odd]) assert.ok(r.headers.get('location')!.startsWith('/?'), 'redirects stay on this site');
});

test('rate limits on the sign-in routes', async () => {
  const s2 = await startServer({ AUTH_RATE_LIMIT_PER_MINUTE: '3' });
  try {
    const c = new Client(s2.base); const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await c.post('/api/auth/login', { email: 'a@shardfall.test', password: 'whatever-123' })).status);
    assert.deepEqual(codes.slice(0, 3), [401, 401, 401]); assert.equal(codes[4], 429);
  } finally { await s2.close(); }
});

test('nothing secret is logged in responses or the session payload', async () => {
  const { c } = await signUp(srv);
  const s = await c.get('/api/session'); assert.equal(/refresh|access_token|eyJ/.test(s.text), false);
  await sleep(10);
});

test('the game page and its audio are not rate limited like the API', async () => {
  const s2 = await startServer({ RATE_LIMIT_PER_MINUTE: '10' });
  try {
    const c = new Client(s2.base); const codes: number[] = [];
    for (let i = 0; i < 15; i++) codes.push((await c.get('/')).status);
    assert.ok(codes.every(x => x === 200), 'page: ' + codes.join(','));
    const api: number[] = []; for (let i = 0; i < 12; i++) api.push((await c.get('/api/config')).status);
    assert.equal(api[11], 429, 'the API is');
  } finally { await s2.close(); }
});
