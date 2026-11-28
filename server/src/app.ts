/* buildApp(cfg): the whole server as one Fastify instance (tests build it on a random port; index.ts listens). */
import fs = require('node:fs');
import path = require('node:path');
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import type { Config } from './config';
import { createPool, type Db } from './db/pool';
import { SupabaseAuth } from './auth/supabase';
import { Sessions } from './auth/sessions';
import { makeGuards, HttpError } from './auth/guard';
import { registerAuthRoutes } from './auth/routes';
import { registerAccountRoutes } from './accounts/routes';
import { Characters } from './characters/service';
import { registerCharacterRoutes } from './characters/routes';
import { World } from './world/world';
import { loadTerrain } from './world/terrain';
import { loadEconomy } from './world/economy';
import { loadPopulation, worldClock } from './world/creatures';
import { Gateway } from './realtime/gateway';
import P = require('../../shared/protocol');
import adapter = require('../../shared/game-rules-adapter');

export interface App { app: FastifyInstance; db: Db; sessions: Sessions; chars: Characters; gateway: Gateway; world: World; close(): Promise<void> }

/* the newest committed browser build (Shardfall_vX.Y[.Z].html), the same file GitHub Pages publishes */
export function latestBuild(root: string): string | null {
  const v = (f: string) => f.replace(/^Shardfall_v|\.html$/g, '').split('.').map(Number);
  const files = fs.readdirSync(root).filter(f => /^Shardfall_v\d+(\.\d+)+\.html$/.test(f))
    .sort((a, b) => { const x = v(a), y = v(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; });
  return files.length ? files[files.length - 1] : null;
}

export async function buildApp(cfg: Config, opts: { db?: Db } = {}): Promise<App> {
  const app = Fastify({
    logger: { level: cfg.logLevel, redact: { paths: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-csrf-token"]', 'res.headers["set-cookie"]', '*.password', '*.access_token', '*.refresh_token'], censor: '[redacted]' } },
    trustProxy: cfg.trustProxy, bodyLimit: 32 * 1024, disableRequestLogging: false,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false, allErrors: false } },
  });
  const db = opts.db || createPool(cfg);
  const rules = adapter.load();
  const auth = new SupabaseAuth(cfg.authUrl, cfg.authAnonKey, cfg.authServiceKey);
  const sessions = new Sessions(db, cfg, auth);
  const guards = makeGuards(cfg, sessions);
  const chars = new Characters(db, rules, cfg.characterPurgeDays);
  const terrain = loadTerrain(cfg.repoRoot); const sim = adapter.loadSim();
  const world = new World(terrain, { viewRadius: cfg.viewRadius, creatures: cfg.creatures ? { data: loadPopulation(cfg.repoRoot, terrain), sim, clock: worldClock(sim) } : null,
    combat: cfg.creatures ? { SF: rules.SF } : null, economy: cfg.creatures ? loadEconomy(cfg.repoRoot, terrain.hash) : null });
  const gateway = new Gateway(cfg, sessions, chars, world, app.log);

  await app.register(cookie);
  // the API and the WebSocket upgrade are rate limited; the game page and its ~250 audio files are not (one page load would
  // otherwise use up a player's budget)
  await app.register(rateLimit, { global: true, max: cfg.rateLimit.globalPerMin, timeWindow: '1 minute', allowList: (req: any) => !(req.url.startsWith('/api/') || req.url.startsWith('/ws')) });
  await app.register(websocket, { options: { maxPayload: P.MAX_MESSAGE_BYTES } });

  // security headers for everything this server returns (the game page itself needs inline scripts and data: images)
  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff'); reply.header('referrer-policy', 'same-origin'); reply.header('x-frame-options', 'DENY');
    reply.header('cross-origin-opener-policy', 'same-origin');
    if (cfg.cookieSecure) reply.header('strict-transport-security', 'max-age=31536000');
    if (req.url.startsWith('/api/')) reply.header('cache-control', 'no-store');
    return payload;
  });

  app.setErrorHandler((err: any, req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: { code: err.code, message: err.message, details: (err as any).details } });
    if (err.validation) return reply.code(400).send({ error: { code: 'bad_request', message: 'The request is not valid.', details: err.validation.slice(0, 5).map((v: any) => ({ path: v.instancePath, message: v.message })) } });
    if (err.statusCode === 429) return reply.code(429).send({ error: { code: 'rate_limited', message: 'Too many requests. Wait a minute and try again.' } });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: { code: 'bad_request', message: 'The request is not valid.' } });
    req.log.error({ err: { message: err.message, code: err.code } }, 'request failed');
    return reply.code(500).send({ error: { code: 'server_error', message: 'Something went wrong on the server.' } });
  });
  app.setNotFoundHandler((req, reply) => reply.code(404).send({ error: { code: 'not_found', message: 'Not found.' } }));

  const endSessions = (ids: string[]) => gateway.closeSessions(ids);
  registerAuthRoutes(app, cfg, db, sessions, guards, endSessions);
  registerAccountRoutes(app, cfg, db, sessions, guards, endSessions, id => gateway.closeAccount(id));
  registerCharacterRoutes(app, chars, rules, guards, id => gateway.closeCharacter(id));
  gateway.register(app);

  app.get('/api/health', { config: { rateLimit: false } }, async () => ({ ok: true }));
  app.get('/api/ready', { config: { rateLimit: false } }, async (req, reply) => {
    const out: Record<string, unknown> = { db: false, auth: false };
    try { await db.query('select 1 from game.realms limit 1'); out.db = true; } catch (e) { req.log.warn({ err: (e as Error).message }, 'db not ready'); }
    try { await auth.health(); out.auth = true; } catch { /* reported below */ }
    out.realtime = gateway.stats(); out.world = world.stats;
    return reply.code(out.db && out.auth ? 200 : 503).send(out);
  });

  // the browser game, same origin as the API (cookies stay first-party). Only the build and its public assets are served.
  if (cfg.serveGame) {
    const build = latestBuild(cfg.repoRoot);
    if (build) {
      const html = path.join(cfg.repoRoot, build);
      const send = async (_: unknown, reply: any) => reply.type('text/html; charset=utf-8').header('cache-control', 'no-cache').send(fs.createReadStream(html));
      app.get('/', send); app.get('/' + build, send);
    }
    for (const sub of ['audio/web', 'music']) {
      const dir = path.join(cfg.repoRoot, 'assets', sub);
      if (fs.existsSync(dir)) await app.register(fastifyStatic, { root: dir, prefix: '/assets/' + sub + '/', decorateReply: false, dotfiles: 'deny', index: false });
    }
  }

  world.start();
  const purge = setInterval(() => { chars.purge().catch(() => {}); sessions.cleanup().catch(() => {}); }, 3600_000); purge.unref();
  return {
    app, db, sessions, chars, gateway, world,
    async close() { clearInterval(purge); world.stop(); await gateway.shutdown(); await app.close(); if (!opts.db) await db.end(); },
  };
}
