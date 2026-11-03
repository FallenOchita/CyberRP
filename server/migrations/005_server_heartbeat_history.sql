CREATE TABLE IF NOT EXISTS cyberrp_server_heartbeat_history (
  id bigserial PRIMARY KEY,
  server_id uuid NOT NULL REFERENCES cyberrp_servers(id) ON DELETE CASCADE,
  player_count integer NOT NULL CHECK (player_count >= 0),
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cyberrp_heartbeat_history_server_time_idx
  ON cyberrp_server_heartbeat_history (server_id, received_at DESC);
