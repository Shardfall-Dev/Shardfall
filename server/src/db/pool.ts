/* PostgreSQL access: one pool, parameterized queries only, and a transaction helper. */
import pg = require('pg');
import type { Config } from '../config';

export type Db = pg.Pool;
export type Tx = pg.PoolClient;

export function createPool(cfg: Pick<Config, 'databaseUrl' | 'databaseSsl'>): Db {
  const pool = new pg.Pool({ connectionString: cfg.databaseUrl, ssl: cfg.databaseSsl || undefined, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000, statement_timeout: 10_000, application_name: 'shardfall-server' } as pg.PoolConfig);
  pool.on('error', err => { console.error('postgres pool error', err.message); });
  return pool;
}

/* tx(db, fn): BEGIN … COMMIT, ROLLBACK on any error. serializable retries are the caller's choice (none needed so far: the
   quota and name rules are enforced with a row lock and a unique index). */
export async function tx<T>(db: Db, fn: (c: Tx) => Promise<T>): Promise<T> {
  const c = await db.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { try { await c.query('ROLLBACK'); } catch { /* the connection is reset below */ } throw e; }
  finally { c.release(); }
}

export const isUniqueViolation = (e: any, constraint?: string) => !!e && e.code === '23505' && (!constraint || e.constraint === constraint);
