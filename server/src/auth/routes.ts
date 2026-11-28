/* /api/auth/* — registration, email verification, sign-in, sign-out, password recovery, Google / Apple sign-in, re-authentication.
   Errors are generic where a specific one would reveal whether an address has an account. Redirects only ever go to fixed
   paths on PUBLIC_URL (no caller-supplied redirect targets). */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config';
import type { Db } from '../db/pool';
import { pkcePair } from './crypto';
import { AuthError } from './supabase';
import { Sessions, audit } from './sessions';
import { fail, setSessionCookie, clearSessionCookie, setFlowCookie, clearFlowCookie, cookieNames, checkMutationOrigin, makeGuards } from './guard';

export const EMAIL = { type: 'string', minLength: 3, maxLength: 254, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' } as const;
export const PASSWORD = { type: 'string', minLength: 10, maxLength: 72 } as const;
const DISPLAY = { type: 'string', minLength: 2, maxLength: 32 } as const;
export const PROVIDERS = ['google', 'apple'] as const;

export async function providerStatus(cfg: Config, sessions: Sessions) {
  // a provider button shows only when it is enabled here AND in Supabase Auth (where its credentials live)
  let ext: Record<string, boolean> = {}; let reachable = true;
  try { ext = (await sessions.auth.settings()).external || {}; } catch { reachable = false; }
  return { emailPassword: ext.email !== false, google: cfg.oauth.google && !!ext.google, apple: cfg.oauth.apple && !!ext.apple, authReachable: reachable };
}

export function registerAuthRoutes(app: FastifyInstance, cfg: Config, db: Db, sessions: Sessions, guards: ReturnType<typeof makeGuards>, onSessionsEnded: (ids: string[]) => void) {
  const callbackUrl = new URL('/api/auth/callback', cfg.publicUrl).toString();
  const home = (state: string, extra: Record<string, string> = {}) => { const u = new URL('/', cfg.publicUrl); u.searchParams.set('online', state); for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v); return u.pathname + u.search; };
  const authLimit = { rateLimit: { max: cfg.rateLimit.authPerMin, timeWindow: '1 minute' } };
  const sessionReply = (reply: FastifyReply, created: { token: string; csrf: string }, kind: 'full' | 'recovery' = 'full') => {
    setSessionCookie(cfg, reply, created.token, kind === 'recovery' ? cfg.recoveryTtlMs : cfg.sessionTtlMs);
  };

  app.post('/api/auth/register', { config: authLimit, schema: { body: { type: 'object', additionalProperties: false, required: ['email', 'password'], properties: { email: EMAIL, password: PASSWORD, displayName: DISPLAY } } } },
    async (req: FastifyRequest<{ Body: { email: string; password: string; displayName?: string } }>, reply) => {
      checkMutationOrigin(cfg, req);
      const { verifier, challenge } = pkcePair();
      const flow = await sessions.createFlow('signup', verifier, { provider: 'email' });
      try { await sessions.auth.signUp(req.body.email.trim(), req.body.password, callbackUrl, challenge, req.body.displayName?.trim()); }
      catch (e) {
        if (e instanceof AuthError && e.unavailable) throw fail(503, 'auth_unavailable', 'The sign-in service is unreachable. Try again shortly.');
        if (e instanceof AuthError && (e.code === 'weak_password' || /password/i.test(e.message))) throw fail(400, 'weak_password', 'Choose a stronger password (at least 10 characters, not a common one).');
        if (e instanceof AuthError && (e.status === 429 || e.code === 'over_email_send_rate_limit')) throw fail(429, 'rate_limited', 'Too many attempts. Wait a minute and try again.');
        if (e instanceof AuthError && e.code === 'signup_disabled') throw fail(403, 'signup_disabled', 'New accounts are closed right now.');
        req.log.warn({ code: (e as AuthError).code }, 'signup refused by auth service');   // e.g. an address already registered: not revealed
      }
      setFlowCookie(cfg, reply, flow);
      return { ok: true, message: 'If this address can be used, a confirmation email is on its way. Open the link in this browser to finish.' };
    });

  app.post('/api/auth/login', { config: authLimit, schema: { body: { type: 'object', additionalProperties: false, required: ['email', 'password'], properties: { email: EMAIL, password: { type: 'string', minLength: 1, maxLength: 72 } } } } },
    async (req: FastifyRequest<{ Body: { email: string; password: string } }>, reply) => {
      checkMutationOrigin(cfg, req);
      let s;
      try { s = await sessions.auth.signInWithPassword(req.body.email.trim(), req.body.password); }
      catch (e) {
        const ae = e as AuthError;
        if (ae.unavailable) throw fail(503, 'auth_unavailable', 'The sign-in service is unreachable. Try again shortly.');
        if (ae.code === 'email_not_confirmed' || /not confirmed/i.test(ae.message)) throw fail(403, 'email_not_confirmed', 'Confirm your email address first: open the link we sent you.');
        if (ae.status === 429) throw fail(429, 'rate_limited', 'Too many attempts. Wait a minute and try again.');
        await audit(db, null, 'login.failed', {});
        throw fail(401, 'invalid_credentials', 'The email or password is not right.');
      }
      const old = req.cookies[cookieNames(cfg).session]; if (old) { const prev = await sessions.lookup(old); if (prev) await sessions.revoke(prev.id, 'replaced_by_login'); }
      const created = await sessions.create(s);
      sessionReply(reply, created);
      return { ok: true, csrfToken: created.csrf };
    });

  app.post('/api/auth/logout', { preHandler: guards.requireSession({ allowRecovery: true }) }, async (req, reply) => {
    const s = req.sess!;
    try { await sessions.auth.logout(await sessions.accessToken(s.id), 'local'); } catch (e) { req.log.info({ code: (e as AuthError).code }, 'provider logout failed (session revoked here anyway)'); }
    await sessions.revoke(s.id, 'logout'); await audit(db, s.account_id, 'session.logout', {});
    clearSessionCookie(cfg, reply); onSessionsEnded([s.id]);
    return { ok: true };
  });

  app.post('/api/auth/logout-all', { preHandler: guards.requireSession() }, async (req, reply) => {
    const s = req.sess!;
    try { await sessions.auth.logout(await sessions.accessToken(s.id), 'global'); } catch (e) { req.log.info({ code: (e as AuthError).code }, 'provider global logout failed'); }
    const ids = await sessions.revokeAll(s.account_id, 'logout_all'); await audit(db, s.account_id, 'session.logout_all', { count: ids.length });
    clearSessionCookie(cfg, reply); onSessionsEnded(ids);
    return { ok: true, ended: ids.length };
  });

  app.post('/api/auth/recover', { config: authLimit, schema: { body: { type: 'object', additionalProperties: false, required: ['email'], properties: { email: EMAIL } } } },
    async (req: FastifyRequest<{ Body: { email: string } }>, reply) => {
      checkMutationOrigin(cfg, req);
      const { verifier, challenge } = pkcePair();
      const flow = await sessions.createFlow('recovery', verifier, { provider: 'email' });
      try { await sessions.auth.recover(req.body.email.trim(), callbackUrl, challenge); }
      catch (e) { if ((e as AuthError).unavailable) throw fail(503, 'auth_unavailable', 'The sign-in service is unreachable. Try again shortly.'); req.log.info({ code: (e as AuthError).code }, 'recover refused'); }
      setFlowCookie(cfg, reply, flow);
      return { ok: true, message: 'If an account uses this address, a reset link is on its way. Open it in this browser.' };
    });

  /* set a new password: from a recovery session, or from a full session that signed in within the last few minutes */
  app.post('/api/auth/password', { config: authLimit, preHandler: guards.requireSession({ allowRecovery: true }), schema: { body: { type: 'object', additionalProperties: false, required: ['password'], properties: { password: PASSWORD } } } },
    async (req: FastifyRequest<{ Body: { password: string } }>, reply) => {
      const s = req.sess!;
      if (s.kind !== 'recovery' && !sessions.recentlyAuthenticated(s)) throw fail(403, 'reauth_required', 'Confirm it is you: enter your current password again.');
      try { await sessions.auth.updateUser(await sessions.accessToken(s.id), { password: req.body.password }); }
      catch (e) {
        const ae = e as AuthError; if (ae.unavailable) throw fail(503, 'auth_unavailable', 'The sign-in service is unreachable. Try again shortly.');
        if (ae.code === 'same_password') throw fail(400, 'same_password', 'Choose a password you have not used here before.');
        throw fail(400, 'weak_password', 'Choose a stronger password (at least 10 characters, not a common one).');
      }
      // every other session of this account ends; this browser gets a fresh full session id
      const ended = await sessions.revokeAll(s.account_id, 'password_changed', s.id); onSessionsEnded(ended);
      const tokens = await sessions.auth.refresh((sessions.decTokens((await db.query('select provider_tokens from game.sessions where id=$1', [s.id])).rows[0].provider_tokens)).refresh_token);
      await sessions.revoke(s.id, 'rotated');
      const created = await sessions.create(tokens, 'full'); sessionReply(reply, created);
      await audit(db, s.account_id, 'account.password_changed', { via: s.kind });
      return { ok: true, csrfToken: created.csrf };
    });

  /* re-authentication for sensitive actions (linking, unlinking, email change, deletion): the current password */
  app.post('/api/auth/reauth', { config: authLimit, preHandler: guards.requireSession(), schema: { body: { type: 'object', additionalProperties: false, required: ['password'], properties: { password: { type: 'string', minLength: 1, maxLength: 72 } } } } },
    async (req: FastifyRequest<{ Body: { password: string } }>) => {
      const s = req.sess!;
      const user = await sessions.auth.getUser(await sessions.accessToken(s.id));
      if (!user.email) throw fail(400, 'no_password', 'This account signs in with Google or Apple: confirm with that instead.');
      try { const fresh = await sessions.auth.signInWithPassword(user.email, req.body.password); if (fresh.user.id !== s.auth_subject) throw new Error('user mismatch'); await sessions.replaceTokens(s.id, fresh); }
      catch (e) { if ((e as AuthError).unavailable) throw fail(503, 'auth_unavailable', 'The sign-in service is unreachable.'); await audit(db, s.account_id, 'reauth.failed', {}); throw fail(401, 'invalid_credentials', 'That password is not right.'); }
      await sessions.markAuthenticated(s.id); await audit(db, s.account_id, 'reauth.ok', { method: 'password' });
      return { ok: true };
    });

  /* Google / Apple: start (a top-level navigation). 404 when the provider is not configured. */
  app.get('/api/auth/oauth/:provider', { config: authLimit }, async (req: FastifyRequest<{ Params: { provider: string } }>, reply) => {
    const p = req.params.provider; if (!(PROVIDERS as readonly string[]).includes(p)) throw fail(404, 'unknown_provider', 'Unknown sign-in provider.');
    const st = await providerStatus(cfg, sessions); if (!(st as any)[p]) throw fail(404, 'provider_disabled', 'This sign-in option is not available.');
    const { verifier, challenge } = pkcePair();
    const flow = await sessions.createFlow('oauth', verifier, { provider: p });
    setFlowCookie(cfg, reply, flow);
    return reply.redirect(sessions.auth.authorizeUrl(p, callbackUrl, challenge), 303);
  });

  /* re-authentication or identity linking through a provider (for accounts without a password, or to add Google / Apple) */
  app.post('/api/auth/oauth/:provider/:purpose', { config: authLimit, preHandler: guards.requireSession() }, async (req: FastifyRequest<{ Params: { provider: string; purpose: string } }>, reply) => {
    const { provider: p, purpose } = req.params;
    if (!(PROVIDERS as readonly string[]).includes(p) || !['link', 'reauth'].includes(purpose)) throw fail(404, 'not_found', 'Not found.');
    const st = await providerStatus(cfg, sessions); if (!(st as any)[p]) throw fail(404, 'provider_disabled', 'This sign-in option is not available.');
    const s = req.sess!;
    if (purpose === 'link') await guards.requireRecentAuth(req);
    const { verifier, challenge } = pkcePair();
    const flow = await sessions.createFlow(purpose as 'link' | 'reauth', verifier, { provider: p, accountId: s.account_id, sessionId: s.id });
    setFlowCookie(cfg, reply, flow);
    const url = purpose === 'link' ? (await sessions.auth.linkIdentityUrl(await sessions.accessToken(s.id), p, callbackUrl, challenge)).url : sessions.auth.authorizeUrl(p, callbackUrl, challenge);
    return { ok: true, url };
  });

  /* the one callback: email confirmation, password recovery, provider sign-in, linking and re-authentication */
  app.get('/api/auth/callback', { config: authLimit }, async (req: FastifyRequest<{ Querystring: Record<string, string> }>, reply) => {
    const q = req.query || {};
    const flowId = req.cookies[cookieNames(cfg).flow]; clearFlowCookie(cfg, reply);
    if (q.error || q.error_code) {
      if (flowId) await sessions.takeFlow(flowId);
      const code = q.error === 'access_denied' ? 'cancelled' : /expired/i.test(q.error_description || q.error_code || '') ? 'link_expired' : 'failed';
      return reply.redirect(home('signin', { auth_error: code }), 303);
    }
    const authCode = typeof q.code === 'string' && /^[A-Za-z0-9\-_.]{8,256}$/.test(q.code) ? q.code : null;
    const flow = await sessions.takeFlow(flowId);
    if (!authCode || !flow) {
      // opened in another browser, opened twice, or older than an hour: an email link has still confirmed the address
      return reply.redirect(home('signin', { auth_notice: authCode ? 'open_in_same_browser' : 'link_invalid' }), 303);
    }
    let s;
    try { s = await sessions.auth.exchangeCode(authCode, flow.verifier); }
    catch (e) { req.log.warn({ code: (e as AuthError).code }, 'code exchange failed'); return reply.redirect(home('signin', { auth_error: (e as AuthError).unavailable ? 'unavailable' : 'link_expired' }), 303); }
    if (flow.kind === 'link' || flow.kind === 'reauth') {
      const acct = (await db.query('select auth_subject from game.accounts where id = $1', [flow.accountId])).rows[0];
      const sessOk = flow.sessionId && (await db.query('select 1 from game.sessions where id = $1 and revoked_at is null', [flow.sessionId])).rowCount;
      if (!acct || !sessOk || acct.auth_subject !== s.user.id) { await audit(db, flow.accountId, flow.kind + '.mismatch', { provider: flow.provider }); return reply.redirect(home('account', { auth_error: 'different_account' }), 303); }
      await sessions.replaceTokens(flow.sessionId!, s);
      if (flow.kind === 'reauth') await sessions.markAuthenticated(flow.sessionId!);
      await audit(db, flow.accountId, flow.kind === 'link' ? 'identity.linked' : 'reauth.ok', { provider: flow.provider });
      return reply.redirect(home('account', flow.kind === 'link' ? { linked: flow.provider || '' } : { reauth: 'ok' }), 303);
    }
    const old = req.cookies[cookieNames(cfg).session]; if (old) { const prev = await sessions.lookup(old); if (prev) await sessions.revoke(prev.id, 'replaced_by_login'); }
    const kind = flow.kind === 'recovery' ? 'recovery' : 'full';
    let created;
    try { created = await sessions.create(s, kind); } catch (e) { return reply.redirect(home('signin', { auth_error: 'account_unavailable' }), 303); }
    sessionReply(reply, created, kind);
    return reply.redirect(home(kind === 'recovery' ? 'reset' : flow.kind === 'signup' ? 'verified' : 'roster'), 303);
  });
}
