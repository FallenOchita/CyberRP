# CyberRP server-host heartbeat agent

The server package exports `DirectoryHeartbeatAgent` for a hosting process to keep its directory listing online. It deliberately accepts a `getPlayerCount` callback: a future game/server adapter must supply a real authoritative count rather than reporting a fabricated or launcher-side value.

## Configure a host

1. Register the host once using the bootstrap key as described in [Directory API](./DIRECTORY_API.md#register-a-server).
2. Save the returned server ID and one-time server credential in the host's secret configuration. Never commit either value or print the credential to logs.
3. Construct the agent in the host process:

```ts
import { DirectoryHeartbeatAgent } from "./host/directory-heartbeat.js";

const directory = new DirectoryHeartbeatAgent({
  directoryUrl: process.env.CYBERRP_DIRECTORY_URL!,
  serverId: process.env.CYBERRP_SERVER_ID!,
  credential: process.env.CYBERRP_SERVER_CREDENTIAL!,
  getPlayerCount: () => serverAdapter.getConnectedPlayerCount(),
  intervalMs: 30_000,
  onError: (error) => logger.warn({ message: error.message }, "Directory heartbeat failed")
});

directory.start();

// During orderly host shutdown:
await directory.stop();
```

The agent sends an immediate heartbeat and then repeats every 30 seconds by default. Requests time out after 10 seconds by default. Failed heartbeats are reported through `onError`; the next scheduled heartbeat retries. Call `unregister()` only when the host is intentionally being decommissioned, not for ordinary restarts.

Remote directory URLs must use HTTPS. Plain HTTP is accepted only for localhost development. The agent does not implement a Cyberpunk game server, discover connected players, or synchronize game state; those capabilities require a compatible game-side integration and must be supplied by the hosting adapter.


## Owner dashboard monitoring

After registration and ownership is linked to an owner account, the launcher’s **Server management** page reads the authenticated `GET /v1/servers/mine` endpoint. It displays the directory's current online/offline state, reported player count, and the timestamp of the most recent successful heartbeat. The dashboard refreshes this data every 15 seconds and also provides a manual refresh control.

Online status is derived by the directory from heartbeat freshness (90 seconds). A green/online listing means the host agent is reaching the directory; it does not prove that Cyberpunk 2077 multiplayer synchronization or a game-side server is functioning.


## Heartbeat history

When the directory API is connected to PostgreSQL, each accepted host heartbeat is recorded in `cyberrp_server_heartbeat_history`. Owners and server staff can retrieve the latest records with:

```http
GET /v1/servers/{serverId}/heartbeats?limit=50
Authorization: Bearer <owner-session-token>
```

The limit is bounded to 1–100 records. The API checks the caller's server membership before returning timestamps and reported player counts. The service retains at most the latest 1,000 records per server. In-memory directory mode does not persist history and returns `heartbeat_history_unavailable`.
