import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Pool } from "pg";
import { hashCredential } from "../api/server-registry";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_HOURS = 12;

export type OwnerIdentity = { id: string; email: string; createdAt: string };
export type OwnerSession = { owner: OwnerIdentity; token: string; expiresAt: string };

type OwnerRow = { id: string; email: string; password_salt: Buffer; password_hash: Buffer; created_at: Date };

async function passwordHash(password: string, salt: Buffer): Promise<Buffer> {
  return await scrypt(password, salt, 64) as Buffer;
}

function toOwner(row: OwnerRow): OwnerIdentity {
  return { id: row.id, email: row.email, createdAt: row.created_at.toISOString() };
}

/** PostgreSQL-backed, invite-only owner accounts with opaque, hashed bearer sessions. */
export class OwnerAuthService {
  constructor(private readonly pool: Pool) {}

  async registerFirstOwner(emailInput: string, password: string): Promise<OwnerIdentity> {
    const email = emailInput.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("INVALID_EMAIL");
    if (password.length < 12 || password.length > 256) throw new Error("INVALID_PASSWORD");

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("LOCK TABLE cyberrp_owners IN EXCLUSIVE MODE");
      const existing = await client.query("SELECT 1 FROM cyberrp_owners LIMIT 1");
      if (existing.rowCount) throw new Error("OWNER_ALREADY_EXISTS");
      const salt = randomBytes(16);
      const digest = await passwordHash(password, salt);
      const result = await client.query<OwnerRow>(
        "INSERT INTO cyberrp_owners (id, email, password_salt, password_hash) VALUES ($1,$2,$3,$4) RETURNING *",
        [randomUUID(), email, salt, digest]
      );
      await client.query("COMMIT");
      return toOwner(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async login(emailInput: string, password: string): Promise<OwnerSession | null> {
    const email = emailInput.trim().toLowerCase();
    const result = await this.pool.query<OwnerRow>("SELECT * FROM cyberrp_owners WHERE email = $1", [email]);
    const owner = result.rows[0];
    if (!owner) {
      await passwordHash(password, Buffer.alloc(16));
      return null;
    }
    const actual = await passwordHash(password, owner.password_salt);
    if (actual.length !== owner.password_hash.length || !timingSafeEqual(actual, owner.password_hash)) return null;

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
    await this.pool.query(
      "INSERT INTO cyberrp_owner_sessions (id, owner_id, token_hash, expires_at) VALUES ($1,$2,$3,$4)",
      [randomUUID(), owner.id, hashCredential(token), expiresAt]
    );
    return { owner: toOwner(owner), token, expiresAt: expiresAt.toISOString() };
  }

  async authenticate(token: string): Promise<OwnerIdentity | null> {
    if (!token || token.length > 256) return null;
    const result = await this.pool.query<{ id: string; email: string; created_at: Date }>(
      `SELECT o.id, o.email, o.created_at
       FROM cyberrp_owner_sessions s JOIN cyberrp_owners o ON o.id = s.owner_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [hashCredential(token)]
    );
    const owner = result.rows[0];
    return owner ? { id: owner.id, email: owner.email, createdAt: owner.created_at.toISOString() } : null;
  }

  async logout(token: string): Promise<void> {
    await this.pool.query("DELETE FROM cyberrp_owner_sessions WHERE token_hash = $1", [hashCredential(token)]);
  }
}
