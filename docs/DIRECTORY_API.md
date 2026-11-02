# Directory API

The directory API provides public server discovery, server-host credentials, and an initial invite-only owner account flow. It is still a development foundation and must be deployed behind HTTPS with rate limiting before public use.

## Run locally

Requirements: Node.js 24 and PostgreSQL.

```bash
npm install
# Set a unique random secret of at least 24 characters.
# PowerShell:
$env:CYBERRP_REGISTRATION_KEY = "replace-with-a-long-random-secret"
$env:DATABASE_URL = "postgres://user:password@localhost:5432/cyberrp"
npm run api:start
```

The API listens on `0.0.0.0:8787` by default. Set `PORT` to change the port. Startup automatically applies numbered SQL migrations when `DATABASE_URL` is configured. Keep the registration key private; it is the bootstrap credential for server registration and the first owner account.

## Owner authentication

### Create the first owner

`POST /v1/auth/register`

Requires the bootstrap registration key as a bearer token. This endpoint is available only when PostgreSQL is configured and succeeds only while the owner table is empty. It is intentionally a one-time bootstrap route.

```json
{ "email": "owner@example.com", "password": "use-a-unique-password-of-at-least-12-characters" }
```

Passwords must be 12–256 characters. Passwords are stored as salted scrypt hashes. The endpoint does not return a session; sign in after creating the owner.

### Sign in

`POST /v1/auth/login`

```json
{ "email": "owner@example.com", "password": "your-password" }
```

Returns an opaque bearer token and a 12-hour expiry. The database stores only a SHA-256 hash of the random token. Keep the returned token secret.

### Current owner

`GET /v1/auth/me`

Requires `Authorization: Bearer <session-token>`.

### Sign out

`POST /v1/auth/logout`

Requires the session bearer token and revokes that session.

## Public server list

`GET /v1/servers`

Optional query parameters:
- `search`: searches server name, description, and advertised address.
- `tag`: exact tag match.

A server is considered offline after 90 seconds without a heartbeat.

## Register a server

`POST /v1/servers`

Requires `Authorization: Bearer <CYBERRP_REGISTRATION_KEY>`. The response returns a server ID and a one-time server credential. Store it securely on the server host; only its hash is retained.

```json
{
  "name": "Night City Roleplay",
  "description": "Community roleplay server",
  "address": "play.example.net",
  "port": 30120,
  "maxPlayers": 64,
  "tags": ["serious-rp", "english"],
  "gameVersion": "2.31"
}
```

## Heartbeat

`POST /v1/servers/:id/heartbeat`

Requires the server credential. JSON body: `{ "playerCount": 12 }`. Send heartbeats more frequently than every 90 seconds.

## Remove a server

`DELETE /v1/servers/:id`

Requires the server credential.

## Security status and remaining work

- Owner authentication currently supports a single initial owner account; staff roles, invitations, password reset, and owner-managed server assignment are not implemented yet.
- Login rate limiting, MFA, email verification, audit logging, and account recovery are not implemented yet.
- Use HTTPS, a reverse proxy, rate limiting, and secret management before exposing the API publicly.
- Without `DATABASE_URL`, the API uses in-memory server storage and owner authentication is unavailable.
- Online status reflects a valid heartbeat, not a successful player connection.
- The directory stores metadata only; it does not provide Cyberpunk 2077 multiplayer synchronization or a native game server API.
