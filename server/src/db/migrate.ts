/* Versioned migrations from supabase/migrations (the one schema source). Each file runs once, in name order, inside a
   transaction, under an advisory lock so two servers starting together cannot race. Applied versions are recorded in
   game_meta.schema_migrations. A file the Supabase CLI has already applied (supabase_migrations.schema_migrations) is
   recorded and skipped, so `supabase start` / `supabase db push` and `npm run migrate` can be used on the same database.
   Usage: npm run migrate   (reads DATABASE_URL, DATABASE_SSL) */
import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import pg = require('pg');
import { findRepoRoot } from '../config';

export interface MigrationResult { applied: string[]; skipped: string[]; alreadyApplied: string[] }

export function migrationFiles(root = findRepoRoot()) {
  const dir = path.join(root, 'supabase', 'migrations');
  return fs.readdirSync(dir).filter(f => /^\d{14}_[a-z0-9_]+\.sql$/.test(f)).sort().map(f => ({ version: f.slice(0, 14), name: f, sql: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

export async function migrate(client: pg.Client | pg.PoolClient, log: (s: string) => void = () => {}): Promise<MigrationResult> {
  const out: MigrationResult = { applied: [], skipped: [], alreadyApplied: [] };
  await client.query('select pg_advisory_lock(727274)');
  try {
    await client.query(`create schema if not exists game_meta;
      create table if not exists game_meta.schema_migrations (version text primary key, name text not null, checksum text not null, applied_at timestamptz not null default now(), source text not null)`);
    const done = new Map<string, string>((await client.query('select version, checksum from game_meta.schema_migrations')).rows.map((r: any) => [r.version, r.checksum]));
    let cli = new Set<string>();
    const hasCli = (await client.query(`select to_regclass('supabase_migrations.schema_migrations') as t`)).rows[0].t;
    if (hasCli) cli = new Set((await client.query('select version from supabase_migrations.schema_migrations')).rows.map((r: any) => String(r.version)));
    for (const m of migrationFiles()) {
      const sum = crypto.createHash('sha256').update(m.sql).digest('hex');
      if (done.has(m.version)) {
        if (done.get(m.version) !== sum) throw new Error(`migration ${m.name} changed after it was applied — add a new migration instead of editing an old one`);
        out.alreadyApplied.push(m.name); continue;
      }
      if (cli.has(m.version)) { await client.query('insert into game_meta.schema_migrations (version, name, checksum, source) values ($1,$2,$3,$4)', [m.version, m.name, sum, 'supabase-cli']); out.skipped.push(m.name); log('recorded (applied by the Supabase CLI) ' + m.name); continue; }
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        await client.query('insert into game_meta.schema_migrations (version, name, checksum, source) values ($1,$2,$3,$4)', [m.version, m.name, sum, 'shardfall']);
        await client.query('COMMIT'); out.applied.push(m.name); log('applied ' + m.name);
      } catch (e) { await client.query('ROLLBACK'); throw new Error(`migration ${m.name} failed: ${(e as Error).message}`); }
    }
  } finally { await client.query('select pg_advisory_unlock(727274)'); }
  return out;
}

if (require.main === module) {
  (async () => {
    const url = process.env.DATABASE_URL; if (!url) { console.error('DATABASE_URL is not set'); process.exit(2); }
    const ssl = (process.env.DATABASE_SSL || 'off').toLowerCase();
    const c = new pg.Client({ connectionString: url, ssl: ssl === 'off' ? undefined : { rejectUnauthorized: ssl !== 'no-verify' } });
    await c.connect();
    try { const r = await migrate(c, s => console.log(s)); console.log(`migrations: ${r.applied.length} applied, ${r.skipped.length} recorded from the Supabase CLI, ${r.alreadyApplied.length} already applied`); }
    finally { await c.end(); }
  })().catch(e => { console.error(e.message); process.exit(1); });
}
