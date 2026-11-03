# Directory API

The directory API provides public server discovery, server-host credentials, owner authentication, server ownership, and staff invitations. It is still a development foundation and must be deployed behind HTTPS with rate limiting before public use.

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

- Staff invitations create accounts for an existing server and assign the invited role during one-time redemption. Password reset and account recovery are not implemented.
- Login rate limiting, MFA, email verification, audit logging, and account recovery are not implemented yet.
- Use HTTPS, a reverse proxy, rate limiting, and secret management before exposing the API publicly.
- Without `DATABASE_URL`, the API uses in-memory server storage and owner authentication is unavailable.
- Online status reflects a valid heartbeat, not a successful player connection.
- The directory stores metadata only; it does not provide Cyberpunk 2077 multiplayer synchronization or a native game server API.


## Server ownership and staff roles

Migration 003 adds a nullable primary owner to each directory server and a server membership table. A signed-in owner can claim an unclaimed server:

`POST /v1/servers/:id/claim`

Requires the owner session bearer token. The claim is atomic; only the first successful claim wins. The response is `201` on success and `409` if the server is missing or already claimed.

Members can be viewed with `GET /v1/servers/:id/members`. Only existing members can view the list. An owner can grant the `admin` or `moderator` role using `POST /v1/servers/:id/members` with `{ "ownerId": "<account-uuid>", "role": "admin" }`. Owners and admins can grant moderators; only the owner can grant admins. A member can be removed with `DELETE /v1/servers/:id/members/:ownerId`; members cannot remove themselves or the primary owner, and cannot remove peers or higher roles.

## Staff invitations

An owner can invite an administrator or moderator. An admin can invite moderators only. Invitations are bound to one email address and one server, expire after seven days, and can be redeemed once.

Create an invitation:

`POST /v1/servers/:id/invitations`

Requires an owner session bearer token. JSON body:

```json
{ "email": "staff@example.com", "role": "moderator" }
```

The response contains the invitation metadata and a one-time raw `token`. The API does not send email; the server owner must deliver the invitation link/token through a trusted channel. Store the raw token securely and do not log it.

Redeem an invitation:

`POST /v1/invitations/accept`

JSON body:

```json
{ "token": "<invitation-token>", "password": "a-unique-password-of-at-least-12-characters" }
```

Successful redemption atomically creates the account, adds the invited role to that server, marks the invitation as redeemed, and returns a 12-hour owner session. A token cannot be reused or redeemed after expiry. The database stores only a hash of each invitation token. If the email already has an account, the API returns a conflict; account-linking and multi-server account invitations are not yet supported.

Unclaimed servers remain visible in the public directory and continue to use their server-host credential for heartbeat operations. The owner role controls dashboard membership; it does not replace the server-host credential.

## Desktop owner dashboard

The desktop launcher includes a **Server management** page for signing in, claiming an unowned directory server, viewing its staff, creating staff invitations, and removing lower-role staff. Configure the directory endpoint at renderer build time with:

```bash
VITE_CYBERRP_API_URL=https://directory.example.com npm run build
```

When unset, the dashboard uses `http://127.0.0.1:8787` for local development. The API permits cross-origin requests for the desktop renderer; authentication uses explicit bearer headers, not browser cookies. Keep the API behind HTTPS before using owner accounts outside a local development environment. The current dashboard keeps the session token in memory only, so signing out or restarting the launcher requires signing in again.

The dashboard requires PostgreSQL-backed owner authentication and migrations 002–004. It currently accepts a server UUID copied from the directory/hosting setup; automatic discovery of servers owned by the signed-in account is a follow-up.
