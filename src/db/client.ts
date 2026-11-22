import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { toPgConnection, type Env } from '../config/env.js';

export function createDb(env: Env) {
  const pool = new pg.Pool({
    connectionString: toPgConnection(env),
    max: env.DB_POOL_MAX,
    min: env.DB_POOL_MIN,
    idleTimeoutMillis: 30_000,
    maxLifetimeSeconds: 1800,
    connectionTimeoutMillis: 5_000,
  });
  return { pool, db: drizzle(pool) };
}

export type Db = ReturnType<typeof createDb>['db'];

/** Db atau handle transaksi (keduanya punya query API yang sama). */
export type DbOrTx = Db | Parameters<Parameters<Db['transaction']>[0]>[0];
