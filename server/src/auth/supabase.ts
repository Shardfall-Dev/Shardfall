/* Supabase Auth (GoTrue) client — the managed identity provider. The server talks to it directly (BFF): passwords go from
   the browser to this server over TLS and on to Supabase Auth, which stores and checks them; Google and Apple sign-in run
   through Supabase Auth's OAuth/OIDC flow with PKCE. Tokens it issues stay on the server (encrypted in game.sessions).
   Endpoints used (Supabase Auth REST API, same for supabase.co projects, the Supabase CLI and the self-hosted image):
     POST /signup, POST /token?grant_type=password|refresh_token|pkce, POST /recover, POST /logout, GET|PUT /user,
     GET /authorize, GET /user/identities/authorize, DELETE /user/identities/:id, DELETE /admin/users/:id, GET /settings, GET /health */

export interface AuthUser {
  id: string; email?: string | null; email_confirmed_at?: string | null; created_at?: string;
  app_metadata?: { provider?: string; providers?: string[] }; user_metadata?: Record<string, unknown>;
  identities?: { identity_id?: string; id: string; provider: string; identity_data?: Record<string, unknown> }[];
}
export interface AuthSession { access_token: string; refresh_token: string; expires_in: number; expires_at?: number; user: AuthUser }

export class AuthError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
  /* network or 5xx: the provider is unreachable, not a verdict on the credentials */
  get unavailable() { return this.status === 0 || this.status >= 500; }
}

type Opts = { method?: string; body?: unknown; bearer?: string; query?: Record<string, string | undefined>; service?: boolean };

export class SupabaseAuth {
  constructor(private base: string, private anonKey: string, private serviceKey: string | null, private timeoutMs = 10_000) {}

  url(p: string, query?: Record<string, string | undefined>) {
    const u = new URL(this.base + p);
    for (const [k, v] of Object.entries(query || {})) if (v !== undefined) u.searchParams.set(k, v);
    return u.toString();
  }

  private async call<T>(p: string, o: Opts = {}): Promise<T> {
    const key = o.service ? this.serviceKey : this.anonKey;
    if (o.service && !key) throw new AuthError(503, 'service_key_missing', 'SUPABASE_SERVICE_ROLE_KEY is not configured');
    const headers: Record<string, string> = { apikey: key as string, 'content-type': 'application/json', accept: 'application/json' };
    const bearer = o.service ? key : o.bearer; if (bearer) headers.authorization = 'Bearer ' + bearer;
    let res: Response;
    try { res = await fetch(this.url(p, o.query), { method: o.method || 'GET', headers, body: o.body === undefined ? undefined : JSON.stringify(o.body), redirect: 'manual', signal: AbortSignal.timeout(this.timeoutMs) }); }
    catch (e) { throw new AuthError(0, 'unreachable', 'auth service unreachable: ' + (e as Error).name); }
    const text = await res.text(); let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) {
      const code = (data && (data.error_code || data.code || data.error)) || 'http_' + res.status;
      const msg = (data && (data.msg || data.message || data.error_description)) || res.statusText;
      throw new AuthError(res.status, String(code), String(msg));
    }
    return data as T;
  }

  signUp(email: string, password: string, redirectTo: string, challenge: string, displayName?: string) {
    return this.call<any>('/signup', { method: 'POST', query: { redirect_to: redirectTo }, body: { email, password, data: displayName ? { display_name: displayName } : {}, code_challenge: challenge, code_challenge_method: 's256' } });
  }
  signInWithPassword(email: string, password: string) { return this.call<AuthSession>('/token', { method: 'POST', query: { grant_type: 'password' }, body: { email, password } }); }
  refresh(refreshToken: string) { return this.call<AuthSession>('/token', { method: 'POST', query: { grant_type: 'refresh_token' }, body: { refresh_token: refreshToken } }); }
  exchangeCode(authCode: string, verifier: string) { return this.call<AuthSession>('/token', { method: 'POST', query: { grant_type: 'pkce' }, body: { auth_code: authCode, code_verifier: verifier } }); }
  recover(email: string, redirectTo: string, challenge: string) { return this.call<unknown>('/recover', { method: 'POST', query: { redirect_to: redirectTo }, body: { email, code_challenge: challenge, code_challenge_method: 's256' } }); }
  logout(accessToken: string, scope: 'local' | 'global' | 'others' = 'local') { return this.call<unknown>('/logout', { method: 'POST', bearer: accessToken, query: { scope } }); }
  getUser(accessToken: string) { return this.call<AuthUser>('/user', { bearer: accessToken }); }
  updateUser(accessToken: string, attrs: { password?: string; email?: string }, redirectTo?: string) { return this.call<AuthUser>('/user', { method: 'PUT', bearer: accessToken, body: attrs, query: { redirect_to: redirectTo } }); }
  /* the provider sign-in URL the browser is sent to (Supabase Auth then redirects to Google / Apple) */
  authorizeUrl(provider: string, redirectTo: string, challenge: string) { return this.url('/authorize', { provider, redirect_to: redirectTo, code_challenge: challenge, code_challenge_method: 's256' }); }
  linkIdentityUrl(accessToken: string, provider: string, redirectTo: string, challenge: string) {
    return this.call<{ url: string }>('/user/identities/authorize', { bearer: accessToken, query: { provider, redirect_to: redirectTo, skip_http_redirect: 'true', code_challenge: challenge, code_challenge_method: 's256' } });
  }
  unlinkIdentity(accessToken: string, identityId: string) { return this.call<unknown>('/user/identities/' + encodeURIComponent(identityId), { method: 'DELETE', bearer: accessToken }); }
  adminDeleteUser(userId: string) { return this.call<unknown>('/admin/users/' + encodeURIComponent(userId), { method: 'DELETE', service: true }); }
  settings() { return this.call<{ external?: Record<string, boolean>; disable_signup?: boolean; mailer_autoconfirm?: boolean }>('/settings'); }
  health() { return this.call<unknown>('/health'); }
}
