const assert = require("node:assert/strict");
const test = require("node:test");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const { ServerAccessService } = require("../../dist-server/server/src/auth/server-access.js");
const { hashCredential } = require("../../dist-server/server/src/api/server-registry.js");
const { runMigrations } = require("../../dist-server/server/src/db/migrate.js");

const databaseUrl = process.env.DATABASE_URL;

test("server ownership claims and role hierarchy are enforced", {
  skip: !databaseUrl && "DATABASE_URL is not configured"
}, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl, max: 3 });
  const suffix = randomUUID();
  const ownerId = randomUUID();
  const adminId = randomUUID();
  const moderatorId = randomUUID();
  const serverId = randomUUID();
  t.after(async () => {
    await pool.query("DELETE FROM cyberrp_servers WHERE id = $1", [serverId]);
    await pool.query("DELETE FROM cyberrp_owners WHERE id = ANY($1::uuid[])", [[ownerId, adminId, moderatorId]]);
    await pool.end();
  });

  await runMigrations(pool);
  for (const [id, email] of [
    [ownerId, `server-owner-${suffix}@example.test`],
    [adminId, `server-admin-${suffix}@example.test`],
    [moderatorId, `server-mod-${suffix}@example.test`]
  ]) {
    await pool.query(
      "INSERT INTO cyberrp_owners (id,email,password_salt,password_hash) VALUES ($1,$2,$3,$4)",
      [id, email, Buffer.alloc(16), Buffer.alloc(64)]
    );
  }
  await pool.query(
    `INSERT INTO cyberrp_servers
      (id,name,description,address,port,max_players,tags,game_version,credential_hash)
     VALUES ($1,'RBAC integration server','test','127.0.0.1',27101,32,'[]'::jsonb,'test',$2)`,
    [serverId, hashCredential(randomUUID())]
  );

  const access = new ServerAccessService(pool);
  assert.equal(await access.claim(serverId, ownerId), true);
  assert.equal(await access.claim(serverId, adminId), false);
  assert.equal(await access.role(serverId, ownerId), "owner");

  assert.equal(await access.grant(serverId, ownerId, adminId, "admin"), true);
  assert.equal(await access.grant(serverId, adminId, moderatorId, "admin"), false);
  assert.equal(await access.grant(serverId, adminId, moderatorId, "moderator"), true);
  assert.equal(await access.role(serverId, moderatorId), "moderator");

  assert.equal(await access.remove(serverId, moderatorId, adminId), false);
  assert.equal(await access.remove(serverId, adminId, moderatorId), true);
  assert.equal(await access.remove(serverId, adminId, ownerId), false);

  const members = await access.listMembers(serverId);
  assert.deepEqual(members.map(member => member.role), ["owner", "admin"]);
});
