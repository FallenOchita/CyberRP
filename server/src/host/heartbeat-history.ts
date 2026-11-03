import type { Pool } from "pg";

export type HeartbeatRecord = { playerCount: number; receivedAt: string };

/** Stores and reads a bounded view of server heartbeat history. */
export class HeartbeatHistoryService {
  constructor(private readonly pool: Pool) {}

  async record(serverId: string, playerCount: number): Promise<void> {
    await this.pool.query(
      "INSERT INTO cyberrp_server_heartbeat_history (server_id, player_count) VALUES ($1, $2)",
      [serverId, playerCount]
    );
    // Keep the most recent 1,000 records per server to bound storage growth.
    await this.pool.query(
      `DELETE FROM cyberrp_server_heartbeat_history
       WHERE server_id = $1 AND id NOT IN (
         SELECT id FROM cyberrp_server_heartbeat_history
         WHERE server_id = $1 ORDER BY received_at DESC, id DESC LIMIT 1000
       )`,
      [serverId]
    );
  }

  async list(serverId: string, limit = 100): Promise<HeartbeatRecord[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const result = await this.pool.query<{ player_count: number; received_at: Date }>(
      `SELECT player_count, received_at
       FROM cyberrp_server_heartbeat_history
       WHERE server_id = $1
       ORDER BY received_at DESC, id DESC
       LIMIT $2`,
      [serverId, safeLimit]
    );
    return result.rows.map(row => ({
      playerCount: row.player_count,
      receivedAt: row.received_at.toISOString()
    }));
  }
}
