import { createHash, randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import type { Pool } from "pg";
import { hashCredential } from "../api/server-registry";
import type { OwnerIdentity, OwnerSession } from "./owner-auth";
import type { ServerRole } from "./server-access";

const scrypt = promisify(scryptCallback);
const INVITATION_TTL_DAYS = 7;

export type ServerInvitation = {
  id: string;
  serverId: string;
  email: string;
  role: Exclude<ServerRole, "owner">;
  expiresAt: string;
};

async function passwordDigest(password: string, salt: Buffer): Promise<Buffer> {
  return await scrypt(password, salt, 64) as Buffer;
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || email.length > 254) throw new Error("INVALID_EMAIL");
  return email;
}

/** One-time, seven-day server staff invitations. Raw tokens are returned only at creation. */
export class ServerInvitationService {
  constructor(private readonly pool: Pool) {}

  async create(serverId: string, actor: OwnerIdentity, emailInput: string, role: Exclude<ServerRole, "owner">): Promise<{ invitation: ServerInvitation; token: string }> {
    const email = normalizeEmail(emailInput);
    const actorResult = await this.pool.query<{ role: ServerRole }>(
      "SELECT role FROM cyberrp_server_members WHERE server_id = $1 AND owner_id = $2",
      [serverId, actor.id]
    );
    const actorRole = actorResult.rows[0]?.role;
    if (!actorRole || (role === "admin" && actorRole !== "owner") || (role === "moderator" && actorRole !== "owner" && actorRole !== "admin")) {
      throw new Error("FORBIDDEN");
    }

    const existing = await this.pool.query("SELECT 1 FROM cyberrp_owners WHERE email = $1", [email]);
    if (existing.rowCount) throw new Error("ACCOUNT_EXISTS");
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO cyberrp_server_invitations
       (id, server_id, invited_email, role, token_hash, invited_by, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, serverId, email, role, hashCredential(token), actor.id, expiresAt]
    );
    return {
      invitation: { id, serverId, email, role, expiresAt: expiresAt.toISOString() },
      token
    };
  }

  async accept(tokenInput: string, password: string): Promise<OwnerSession> {
    if (typeof tokenInput !== "string" || tokenInput.length < 32 || tokenInput.length > 256) throw new Error("INVALID_INVITATION");
    if (typeof password !== "string" || password.length < 12 || password.length > 256) throw new Error("INVALID_PASSWORD");

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const invitationResult = await client.query<{
        id: string; server_id: string; invited_email: string; role: Exclude<ServerRole, "owner">; expires_at: Date; redeemed_at: Date | null;
      }>(
        "SELECT * FROM cyberrp_server_invitations WHERE token_hash = $1 FOR UPDATE",
        [hashCredential(tokenInput)]
      );
      const invitation = invitationResult.rows[0];
      if (!invitation || invitation.redeemed_at || invitation.expires_at.getTime() <= Date.now()) throw new Error("INVALID_INVITATION");

      const existing = await client.query("SELECT 1 FROM cyberrp_owners WHERE email = $1", [invitation.invited_email]);
      if (existing.rowCount) throw new Error("ACCOUNT_EXISTS");

      const ownerId = randomUUID();
      const salt = randomBytes(16);
      const digest = await passwordDigest(password, salt);
      const ownerResult = await client.query<{ id: string; email: string; created_at: Date }>(
        "INSERT INTO cyberrp_owners (id,email,password_salt,password_hash) VALUES ($1,$2,$3,$4) RETURNING id,email,created_at",
        [ownerId, invitation.invited_email, salt, digest]
      );
      await client.query(
        "INSERT INTO cyberrp_server_members (server_id,owner_id,role) VALUES ($1,$2,$3)",
        [invitation.server_id, ownerId, invitation.role]
      );
      await client.query("UPDATE cyberrp_server_invitations SET redeemed_at = now() WHERE id = $1", [invitation.id]);

      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
      await client.query(
        "INSERT INTO cyberrp_owner_sessions (id,owner_id,token_hash,expires_at) VALUES ($1,$2,$3,$4)",
        [randomUUID(), ownerId, hashCredential(token), expiresAt]
      );
      await client.query("COMMIT");
      const owner: OwnerIdentity = {
        id: ownerResult.rows[0].id,
        email: ownerResult.rows[0].email,
        createdAt: ownerResult.rows[0].created_at.toISOString()
      };
      return { owner, token, expiresAt: expiresAt.toISOString() };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
