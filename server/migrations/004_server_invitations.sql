CREATE TABLE IF NOT EXISTS cyberrp_server_invitations (
  id uuid PRIMARY KEY,
  server_id uuid NOT NULL REFERENCES cyberrp_servers(id) ON DELETE CASCADE,
  invited_email varchar(254) NOT NULL,
  role varchar(16) NOT NULL CHECK (role IN ('admin', 'moderator')),
  token_hash bytea NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES cyberrp_owners(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cyberrp_server_invitations_pending_idx
  ON cyberrp_server_invitations (server_id, invited_email, expires_at)
  WHERE redeemed_at IS NULL;
