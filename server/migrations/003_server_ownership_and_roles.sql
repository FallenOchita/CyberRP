ALTER TABLE cyberrp_servers
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES cyberrp_owners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cyberrp_servers_owner_idx
  ON cyberrp_servers (owner_id);

CREATE TABLE IF NOT EXISTS cyberrp_server_members (
  server_id uuid NOT NULL REFERENCES cyberrp_servers(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES cyberrp_owners(id) ON DELETE CASCADE,
  role varchar(16) NOT NULL CHECK (role IN ('owner', 'admin', 'moderator')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (server_id, owner_id)
);

CREATE INDEX IF NOT EXISTS cyberrp_server_members_owner_idx
  ON cyberrp_server_members (owner_id);
