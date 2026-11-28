/* Server configuration — environment only (see .env.example). Secrets never have defaults; a missing one stops the server at
   start-up with a clear message instead of running half-configured. */
import fs = require('node:fs');
import path = require('node:path');

export interface Config {
  env: 'development' | 'test' | 'production';
  host: string; port: number;
  publicUrl: URL;                       // where players reach the game (the API and the game page are served from here)
  allowedOrigins: Set<string>;          // exact origins allowed to call the API and open the WebSocket
  databaseUrl: string; databaseSsl: false | { rejectUnauthorized: boolean };
  authUrl: string;                      // Supabase Auth base, e.g. https://<ref>.supabase.co/auth/v1 (local: http://127.0.0.1:54321/auth/v1)
  authAnonKey: string;                  // Supabase publishable / anon key (public by design; sent as the apikey header)
  authServiceKey: string | null;        // Supabase secret / service_role key — account deletion only; server side only
  sessionKey: Buffer;                   // 32 bytes: AES-256-GCM key for provider tokens and PKCE verifiers at rest
  cookieSecure: boolean; cookiePrefix: string;
  sessionTtlMs: number; sessionIdleMs: number; recoveryTtlMs: number; reauthWindowMs: number; providerRecheckMs: number; providerGraceMs: number;
  oauth: { google: boolean; apple: boolean };
  characterPurgeDays: number;
  serveGame: boolean; repoRoot: string;
  trustProxy: boolean | string;
  logLevel: string;
  rateLimit: { globalPerMin: number; authPerMin: number };
}

export function findRepoRoot(from = __dirname): string {
  let d = from;
  for (let i = 0; i < 8; i++) { if (fs.existsSync(path.join(d, 'build.sh')) && fs.existsSync(path.join(d, 'src', 'creation.js'))) return d; d = path.dirname(d); }
  throw new Error('cannot find the Shardfall repository root (build.sh) above ' + from);
}

const bool = (v: string | undefined, dflt: boolean) => v === undefined || v === '' ? dflt : /^(1|true|yes|on)$/i.test(v);
const num = (v: string | undefined, dflt: number, min: number, max: number, name: string) => {
  if (v === undefined || v === '') return dflt; const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${name} must be a number from ${min} to ${max}`); return n;
};

export function loadConfig(e: NodeJS.ProcessEnv = process.env): Config {
  const missing: string[] = []; const need = (k: string) => { const v = e[k]; if (!v) missing.push(k); return v || ''; };
  const env = (e.NODE_ENV === 'production' ? 'production' : e.NODE_ENV === 'test' ? 'test' : 'development') as Config['env'];
  const publicUrlRaw = need('PUBLIC_URL'); const databaseUrl = need('DATABASE_URL'); const authUrl = need('SUPABASE_AUTH_URL');
  const authAnonKey = need('SUPABASE_ANON_KEY'); const keyB64 = need('SESSION_ENCRYPTION_KEY');
  if (missing.length) throw new Error('missing required environment variables: ' + missing.join(', ') + ' (see .env.example)');
  let publicUrl: URL; try { publicUrl = new URL(publicUrlRaw); } catch { throw new Error('PUBLIC_URL is not a URL'); }
  const sessionKey = Buffer.from(keyB64, 'base64');
  if (sessionKey.length !== 32) throw new Error('SESSION_ENCRYPTION_KEY must be 32 random bytes, base64 (openssl rand -base64 32)');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(publicUrl.hostname);
  if (env === 'production' && publicUrl.protocol !== 'https:') throw new Error('PUBLIC_URL must be https in production');
  // Secure cookies everywhere except plain-http localhost development (browsers drop Secure cookies on http)
  const cookieSecure = bool(e.COOKIE_SECURE, publicUrl.protocol === 'https:');
  if (env === 'production' && !cookieSecure) throw new Error('COOKIE_SECURE cannot be off in production');
  if (!cookieSecure && !local) throw new Error('COOKIE_SECURE=false is only allowed for a localhost PUBLIC_URL');
  const origins = new Set<string>([publicUrl.origin]);
  for (const o of (e.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)) { try { origins.add(new URL(o).origin); } catch { throw new Error('ALLOWED_ORIGINS has a bad origin: ' + o); } }
  const sslMode = (e.DATABASE_SSL || (local ? 'off' : 'verify')).toLowerCase();
  const databaseSsl = sslMode === 'off' ? false : { rejectUnauthorized: sslMode !== 'no-verify' };
  const H = 3600_000;
  return {
    env, host: e.HOST || (env === 'production' ? '0.0.0.0' : '127.0.0.1'), port: num(e.PORT, 8787, 1, 65535, 'PORT'),
    publicUrl, allowedOrigins: origins, databaseUrl, databaseSsl,
    authUrl: authUrl.replace(/\/+$/, ''), authAnonKey, authServiceKey: e.SUPABASE_SERVICE_ROLE_KEY || null, sessionKey,
    cookieSecure, cookiePrefix: cookieSecure ? '__Host-' : '',
    sessionTtlMs: num(e.SESSION_TTL_HOURS, 720, 1, 24 * 90, 'SESSION_TTL_HOURS') * H,
    sessionIdleMs: num(e.SESSION_IDLE_HOURS, 168, 1, 24 * 90, 'SESSION_IDLE_HOURS') * H,
    recoveryTtlMs: 30 * 60_000,
    reauthWindowMs: num(e.REAUTH_WINDOW_MINUTES, 10, 1, 60, 'REAUTH_WINDOW_MINUTES') * 60_000,
    providerRecheckMs: num(e.PROVIDER_RECHECK_MINUTES, 10, 0, 1440, 'PROVIDER_RECHECK_MINUTES') * 60_000,
    providerGraceMs: 60 * 60_000,
    oauth: { google: bool(e.OAUTH_GOOGLE_ENABLED, false), apple: bool(e.OAUTH_APPLE_ENABLED, false) },
    characterPurgeDays: num(e.CHARACTER_PURGE_DAYS, 7, 0, 90, 'CHARACTER_PURGE_DAYS'),
    serveGame: bool(e.SERVE_GAME, true), repoRoot: findRepoRoot(),
    trustProxy: e.TRUST_PROXY ? (/^(1|true)$/i.test(e.TRUST_PROXY) ? true : e.TRUST_PROXY) : false,
    logLevel: e.LOG_LEVEL || (env === 'test' ? 'warn' : 'info'),
    rateLimit: { globalPerMin: num(e.RATE_LIMIT_PER_MINUTE, 300, 10, 100000, 'RATE_LIMIT_PER_MINUTE'), authPerMin: num(e.AUTH_RATE_LIMIT_PER_MINUTE, 10, 1, 10000, 'AUTH_RATE_LIMIT_PER_MINUTE') },
  };
}
