/* /api/session, /api/account* — who is signed in, account settings, linked sign-in methods, export and deletion.
   The email address lives in Supabase Auth only (read on demand); the game database keeps no copy of it. */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Config } from '../config';
import type { Db } from '../db/pool';
import { tx } from '../db/pool';
import { Sessions, audit } from '../auth/sessions';
import { AuthError } from '../auth/supabase';
import { fail, clearSessionCookie, makeGuards } from '../auth/guard';
import { providerStatus, PROVIDERS, EMAIL } from '../auth/routes';
import P = require('../../../shared/protocol');

export function registerAccountRoutes(app: FastifyInstance, cfg: Config, db: Db, sessions: Sessions, guards: ReturnType<typeof makeGuards>, onSessionsEnded: (ids: string[]) => void, onAccountGone: (accountId: string) => void) {
  const notice = 'Online play is an early alpha: you can create characters and meet other players in a test lobby. The world itself is not simulated on the server yet.';

  /* public: what this server offers (the client decides which buttons to show) */
  app.get('/api/config', async () => ({ online: true, protocol: P.PROTOCOL_VERSION, providers: await providerStatus(cfg, sessions), serverAuthoritative: false, notice }));

  app.get('/api/session', async (req, reply) => {
    const s = await guards.loadSession(req, reply);
    if (!s) return { authenticated: false };
    return { authenticated: true, kind: s.kind, csrfToken: s.csrf_token, account: { displayName: s.display_name, characterSlots: s.character_slots }, recentAuth: sessions.recentlyAuthenticated(s), serverAuthoritative: false, notice };
  });

  app.get('/api/account', { preHandler: guards.requireSession() }, async req => {
    const s = req.sess!;
    let user;
    try { user = await sessions.auth.getUser(await sessions.accessToken(s.id)); } catch (e) { if ((e as AuthError).unavailable) throw fail(503, 'auth_unavailable', 'The sign-in service is unreachable.'); throw fail(401, 'not_signed_in', 'Please sign in again.'); }
    const a = (await db.query('select display_name, character_slots, created_at from game.accounts where id = $1', [s.account_id])).rows[0];
    const ids = (user.identities || []).map(i => ({ provider: i.provider, id: i.identity_id || i.id }));
    return { displayName: a.display_name, email: user.email || null, emailVerified: !!user.email_confirmed_at, emailIsRelay: /@privaterelay\.appleid\.com$/i.test(user.email || ''),
      identities: ids.map(i => ({ provider: i.provider })), canUnlink: ids.length > 1, characterSlots: a.character_slots, createdAt: a.created_at,
      recentAuth: sessions.recentlyAuthenticated(s), providers: await providerStatus(cfg, sessions), canDelete: !!cfg.authServiceKey };
  });

  app.patch<{ Body: { displayName: string | null } }>('/api/account', { preHandler: guards.requireSession(), schema: { body: { type: 'object', additionalProperties: false, required: ['displayName'], properties: { displayName: { type: ['string', 'null'], maxLength: 32 } } } } },
    async (req) => {
      const raw = req.body.displayName; const v = raw === null ? null : raw.replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '').replace(/\s+/g, ' ').trim();
      if (v !== null && [...v].length < 2) throw fail(400, 'bad_display_name', 'A display name needs 2 to 32 characters.');
      await db.query('update game.accounts set display_name = $2, updated_at = now() where id = $1', [req.sess!.account_id, v]);
      await audit(db, req.sess!.account_id, 'account.display_name', {});
      return { ok: true, displayName: v };
    });

  /* change the sign-in email: Supabase Auth confirms the new address by email before it takes effect */
  app.post<{ Body: { email: string } }>('/api/account/email', { preHandler: [guards.requireSession(), guards.requireRecentAuth], schema: { body: { type: 'object', additionalProperties: false, required: ['email'], properties: { email: EMAIL } } } },
    async (req) => {
      try { await sessions.auth.updateUser(await sessions.accessToken(req.sess!.id), { email: req.body.email.trim() }, new URL('/?online=account', cfg.publicUrl).toString()); }
      catch (e) { if ((e as AuthError).unavailable) throw fail(503, 'auth_unavailable', 'The sign-in service is unreachable.'); req.log.info({ code: (e as AuthError).code }, 'email change refused'); }
      await audit(db, req.sess!.account_id, 'account.email_change_requested', {});
      return { ok: true, message: 'If the new address can be used, we sent a confirmation link to it. The change happens once you open it.' };
    });

  app.post<{ Params: { provider: string } }>('/api/account/unlink/:provider', { preHandler: [guards.requireSession(), guards.requireRecentAuth] }, async (req) => {
    const p = req.params.provider; if (!(PROVIDERS as readonly string[]).includes(p)) throw fail(404, 'not_found', 'Not found.');
    const token = await sessions.accessToken(req.sess!.id); const user = await sessions.auth.getUser(token);
    const ids = user.identities || []; const it = ids.find(i => i.provider === p);
    if (!it) throw fail(404, 'not_linked', 'That sign-in method is not linked.');
    if (ids.length < 2) throw fail(409, 'last_identity', 'This is your only way to sign in; link another first.');
    try { await sessions.auth.unlinkIdentity(token, it.identity_id || it.id); } catch (e) { throw fail(400, 'unlink_failed', 'The sign-in method could not be removed.'); }
    await audit(db, req.sess!.account_id, 'identity.unlinked', { provider: p });
    return { ok: true };
  });

  /* export: everything the game stores about this account (online data only; offline browser saves are not on the server) */
  app.get('/api/account/export', { preHandler: guards.requireSession() }, async (req, reply) => {
    const id = req.sess!.account_id;
    const account = (await db.query('select id, display_name, status, character_slots, created_at, updated_at from game.accounts where id = $1', [id])).rows[0];
    const characters = (await db.query('select * from game.characters where account_id = $1 order by created_at', [id])).rows;
    const items = (await db.query('select i.* from game.items i join game.characters c on c.id = i.character_id where c.account_id = $1 order by i.character_id, i.container, i.position', [id])).rows;
    const events = (await db.query('select kind, detail, created_at from game.audit_events where account_id = $1 order by created_at desc limit 500', [id])).rows;
    reply.header('content-disposition', 'attachment; filename="shardfall-account-export.json"');
    return { exportedAt: new Date().toISOString(), account, characters: characters.map(c => { delete c.creation_key; return c; }), items, securityEvents: events };
  });

  /* delete: recent sign-in + the exact phrase. Characters and items go with the account; the Supabase Auth user is deleted. */
  app.delete<{ Body: { confirm: string } }>('/api/account', { preHandler: [guards.requireSession(), guards.requireRecentAuth], schema: { body: { type: 'object', additionalProperties: false, required: ['confirm'], properties: { confirm: { type: 'string', maxLength: 40 } } } } },
    async (req, reply) => {
      if (req.body.confirm !== 'DELETE MY ACCOUNT') throw fail(400, 'confirm_phrase', 'Type DELETE MY ACCOUNT to confirm.');
      if (!cfg.authServiceKey) throw fail(503, 'deletion_unavailable', 'Account deletion is not configured on this server yet. Nothing was deleted.');
      const s = req.sess!;
      // the identity goes first: if Supabase Auth refuses, nothing in the game is touched
      try { await sessions.auth.adminDeleteUser(s.auth_subject); }
      catch (e) { if ((e as AuthError).status !== 404) throw fail(502, 'deletion_failed', 'The account could not be deleted. Nothing was changed; try again later.'); }
      const ended = await tx(db, async c => {
        await c.query(`update game.accounts set status = 'deleted', deleted_at = now(), display_name = null, auth_subject = 'deleted:' || id::text, updated_at = now() where id = $1`, [s.account_id]);
        await c.query('delete from game.characters where account_id = $1', [s.account_id]);   // items cascade
        const r = await c.query(`update game.sessions set revoked_at = now(), revoked_reason = 'account_deleted' where account_id = $1 and revoked_at is null returning id`, [s.account_id]);
        await audit(c, s.account_id, 'account.deleted', {});
        return r.rows.map((x: any) => x.id as string);
      });
      clearSessionCookie(cfg, reply); onSessionsEnded(ended); onAccountGone(s.account_id);
      return { ok: true };
    });
}
