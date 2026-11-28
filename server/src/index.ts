/* Shardfall server entry point: npm start (production) / npm run dev. Reads the environment (.env.example lists it). */
import fs = require('node:fs');
import path = require('node:path');
import { loadConfig, findRepoRoot } from './config';
import { buildApp } from './app';

// optional .env for local development (never committed); real deployments set the environment directly
const envFile = path.join(findRepoRoot(), '.env');
if (process.env.NODE_ENV !== 'production' && fs.existsSync(envFile)) process.loadEnvFile(envFile);

(async () => {
  const cfg = loadConfig();
  const s = await buildApp(cfg);
  await s.app.listen({ host: cfg.host, port: cfg.port });
  s.app.log.info({ publicUrl: cfg.publicUrl.origin, google: cfg.oauth.google, apple: cfg.oauth.apple }, 'Shardfall server ready');
  let stopping = false;
  const stop = async (sig: string) => { if (stopping) return; stopping = true; s.app.log.info({ sig }, 'shutting down'); const t = setTimeout(() => process.exit(1), 10_000); t.unref(); await s.close(); process.exit(0); };
  process.on('SIGTERM', () => void stop('SIGTERM')); process.on('SIGINT', () => void stop('SIGINT'));
})().catch(e => { console.error('Shardfall server failed to start:', e.message); process.exit(1); });
