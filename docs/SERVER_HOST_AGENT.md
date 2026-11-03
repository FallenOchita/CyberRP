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
