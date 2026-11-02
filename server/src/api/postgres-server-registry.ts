import { randomBytes, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { hashCredential, type PublicServer, type ServerRegistration, type ServerRegistry } from "./server-registry";

type ServerRow = {
  id: string;
  name: string;
  description: string;
  address: string;
  port: number;
  max_players: number;
  tags: string[];
  game_version: string;
  player_count: number;
  created_at: Date;
  last_heartbeat_at: Date;
  credential_hash: Buffer;
};

function toPublic(row: ServerRow): PublicServer {
  const lastHeartbeatAt = row.last_heartbeat_at.toISOString();
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    address: row.address,
    port: row.port,
    maxPlayers: row.max_players,
    tags: row.tags,
    gameVersion: row.game_version,
    playerCount: row.player_count,
    status: Date.now() - row.last_heartbeat_at.getTime() <= 90_000 ? "online" : "offline",
    createdAt: row.created_at.toISOString(),
    lastHeartbeatAt
  };
}

/** PostgreSQL-backed registry. Run migrations before constructing this adapter. */
export class PostgresServerRegistry implements ServerRegistry {
  constructor(private readonly pool: Pool) {}

  async register(input: ServerRegistration): Promise<{ server: PublicServer; credential: string }> {
    const id = randomUUID();
    const credential = randomBytes(32).toString("base64url");
    const result = await this.pool.query<ServerRow>(
      `INSERT INTO cyberrp_servers
        (id, name, description, address, port, max_players, tags, game_version, credential_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
       RETURNING *`,
      [id, input.name, input.description, input.address, input.port, input.maxPlayers,
        JSON.stringify(input.tags), input.gameVersion, hashCredential(credential)]
    );
    const row = result.rows[0];
    if (!row) throw new Error("PostgreSQL did not return the newly registered server.");
    return { server: toPublic(row), credential };
  }

  async list(filters: { search?: string; tag?: string } = {}): Promise<PublicServer[]> {
    const search = filters.search?.trim() ?? "";
    const tag = filters.tag?.trim() ?? "";
    const result = await this.pool.query<ServerRow>(
      `SELECT * FROM cyberrp_servers
       WHERE ($1 = '' OR name ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%' OR address ILIKE '%' || $1 || '%')
         AND ($2 = '' OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(tags) t WHERE lower(t) = lower($2)))
       ORDER BY (last_heartbeat_at >= now() - interval '90 seconds') DESC, name ASC`,
      [search, tag]
    );
    return result.rows.map(toPublic);
  }

  async heartbeat(id: string, credential: string, playerCount: number): Promise<PublicServer | null> {
    const result = await this.pool.query<ServerRow>(
      `UPDATE cyberrp_servers
       SET player_count = $3, last_heartbeat_at = now()
       WHERE id = $1 AND credential_hash = $2 AND $3 <= max_players AND $3 >= 0
       RETURNING *`,
      [id, hashCredential(credential), playerCount]
    );
    return result.rows[0] ? toPublic(result.rows[0]) : null;
  }

  async remove(id: string, credential: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM cyberrp_servers WHERE id = $1 AND credential_hash = $2",
      [id, hashCredential(credential)]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
