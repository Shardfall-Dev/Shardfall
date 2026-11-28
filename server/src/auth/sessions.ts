/* Server-side sessions (BFF) and short-lived PKCE flows.
   - The browser holds one opaque random session id (HttpOnly, Secure, SameSite=Lax, __Host- prefixed in production). The
     database stores only its SHA-256, so a database read does not yield usable cookies.
   - A new session id is issued on every sign-in (session fixation cannot carry over) and when a recovery session becomes a
     full one. Sessions expire absolutely (SESSION_TTL_HOURS) and when idle (SESSION_IDLE_HOURS), and can be revoked.
   - Each session keeps the Supabase Auth tokens AES-256-GCM encrypted, and re-checks them with Supabase Auth every
     PROVIDER_RECHECK_MINUTES: a deleted, banned or signed-out-everywhere user loses the session at the next check.
   - Each session has its own CSRF token; every state-changing request must echo it in the X-CSRF-Token header. */
import type { Config } from '../config';
import type { Db, Tx } from '../db/pool';
import { randomToken, sha256, encrypt, decrypt } from './crypto';
import { SupabaseAuth, AuthError, type AuthSession, type AuthUser } from './supabase';

export interface SessionRow {
  id: string; account_id: string; kind: 'full' | 'recovery'; csrf_token: string; authenticated_at: Date; provider_checked_at: Date;
  created_at: Date; expires_at: Date; last_seen_at: Date; account_status: string; display_name: string | null; auth_subject: string; character_slots: number;
}
export interface ProviderTokens { access_token: string; refresh_token: string; expires_at: number; provider?: string; providers?: string[] }

const TOKENS_AAD = 'shardfall/session-tokens/v1';
const FLOW_AAD = 'shardfall/pkce-verifier/v1';

export function displayNameFrom(u: AuthUser): string | null {
  const m = (u.user_metadata || {}) as Record<string, unknown>;
  for (const k of ['display_name', 'full_name', 'name']) {
    const v = m[k]; if (typeof v !== 'string') continue;
    const c = v.replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 32);
    if ([...c].length >= 2) return c;
  }
  return null;   // Apple and some Google accounts share no name; the account works without one
}

export class Sessions {
  constructor(private db: Db, private cfg: Config, public auth: SupabaseAuth) {}

