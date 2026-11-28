/* Integration test helpers: a fresh database per test file, the real server on a free port, a cookie-keeping HTTP client,
   the Mailpit inbox (where the local Supabase Auth delivers confirmation and reset emails) and WebSocket clients.
   Needs the services from server/dev/docker-compose.yml (PostgreSQL, Supabase Auth, Mailpit). */
import net = require('node:net');
import crypto = require('node:crypto');
import pg = require('pg');
import WebSocket = require('ws');
import { loadConfig } from '../../server/src/config';
import { buildApp, type App } from '../../server/src/app';
import { migrate } from '../../server/src/db/migrate';
import { devJwt } from '../../server/dev/keys';
import P = require('../../shared/protocol');

export const ADMIN_DB = process.env.TEST_ADMIN_DATABASE_URL || 'postgres://postgres:postgres@localhost:54329/postgres';
export const AUTH_URL = process.env.TEST_SUPABASE_AUTH_URL || 'http://localhost:9999';
export const MAILPIT = process.env.TEST_MAILPIT_URL || 'http://localhost:8025';
export const PASSWORD = 'correct-horse-battery-7';

export async function freePort(): Promise<number> {
  return new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = (s.address() as net.AddressInfo).port; s.close(() => res(p)); }); s.on('error', rej); });
}

export interface TestServer { base: string; origin: string; app: App; dbUrl: string; db: pg.Pool; close(): Promise<void> }

export async function startServer(env: Record<string, string> = {}): Promise<TestServer> {
  const name = 'sf_test_' + crypto.randomBytes(5).toString('hex');
  const admin = new pg.Client({ connectionString: ADMIN_DB }); await admin.connect(); await admin.query(`create database ${name}`); await admin.end();
  const dbUrl = ADMIN_DB.replace(/\/[^/]*$/, '/' + name);
  const mc = new pg.Client({ connectionString: dbUrl }); await mc.connect(); await migrate(mc); await mc.end();
  const port = await freePort(); const origin = `http://localhost:${port}`;
  const cfg = loadConfig(Object.assign({
    NODE_ENV: 'test', PORT: String(port), HOST: '127.0.0.1', PUBLIC_URL: origin, DATABASE_URL: dbUrl, DATABASE_SSL: 'off',
    SUPABASE_AUTH_URL: AUTH_URL, SUPABASE_ANON_KEY: devJwt('anon'), SUPABASE_SERVICE_ROLE_KEY: devJwt('service_role'),
    SESSION_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'), OAUTH_GOOGLE_ENABLED: 'true', OAUTH_APPLE_ENABLED: 'true',
    AUTH_RATE_LIMIT_PER_MINUTE: '1000', RATE_LIMIT_PER_MINUTE: '100000', LOG_LEVEL: process.env.TEST_LOG_LEVEL || 'error',
  }, env) as any);
  const app = await buildApp(cfg);
  await app.app.listen({ host: '127.0.0.1', port });
  return { base: origin, origin, app, dbUrl, db: app.db as unknown as pg.Pool, async close() {
    await app.close();
    const a = new pg.Client({ connectionString: ADMIN_DB }); await a.connect(); await a.query(`drop database if exists ${name} with (force)`); await a.end();
  } };
}

/* a browser-like client: keeps cookies, sends Origin and the client header, echoes the CSRF token */
export class Client {
  cookies = new Map<string, string>(); csrf: string | null = null;
  constructor(public base: string, public origin: string = base) {}
  cookieHeader() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '); }
  private keep(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [kv, ...attrs] = c.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i).trim(), v = kv.slice(i + 1).trim();
      const expired = attrs.some(a => /^\s*max-age=0/i.test(a) || /^\s*expires=thu, 01 jan 1970/i.test(a));
      if (!v || expired) this.cookies.delete(k); else this.cookies.set(k, v);
    }
  }
  async req(method: string, path: string, body?: unknown, opt: { headers?: Record<string, string>; csrf?: boolean; origin?: string | null; clientHeader?: boolean } = {}) {
    const h: Record<string, string> = Object.assign({}, opt.headers || {});
    if (opt.origin !== null) h.origin = opt.origin || this.origin;
    if (opt.clientHeader !== false) h['x-shardfall'] = '1';
    if (opt.csrf !== false && this.csrf) h['x-csrf-token'] = this.csrf;
    if (this.cookies.size) h.cookie = this.cookieHeader();
    if (body !== undefined) h['content-type'] = 'application/json';
    const res = await fetch(new URL(path, this.base), { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    this.keep(res);
    const text = await res.text(); let json: any = null; try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (json && typeof json.csrfToken === 'string') this.csrf = json.csrfToken;
    return { status: res.status, json, headers: res.headers, text };
  }
  get(p: string, o?: any) { return this.req('GET', p, undefined, o); }
  post(p: string, b?: unknown, o?: any) { return this.req('POST', p, b === undefined ? {} : b, o); }
  /* follow a link the way a browser does (cookies only for our own origin) until it lands on a non-redirect */
  async follow(url: string, max = 6) {
    let u = url; const hops: string[] = [];
    for (let i = 0; i < max; i++) {
      const own = new URL(u).origin === new URL(this.base).origin;
      const res = await fetch(u, { redirect: 'manual', headers: own && this.cookies.size ? { cookie: this.cookieHeader() } : {} });
      if (own) this.keep(res); hops.push(u);
      const loc = res.headers.get('location'); if (res.status < 300 || res.status >= 400 || !loc) return { status: res.status, url: u, hops };
      u = new URL(loc, u).toString();
      if (new URL(u).origin === new URL(this.base).origin && new URL(u).pathname === '/') return { status: res.status, url: u, hops };
    }
    throw new Error('too many redirects from ' + url);
  }
  async session() { const r = await this.get('/api/session'); if (r.json?.csrfToken) this.csrf = r.json.csrfToken; return r.json; }
}

export const uniqueEmail = (tag = 'p') => `${tag}.${Date.now().toString(36)}.${crypto.randomBytes(4).toString('hex')}@shardfall.test`;

/* the newest email to an address in Mailpit, and the first link in it pointing at the auth service */
export async function waitForEmail(to: string, timeoutMs = 15000): Promise<{ id: string; subject: string; link: string }> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:"' + to + '"')}`); const j: any = await r.json();
    const m = j.messages && j.messages[0];
    if (m) {
      const full: any = await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json();
      const html: string = full.HTML || full.Text || '';
      const href = (html.match(/href="([^"]+)"/) || [])[1] || (html.match(/https?:\/\/\S+/) || [])[0];
      if (href) { await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ IDs: [m.ID] }) }); return { id: m.ID, subject: m.Subject, link: href.replace(/&amp;/g, '&') }; }
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('no email to ' + to);
}

