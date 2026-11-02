import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool, PoolClient } from "pg";

const MIGRATION_LOCK_ID = 7_291_044_211n;

async function acquireLock(client: PoolClient): Promise<void> {
  await client.query("SELECT pg_advisory_lock($1::bigint)", [MIGRATION_LOCK_ID.toString()]);
}

async function releaseLock(client: PoolClient): Promise<void> {
  await client.query("SELECT pg_advisory_unlock($1::bigint)", [MIGRATION_LOCK_ID.toString()]);
}

/**
 * Applies numbered SQL migrations once, in lexical order.
 * Migrations run under a PostgreSQL advisory lock and each migration is atomic.
 */
export async function runMigrations(
  pool: Pool,
  migrationsDirectory = path.resolve(process.cwd(), "server/migrations")
): Promise<string[]> {
  const client = await pool.connect();
  const appliedNow: string[] = [];
  let locked = false;

  try {
    await acquireLock(client);
    locked = true;
    await client.query(`
      CREATE TABLE IF NOT EXISTS cyberrp_schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(migrationsDirectory))
      .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/.test(name))
      .sort();

    for (const filename of files) {
      const existing = await client.query(
        "SELECT 1 FROM cyberrp_schema_migrations WHERE version = $1",
        [filename]
      );
      if (existing.rowCount) continue;

      const sql = await readFile(path.join(migrationsDirectory, filename), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO cyberrp_schema_migrations (version) VALUES ($1)",
          [filename]
        );
        await client.query("COMMIT");
        appliedNow.push(filename);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    return appliedNow;
  } finally {
    if (locked) await releaseLock(client);
    client.release();
  }
}
