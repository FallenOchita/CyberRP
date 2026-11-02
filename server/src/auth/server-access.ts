import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

export type ServerRole = "owner" | "admin" | "moderator";
export type ServerMember = { ownerId: string; email: string; role: ServerRole; joinedAt: string };

const rank: Record<ServerRole, number> = { moderator: 1, admin: 2, owner: 3 };

/** Server ownership claims and role checks for owner dashboard APIs. */
export class ServerAccessService {
  constructor(private readonly pool: Pool) {}

  async claim(serverId: string, ownerId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "UPDATE cyberrp_servers SET owner_id = $2 WHERE id = $1 AND owner_id IS NULL RETURNING id",
        [serverId, ownerId]
      );
      if (!result.rowCount) {
        await client.query("ROLLBACK");
        return false;
      }
      await client.query(
        "INSERT INTO cyberrp_server_members (server_id, owner_id, role) VALUES ($1,$2,'owner')",
        [serverId, ownerId]
      );
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async role(serverId: string, ownerId: string): Promise<ServerRole | null> {
    const result = await this.pool.query<{ role: ServerRole }>(
      "SELECT role FROM cyberrp_server_members WHERE server_id = $1 AND owner_id = $2",
      [serverId, ownerId]
    );
    return result.rows[0]?.role ?? null;
  }

  async listMembers(serverId: string): Promise<ServerMember[]> {
    const result = await this.pool.query<{ owner_id: string; email: string; role: ServerRole; created_at: Date }>(
      `SELECT m.owner_id, o.email, m.role, m.created_at
       FROM cyberrp_server_members m JOIN cyberrp_owners o ON o.id = m.owner_id
       WHERE m.server_id = $1 ORDER BY
         CASE m.role WHEN 'owner' THEN 3 WHEN 'admin' THEN 2 ELSE 1 END DESC, o.email ASC`,
      [serverId]
    );
    return result.rows.map(row => ({
      ownerId: row.owner_id,
      email: row.email,
      role: row.role,
      joinedAt: row.created_at.toISOString()
    }));
  }

  async grant(serverId: string, actorId: string, targetId: string, role: Exclude<ServerRole, "owner">): Promise<boolean> {
    const actorRole = await this.role(serverId, actorId);
    if (!actorRole || (role === "admin" && actorRole !== "owner") || (role === "moderator" && rank[actorRole] < rank.admin)) return false;
    const target = await this.pool.query("SELECT 1 FROM cyberrp_owners WHERE id = $1", [targetId]);
    if (!target.rowCount) return false;
    await this.pool.query(
      `INSERT INTO cyberrp_server_members (server_id, owner_id, role)
       VALUES ($1,$2,$3)
       ON CONFLICT (server_id, owner_id) DO UPDATE SET role = EXCLUDED.role
       WHERE cyberrp_server_members.role <> 'owner'`,
      [serverId, targetId, role]
    );
    return true;
  }

  async remove(serverId: string, actorId: string, targetId: string): Promise<boolean> {
    const actorRole = await this.role(serverId, actorId);
    const targetRole = await this.role(serverId, targetId);
    if (!actorRole || !targetRole || targetRole === "owner" || actorId === targetId) return false;
    if (rank[actorRole] <= rank[targetRole]) return false;
    const result = await this.pool.query(
      "DELETE FROM cyberrp_server_members WHERE server_id = $1 AND owner_id = $2 AND role <> 'owner'",
      [serverId, targetId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