/* register → confirmation email → open the link in the same browser → signed in */
export async function signUp(srv: TestServer, email = uniqueEmail(), password = PASSWORD, displayName?: string) {
  const c = new Client(srv.base);
  const r = await c.post('/api/auth/register', Object.assign({ email, password }, displayName ? { displayName } : {}));
  if (r.status !== 200) throw new Error('register ' + r.status + ' ' + r.text);
  const mail = await waitForEmail(email);
  const end = await c.follow(mail.link);
  if (!/online=verified/.test(end.url)) throw new Error('verification landed on ' + end.url);
  await c.session();
  return { c, email, password };
}

export const LOOK = { body: 'male', skinTone: 'light', hairStyle: 'short', hairColor: 'darkbrown', facialHairStyle: 'none', facialHairColor: 'darkbrown', clothingColor: 'oatmeal', cloak: 'teal' };
export const creation = (name: string, o: object = {}) => Object.assign({ name, look: LOOK, str: 45, dex: 25, int: 10, skills: [['swordsmanship', 50], ['tactics', 30], ['healing', 20]], town: 'quay' }, o);

/* a WebSocket client with the browser's cookie and Origin; collects messages */
export class WsClient {
  ws!: WebSocket; msgs: any[] = []; closed: { code: number; reason: string } | null = null; private waiters: (() => void)[] = []; private n = 0;
  static async open(srv: TestServer, c: Client | null, origin: string | null = srv.origin): Promise<{ w: WsClient | null; status?: number }> {
    const w = new WsClient(); const headers: Record<string, string> = {}; if (origin) headers.origin = origin; if (c && c.cookies.size) headers.cookie = c.cookieHeader();
    return new Promise(res => {
      w.ws = new WebSocket(srv.base.replace(/^http/, 'ws') + '/ws', { headers });
      w.ws.on('unexpected-response', (_req: any, r: any) => { res({ w: null, status: r.statusCode }); });
      w.ws.on('open', () => res({ w }));
      w.ws.on('message', (d: any) => { w.msgs.push(JSON.parse(String(d))); w.waiters.splice(0).forEach(f => f()); });
      w.ws.on('close', (code: number, reason: Buffer) => { w.closed = { code, reason: String(reason) }; w.waiters.splice(0).forEach(f => f()); });
      w.ws.on('error', () => {});
    });
  }
  send(type: string, p: object = {}, raw?: string) { const id = 'r' + (++this.n); this.ws.send(raw ?? JSON.stringify({ v: P.PROTOCOL_VERSION, type, id, p })); return id; }
  async wait(pred: (m: any) => boolean, timeoutMs = 5000): Promise<any> {
    const t0 = Date.now();
    for (;;) {
      const m = this.msgs.find(pred); if (m) return m;
      if (this.closed) throw new Error('closed ' + JSON.stringify(this.closed) + ' while waiting; got ' + JSON.stringify(this.msgs.map(x => x.type)));
      if (Date.now() - t0 > timeoutMs) throw new Error('timeout; got ' + JSON.stringify(this.msgs.map(x => [x.type, x.p && (x.p.code || x.p.reason)])));
      await new Promise<void>(r => { this.waiters.push(r); setTimeout(r, 100); });
    }
  }
  async waitClose(timeoutMs = 5000) { const t0 = Date.now(); while (!this.closed) { if (Date.now() - t0 > timeoutMs) throw new Error('not closed'); await new Promise(r => setTimeout(r, 50)); } return this.closed; }
  close() { try { this.ws.close(); } catch { /* */ } }
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
