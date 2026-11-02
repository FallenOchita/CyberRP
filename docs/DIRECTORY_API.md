# Directory API (development foundation)

The first directory service is a small Node.js HTTP API intended for local development and integration work. It currently stores server records in memory; every record and server credential is lost when the process exits. It is not ready for public production deployment.

## Run locally

Requirements: Node.js 24.

```bash
npm install
# Set a unique random secret of at least 24 characters.
# PowerShell:
$env:CYBERRP_REGISTRATION_KEY = "replace-with-a-long-random-secret"
npm run api:start
```

The API listens on `0.0.0.0:8787` by default. Set `PORT` to change the port. Keep the registration key private and do not commit it. The registration key grants permission to publish directory entries.

## Endpoints

### Health

`GET /health`

Returns service health and the storage mode.

### Public server list

`GET /v1/servers`

Optional query parameters:
- `search`: searches server name, description, and advertised address.
- `tag`: exact tag match.

Responses include online/offline status. A server is considered offline after 90 seconds without a heartbeat.

### Register a server

`POST /v1/servers`

Requires `Authorization: Bearer <CYBERRP_REGISTRATION_KEY>`.

Example JSON:

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

The response returns a server ID and a one-time server credential. Store that credential securely on the server host; it is not returned again. The registry stores only a hash of the credential.

### Heartbeat

`POST /v1/servers/:id/heartbeat`

Requires the server credential in the bearer header. JSON body:

```json
{ "playerCount": 12 }
```

The player count must be between zero and the registered maximum. Send heartbeats more frequently than every 90 seconds.

### Remove a server

`DELETE /v1/servers/:id`

Requires the server credential in the bearer header.

## Current limitations / production work

- Without `DATABASE_URL`, the API uses in-memory storage. Set `DATABASE_URL` and apply the PostgreSQL migration to enable persistent storage; see `docs/POSTGRESQL.md`.
- No player account system or user login yet.
- No TLS termination, rate limiting, abuse reporting, moderation workflow, or audit log. Deploy behind a properly configured HTTPS reverse proxy only after those controls are added.
- No server reachability probe; online status means a valid heartbeat was received, not that players can successfully connect.
- Registration uses one shared bootstrap key. A production owner portal and scoped server provisioning are still needed.
- This directory is metadata only. It does not provide Cyberpunk 2077 multiplayer synchronization or a native game server API.