  encTokens(s: AuthSession): Buffer {
    const t: ProviderTokens = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
      provider: s.user?.app_metadata?.provider, providers: s.user?.app_metadata?.providers };
    return encrypt(this.cfg.sessionKey, JSON.stringify(t), TOKENS_AAD);
  }
  decTokens(blob: Buffer): ProviderTokens { return JSON.parse(decrypt(this.cfg.sessionKey, blob, TOKENS_AAD)); }

  /* the account for a Supabase Auth user: matched only by the provider-issued user id (never by email or name) */
  async upsertAccount(c: Db | Tx, u: AuthUser): Promise<{ id: string; status: string; created: boolean }> {
    if (!u || typeof u.id !== 'string' || !u.id) throw new AuthError(502, 'bad_user', 'auth service returned no user id');
    const r = await c.query(`insert into game.accounts (auth_subject, display_name) values ($1, $2)
      on conflict (auth_subject) do update set updated_at = now() returning id, status, (xmax = 0) as created`, [u.id, displayNameFrom(u)]);
    return r.rows[0];
  }

  /* create(): a brand-new session for a successful sign-in. Returns the cookie value (only time it exists in clear). */
  async create(s: AuthSession, kind: 'full' | 'recovery' = 'full'): Promise<{ token: string; sessionId: string; accountId: string; csrf: string }> {
    const acct = await this.upsertAccount(this.db, s.user);
    if (acct.status !== 'active') throw new AuthError(403, 'account_' + acct.status, 'this account cannot sign in');
    const token = randomToken(32), csrf = randomToken(24);
    const ttl = kind === 'recovery' ? this.cfg.recoveryTtlMs : this.cfg.sessionTtlMs;
    const r = await this.db.query(`insert into game.sessions (token_hash, account_id, kind, csrf_token, provider_tokens, expires_at)
      values ($1, $2, $3, $4, $5, now() + ($6 || ' milliseconds')::interval) returning id`, [sha256(token), acct.id, kind, csrf, this.encTokens(s), String(ttl)]);
    await audit(this.db, acct.id, acct.created ? 'account.created' : 'session.created', { kind, provider: s.user?.app_metadata?.provider || null });
    return { token, sessionId: r.rows[0].id, accountId: acct.id, csrf };
  }

  /* lookup(token) → the live session, or null when unknown, revoked, expired, idle too long or the account is not active */
  async lookup(token: string | undefined): Promise<SessionRow | null> {
    if (!token || token.length < 20 || token.length > 128) return null;
    const r = await this.db.query(`select s.id, s.account_id, s.kind, s.csrf_token, s.authenticated_at, s.provider_checked_at, s.created_at, s.expires_at, s.last_seen_at,
        a.status as account_status, a.display_name, a.auth_subject, a.character_slots
      from game.sessions s join game.accounts a on a.id = s.account_id
      where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now() and s.last_seen_at > now() - ($2 || ' milliseconds')::interval`, [sha256(token), String(this.cfg.sessionIdleMs)]);
    const row = r.rows[0]; if (!row || row.account_status !== 'active') return null;
    if (Date.now() - new Date(row.last_seen_at).getTime() > 60_000) await this.db.query('update game.sessions set last_seen_at = now() where id = $1', [row.id]);
    return row;
  }

  /* recheck(session): confirm with Supabase Auth that the user still exists and is allowed in (refresh-token grant).
     Only one request refreshes at a time (the provider_checked_at claim). Unreachable provider: tolerated for providerGraceMs. */
  async recheck(s: SessionRow, force = false): Promise<'ok' | 'revoked' | 'unavailable'> {
    const age = Date.now() - new Date(s.provider_checked_at).getTime();
    if (!force && age < this.cfg.providerRecheckMs) return 'ok';
    const claim = await this.db.query(`update game.sessions set provider_checked_at = now() where id = $1 and provider_checked_at = $2 and revoked_at is null returning provider_tokens`, [s.id, s.provider_checked_at]);
    if (!claim.rowCount) return 'ok';                                     // another request is checking right now
    let tok: ProviderTokens; try { tok = this.decTokens(claim.rows[0].provider_tokens); } catch { await this.revoke(s.id, 'token_decrypt_failed'); return 'revoked'; }
    try {
      const fresh = await this.auth.refresh(tok.refresh_token);
      if (!fresh.user || fresh.user.id !== s.auth_subject) { await this.revoke(s.id, 'provider_user_mismatch'); return 'revoked'; }
      await this.db.query('update game.sessions set provider_tokens = $2 where id = $1', [s.id, this.encTokens(fresh)]);
      return 'ok';
    } catch (e) {
      if (e instanceof AuthError && e.unavailable) {
        await this.db.query('update game.sessions set provider_checked_at = $2 where id = $1', [s.id, s.provider_checked_at]);   // keep the old time: retry next request
        return age > this.cfg.providerGraceMs ? 'unavailable' : 'ok';
      }
      await this.revoke(s.id, 'provider_revoked'); await audit(this.db, s.account_id, 'session.provider_revoked', { code: (e as AuthError).code });
      return 'revoked';
    }
  }

  /* a usable access token for calls made on the user's behalf (refreshing it when it is about to expire) */
  async accessToken(sessionId: string): Promise<string> {
    const r = await this.db.query('select provider_tokens from game.sessions where id = $1 and revoked_at is null', [sessionId]);
    if (!r.rowCount) throw new AuthError(401, 'session_gone', 'session ended');
    const tok = this.decTokens(r.rows[0].provider_tokens);
    if (tok.expires_at - 60 > Date.now() / 1000) return tok.access_token;
    const fresh = await this.auth.refresh(tok.refresh_token);
    await this.db.query('update game.sessions set provider_tokens = $2, provider_checked_at = now() where id = $1', [sessionId, this.encTokens(fresh)]);
    return fresh.access_token;
  }
  async replaceTokens(sessionId: string, s: AuthSession) { await this.db.query('update game.sessions set provider_tokens = $2, provider_checked_at = now() where id = $1', [sessionId, this.encTokens(s)]); }
  async markAuthenticated(sessionId: string) { await this.db.query('update game.sessions set authenticated_at = now() where id = $1', [sessionId]); }
  recentlyAuthenticated(s: SessionRow) { return Date.now() - new Date(s.authenticated_at).getTime() <= this.cfg.reauthWindowMs; }

  async revoke(sessionId: string, reason: string) { await this.db.query('update game.sessions set revoked_at = now(), revoked_reason = $2 where id = $1 and revoked_at is null', [sessionId, reason]); }
  async revokeAll(accountId: string, reason: string, except?: string) {
    const r = await this.db.query('update game.sessions set revoked_at = now(), revoked_reason = $2 where account_id = $1 and revoked_at is null and ($3::uuid is null or id <> $3) returning id', [accountId, reason, except || null]);
    return r.rows.map((x: any) => x.id as string);
  }

  /* ---- PKCE flows: the verifier stays in the database (encrypted); the browser gets a random flow id cookie ---- */
  async createFlow(kind: 'signup' | 'recovery' | 'oauth' | 'link' | 'reauth', verifier: string, opt: { provider?: string; accountId?: string; sessionId?: string } = {}) {
    const id = randomToken(32);
    await this.db.query(`insert into game.auth_flows (id_hash, kind, provider, code_verifier, account_id, session_id, expires_at) values ($1,$2,$3,$4,$5,$6, now() + interval '1 hour')`,
      [sha256(id), kind, opt.provider || null, encrypt(this.cfg.sessionKey, verifier, FLOW_AAD), opt.accountId || null, opt.sessionId || null]);
    return id;
  }
  /* takeFlow(id) → the flow, consumed (single use), or null when unknown, used or expired */
  async takeFlow(id: string | undefined) {
    if (!id || id.length < 20 || id.length > 128) return null;
    const r = await this.db.query(`update game.auth_flows set used_at = now() where id_hash = $1 and used_at is null and expires_at > now()
      returning kind, provider, code_verifier, account_id, session_id`, [sha256(id)]);
    if (!r.rowCount) return null; const f = r.rows[0];
    return { kind: f.kind as string, provider: f.provider as string | null, verifier: decrypt(this.cfg.sessionKey, f.code_verifier, FLOW_AAD), accountId: f.account_id as string | null, sessionId: f.session_id as string | null };
  }
  async cleanup() {
    await this.db.query(`delete from game.auth_flows where expires_at < now() - interval '1 day'`);
    await this.db.query(`delete from game.sessions where (revoked_at is not null and revoked_at < now() - interval '30 days') or expires_at < now() - interval '30 days'`);
  }
}

export async function audit(db: Db | Tx, accountId: string | null, kind: string, detail: Record<string, unknown> = {}) {
  await db.query('insert into game.audit_events (account_id, kind, detail) values ($1, $2, $3)', [accountId, kind, JSON.stringify(detail)]);
}
