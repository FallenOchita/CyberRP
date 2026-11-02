# PostgreSQL directory storage

The directory API uses PostgreSQL when `DATABASE_URL` is configured. Without it, local development explicitly falls back to volatile in-memory storage.

## Setup

1. Create a PostgreSQL database and a dedicated database user with permission to create tables and indexes during initial setup.
2. Set `CYBERRP_REGISTRATION_KEY` to a private random value of at least 24 characters.
3. Set `DATABASE_URL` to the PostgreSQL connection string.
4. Run `npm run api:migrate` to apply pending numbered SQL migrations, or start the API with `npm run api:start` (which applies migrations automatically before accepting traffic).

The migration runner records applied filenames in `cyberrp_schema_migrations`. It applies migrations in lexical order, uses a PostgreSQL advisory lock to prevent concurrent startup processes from applying the same migration, and wraps each migration plus its tracking record in one transaction. Migrations are append-only: add a new numbered SQL file rather than editing one already applied in production.

The API uses the `pg` connection pool. Keep the database URL and registration key out of source control. Use a managed secret store or environment variables in deployment.

## Persistence and credential handling

Server metadata and SHA-256 credential hashes are persisted. The raw per-server credential is returned only at registration time. PostgreSQL parameters are used for values rather than interpolating user input into SQL.

If `DATABASE_URL` is absent, the API reports `memory` storage in its health response. With PostgreSQL configured, it reports `postgres`.

## Testing

Run `npm run test:postgres` with `DATABASE_URL` pointing to a disposable PostgreSQL database. CI provisions PostgreSQL 16 and verifies migration idempotency, registration, search/tag filtering, heartbeat updates, capacity enforcement, credential rejection, and removal.

## Operational notes

The API's database user needs schema migration privileges at startup. For stricter production separation, apply migrations with a privileged deployment identity and run the API with a restricted DML-only database role after the schema exists. Back up the database, restrict database network access, require TLS for remote database connections, and place the API behind an HTTPS reverse proxy with rate limiting before public deployment.

This directory service stores server metadata only. It does not provide Cyberpunk multiplayer synchronization or a native dedicated game server.
