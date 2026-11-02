# PostgreSQL directory storage

The directory API now has a PostgreSQL registry adapter. Configure `DATABASE_URL` to use it; without that variable, local development continues to use the in-memory registry.

## Setup

1. Create a PostgreSQL database.
2. Apply the SQL migration in `server/migrations/001_create_cyberrp_servers.sql`.
3. Set `CYBERRP_REGISTRATION_KEY` to a private random value of at least 24 characters.
4. Set `DATABASE_URL` to the PostgreSQL connection string.
5. Start with `npm run api:start`.

The API uses the `pg` connection pool. Keep the database URL and registration key out of source control. Use a managed secret store or environment variables in deployment.

## Persistence and credential handling

Server metadata and SHA-256 credential hashes are persisted. The raw per-server credential is returned only at registration time. The credential is compared by its hash; it is never stored in plaintext. PostgreSQL parameters are used for values rather than interpolating user input into SQL.

If `DATABASE_URL` is absent, the API explicitly falls back to volatile in-memory storage. Health responses report the active storage mode.

## Operational notes

Back up the database, restrict database network access, require TLS for remote database connections, and place the API behind an HTTPS reverse proxy with rate limiting before public deployment. This does not provide Cyberpunk multiplayer synchronization or a native dedicated game server.
