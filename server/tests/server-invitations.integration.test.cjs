const assert = require("node:assert/strict");
const test = require("node:test");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const { ServerInvitationService } = require("../../dist-server/server/src/auth/server-invitations.js");
const { OwnerAuthService } = require("../../dist-server/server/src/auth/owner-auth.js");
const { ServerAccessService } = require("../../dist-server/server/src/auth/server-access.js");
const { hashCredential } = require("../../dist-server/server/src/api/server-registry.js");
const { runMigrations } = require("../../dist-server/server/src/db/migrate.js");

const databaseUrl = process.env.DATABASE_URL;

test("server invitations are role-limited, email-bound, expiring, and single-use", {
  skip: !databaseUrl && "DATABASE_URL is not configured"
}, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl, max: 3 });
  const suffix = randomUUID();
  const ownerId = randomUUID();
  const serverId = randomUUID();
  const invitedEmail = `invited-${suffix}@example.test`;
  let acceptedOwnerId;
  t.after(async () => {
    await pool.query("DELETE FROM cyberrp_servers WHERE id = $1", [serverId]);
    await pool.query("DELETE FROM cyberrp_owners WHERE id = $1 OR id = $2", [ownerId, acceptedOwnerId ?? randomUUID()]);
    await pool.end();
  });

  await runMigrations(pool);
  await pool.query(
    "INSERT INTO cyberrp_owners (id,email,password_salt,password_hash) VALUES ($1,$2,$3,$4)",
    [ownerId, `inviter-${suffix}@example.test`, Buffer.alloc(16), Buffer.alloc(64)]
  );
  await pool.query(
    `INSERT INTO cyberrp_servers
      (id,name,description,address,port,max_players,tags,game_version,credential_hash)
     VALUES ($1,'Invitation test server','test','127.0.0.1',27102,32,'[]'::jsonb,'test',$2)`,
    [serverId, hashCredential(randomUUID())]
  );

  const access = new ServerAccessService(pool);
  assert.equal(await access.claim(serverId, ownerId), true);
  const invitations = new ServerInvitationService(pool);
  const inviter = { id: ownerId, email: `inviter-${suffix}@example.test`, createdAt: new Date().toISOString() };

  const created = await invitations.create(serverId, inviter, invitedEmail, "moderator");
  assert.equal(created.invitation.email, invitedEmail);
  assert.equal(created.invitation.role, "moderator");
  assert.ok(Date.parse(created.invitation.expiresAt) > Date.now());

  const session = await invitations.accept(created.token, "a-long-unique-password-123");
  acceptedOwnerId = session.owner.id;
  assert.equal(session.owner.email, invitedEmail);
  assert.equal(await access.role(serverId, acceptedOwnerId), "moderator");
  assert.equal(await new OwnerAuthService(pool).authenticate(session.token) !== null, true);

  await assert.rejects(
    () => invitations.accept(created.token, "another-long-password-456"),
    error => error.message === "INVALID_INVITATION"
  );
  await assert.rejects(
    () => invitations.create(serverId, inviter, invitedEmail, "admin"),
    error => error.message === "ACCOUNT_EXISTS"
  );
});
