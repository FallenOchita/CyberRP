CREATE TABLE IF NOT EXISTS cyberrp_servers (
  id uuid PRIMARY KEY,
  name varchar(64) NOT NULL,
  description varchar(500) NOT NULL DEFAULT '',
  address varchar(253) NOT NULL,
  port integer NOT NULL CHECK (port BETWEEN 1 AND 65535),
  max_players integer NOT NULL CHECK (max_players BETWEEN 1 AND 10000),
  tags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tags) = 'array'),
  game_version varchar(32) NOT NULL,
  player_count integer NOT NULL DEFAULT 0 CHECK (player_count >= 0 AND player_count <= max_players),
  credential_hash bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cyberrp_servers_heartbeat_idx
  ON cyberrp_servers (last_heartbeat_at DESC);

CREATE INDEX IF NOT EXISTS cyberrp_servers_name_idx
  ON cyberrp_servers (name);
