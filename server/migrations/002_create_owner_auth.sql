CREATE TABLE IF NOT EXISTS cyberrp_owners (
  id uuid PRIMARY KEY,
  email varchar(254) NOT NULL UNIQUE,
  password_salt bytea NOT NULL,
  password_hash bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cyberrp_owner_sessions (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES cyberrp_owners(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cyberrp_owner_sessions_expiry_idx
  ON cyberrp_owner_sessions (expires_at);
