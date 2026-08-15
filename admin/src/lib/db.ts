import { Pool } from "pg";

/**
 * Postgres pool and the schema bootstrap.
 *
 * One table, no migration framework: CREATE TABLE IF NOT EXISTS on startup is
 * honest at this size. Add a real migration tool before changing a column.
 */

const globalForPool = globalThis as unknown as { __mcPool?: Pool };

export function pool(): Pool {
  if (!globalForPool.__mcPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    globalForPool.__mcPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return globalForPool.__mcPool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('admin','player')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS users_username_lower ON users (lower(username));
`;

let ready: Promise<void> | null = null;

/** Idempotent; every entry point awaits it before touching the database. */
export function migrate(): Promise<void> {
  ready ??= pool()
    .query(SCHEMA)
    .then(() => undefined);
  return ready;
}

export type DbStatus = { connected: boolean; error?: string };

export async function dbStatus(): Promise<DbStatus> {
  try {
    await migrate();
    await pool().query("SELECT 1");
    return { connected: true };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : "unreachable",
    };
  }
}
