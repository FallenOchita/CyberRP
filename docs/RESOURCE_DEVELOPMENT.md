# CyberRP Resource Development

CyberRP resources target one of three languages: C#, JavaScript, or Lua. All use a shared `cyberrp.resource.json` manifest.

## Resource layout

```text
resources/
  my-resource/
    cyberrp.resource.json
    server/
      index.js
```

Example JavaScript manifest:

```json
{
  "schemaVersion": 1,
  "name": "my-resource",
  "version": "1.0.0",
  "language": "javascript",
  "entrypoints": { "server": "server/index.js" },
  "permissions": []
}
```

## Language roles

- **C#**: .NET SDK contracts for strongly typed server resources.
- **JavaScript**: JavaScript entrypoints with TypeScript declaration files.
- **Lua**: Lua 5.4 resource API contract, intended for lightweight event-driven resources.

## Host protocol

Runtime hosts communicate with the server supervisor over newline-delimited JSON. Every message includes protocol version 1. Hosts may report logs, subscribe to events, emit events, and respond to lifecycle requests. The host supervisor owns resource lifecycle and validates protocol messages.

## Security and current status

Resource code is untrusted. The launcher and directory API must never execute community scripts in-process. Production hosts must run as separate OS processes with restricted filesystem access, no network access by default, resource-specific working directories, output limits, timeouts, and explicit permission grants. A separate process alone is not a complete security sandbox; production deployment should add OS-level isolation.

The repository currently provides shared contracts, manifest validation, discovery, SDK starting points, a versioned host protocol, an event bus, and a runtime lifecycle manager. Language-specific executable hosts and game integration are still under development. The API contracts do not imply that Cyberpunk 2077 exposes multiplayer scripting hooks.
