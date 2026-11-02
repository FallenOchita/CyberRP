const assert = require("node:assert/strict");
const test = require("node:test");
const { Pool } = require("pg");
const { OwnerAuthService } = require("../../dist-server/server/src/auth/owner-auth.js");
const { runMigrations } = require("../../dist-server/server/src/db/migrate.js");

const databaseUrl = process.env.DATABASE_URL;

test("owner authentication creates one bootstrap owner and revocable sessions", {
  skip: !databaseUrl && "DATABASE_URL is not configured"
}, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  t.after(async () => {
    await pool.query("DELETE FROM cyberrp_owners WHERE email LIKE 'cyberrp-auth-test-%@example.test'");
    await pool.end();
  });

  await runMigrations(pool);
  const auth = new OwnerAuthService(pool);
  const email = `cyberrp-auth-test-${Date.now()}@example.test`;
  const owner = await auth.registerFirstOwner(email, "correct-horse-battery-staple");
  assert.equal(owner.email, email);
  await assert.rejects(
    auth.registerFirstOwner(`another-${Date.now()}@example.test`, "correct-horse-battery-staple"),
    (error) => error.message === "OWNER_ALREADY_EXISTS"
  );

  assert.equal(await auth.login(email, "not-the-password"), null);
  const session = await auth.login(email, "correct-horse-battery-staple");
  assert.ok(session);
  assert.equal(session.owner.id, owner.id);
  assert.ok(session.token.length >= 40);
  assert.equal(await auth.authenticate(session.token).then((value) => value.id), owner.id);

  await auth.logout(session.token);
  assert.equal(await auth.authenticate(session.token), null);
});
