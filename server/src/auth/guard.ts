/* Request guards: origin checks, CSRF, session cookies and the session / recent-authentication requirements. */
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config';
import { safeEqual } from './crypto';
import type { Sessions, SessionRow } from './sessions';

declare module 'fastify' {
  interface FastifyRequest { sess?: SessionRow; sessToken?: string }
}

export class HttpError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
export const fail = (status: number, code: string, message: string) => new HttpError(status, code, message);

export function cookieNames(cfg: Config) { return { session: cfg.cookiePrefix + 'sf_session', flow: cfg.cookiePrefix + 'sf_flow' }; }

export function setSessionCookie(cfg: Config, reply: FastifyReply, token: string, maxAgeMs: number) {
  reply.setCookie(cookieNames(cfg).session, token, { path: '/', httpOnly: true, secure: cfg.cookieSecure, sameSite: 'lax', maxAge: Math.floor(maxAgeMs / 1000) });
}
export function clearSessionCookie(cfg: Config, reply: FastifyReply) { reply.clearCookie(cookieNames(cfg).session, { path: '/', httpOnly: true, secure: cfg.cookieSecure, sameSite: 'lax' }); }
export function setFlowCookie(cfg: Config, reply: FastifyReply, id: string) {
  reply.setCookie(cookieNames(cfg).flow, id, { path: '/', httpOnly: true, secure: cfg.cookieSecure, sameSite: 'lax', maxAge: 3600 });
}
export function clearFlowCookie(cfg: Config, reply: FastifyReply) { reply.clearCookie(cookieNames(cfg).flow, { path: '/', httpOnly: true, secure: cfg.cookieSecure, sameSite: 'lax' }); }

/* the request's origin, from Origin, else Referer. null when the browser sent neither (non-browser clients). */
export function requestOrigin(req: FastifyRequest): string | null {
  const o = req.headers.origin; if (typeof o === 'string' && o !== 'null') return o;
  const r = req.headers.referer; if (typeof r === 'string') { try { return new URL(r).origin; } catch { return null; } }
  return null;
}
export const originAllowed = (cfg: Config, origin: string | null) => !!origin && cfg.allowedOrigins.has(origin);

/* every state-changing request: an allowed Origin, and the X-Shardfall header (a non-simple header, so a cross-site form or
   script cannot send it without a CORS preflight, which this server never grants) */
export function checkMutationOrigin(cfg: Config, req: FastifyRequest) {
  if (!originAllowed(cfg, requestOrigin(req))) throw fail(403, 'bad_origin', 'Request origin not allowed.');
  if (req.headers['x-shardfall'] !== '1') throw fail(403, 'bad_request', 'Missing client header.');
}

export function makeGuards(cfg: Config, sessions: Sessions) {
  const names = cookieNames(cfg);
  /* load the session if there is one (no error when absent) */
  async function loadSession(req: FastifyRequest, reply: FastifyReply): Promise<SessionRow | null> {
    if (req.sess) return req.sess;
    const token = req.cookies[names.session]; if (!token) return null;
    const s = await sessions.lookup(token);
    if (!s) { clearSessionCookie(cfg, reply); return null; }
    const st = await sessions.recheck(s);
    if (st === 'revoked') { clearSessionCookie(cfg, reply); return null; }
    if (st === 'unavailable') throw fail(503, 'auth_unavailable', 'The sign-in service is unreachable. Try again shortly.');
    req.sess = s; req.sessToken = token; return s;
  }
  const isMutation = (req: FastifyRequest) => !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  /* requireSession: a full session (recovery sessions only reach the routes that allow them) + CSRF on mutations */
  const requireSession = (opt: { allowRecovery?: boolean } = {}) => async (req: FastifyRequest, reply: FastifyReply) => {
    if (isMutation(req)) checkMutationOrigin(cfg, req);
    const s = await loadSession(req, reply);
    if (!s) throw fail(401, 'not_signed_in', 'Please sign in.');
    if (s.kind === 'recovery' && !opt.allowRecovery) throw fail(403, 'recovery_only', 'Choose a new password first.');
    if (isMutation(req)) { const h = req.headers['x-csrf-token']; if (typeof h !== 'string' || !safeEqual(h, s.csrf_token)) throw fail(403, 'bad_csrf', 'Your session token is out of date. Reload the page.'); }
  };
  const requireRecentAuth = async (req: FastifyRequest) => {
    if (!req.sess || !sessions.recentlyAuthenticated(req.sess)) throw fail(403, 'reauth_required', 'Confirm it is you: enter your password again.');
  };
  return { loadSession, requireSession, requireRecentAuth, names };
}
