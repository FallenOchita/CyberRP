const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const { Pool } = require("pg");
const { PostgresServerRegistry } = require("../../dist-server/server/src/api/postgres-server-registry.js");

const databaseUrl = process.env.DATABASE_URL;

test("PostgreSQL registry persists registrations and enforces server credentials", {
  skip: !databaseUrl && "DATABASE_URL is not configured"
}, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  t.after(async () => {
    await pool.query("DELETE FROM cyberrp_servers WHERE name LIKE 'CyberRP integration test %'");
    await pool.end();
  });

  const migration = await readFile(
    path.resolve(__dirname, "../migrations/001_create_cyberrp_servers.sql"),
    "utf8"
  );
  await pool.query(migration);

  const registry = new PostgresServerRegistry(pool);
  const registration = {
    name: `CyberRP integration test ${Date.now()}`,
    description: "PostgreSQL persistence verification",
    address: "127.0.0.1",
    port: 27100,
    maxPlayers: 24,
    tags: ["roleplay", "night-city"],
    gameVersion: "2.13"
  };

  const created = await registry.register(registration);
  assert.ok(created.server.id);
  assert.equal(created.server.name, registration.name);
  assert.equal(created.server.playerCount, 0);
  assert.notEqual(created.credential, "");

  const storedCredential = await pool.query(
    "SELECT credential_hash FROM cyberrp_servers WHERE id = $1",
    [created.server.id]
  );
  assert.notEqual(storedCredential.rows[0].credential_hash.toString("base64"), created.credential);

  const listed = await registry.list({ search: "integration test", tag: "ROLEPLAY" });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, created.server.id);

  assert.equal(await registry.heartbeat(created.server.id, "incorrect-credential", 3), null);
  const updated = await registry.heartbeat(created.server.id, created.credential, 3);
  assert.equal(updated.playerCount, 3);
  assert.equal(await registry.heartbeat(created.server.id, created.credential, 25), null);

  assert.equal(await registry.remove(created.server.id, "incorrect-credential"), false);
  assert.equal(await registry.remove(created.server.id, created.credential), true);
  assert.equal((await registry.list({ search: registration.name })).length, 0);
});
