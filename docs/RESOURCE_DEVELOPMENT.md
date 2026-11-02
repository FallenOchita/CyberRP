# CyberRP Resource Development

CyberRP resources target C#, JavaScript, and Lua. All use a shared `cyberrp.resource.json` manifest.

## Resource layout

```text
resources/
  my-resource/
    cyberrp.resource.json
    server/
      init.lua
```

## Language roles

- **C#**: .NET 8 SDK contracts and an experimental out-of-process worker.
- **JavaScript**: Node.js server worker with a versioned JSON protocol.
- **Lua**: Lua 5.4 server worker using lua-cjson for protocol messages.

## Host protocol

Runtime hosts communicate with the server supervisor over newline-delimited JSON. Every message includes protocol version 1. Hosts may report logs, subscribe to events, emit events, and respond to lifecycle requests.

## Experimental runtime status

The JavaScript, C#, and Lua adapters are opt-in and support server/shared entrypoints only. They are not yet connected to an in-game multiplayer API, automatic resource distribution, or a production resource supervisor. Cyberpunk 2077 does not provide an official multiplayer server API, so these runtime workers alone do not create multiplayer functionality.

## Security

These workers execute code in separate OS processes, but process separation is not a complete sandbox. In particular, the Lua worker does not restrict Lua's standard libraries or native modules, and the C# worker does not isolate assemblies from OS resources. Do not enable any worker for untrusted community resources.

Before community script execution is enabled, CyberRP needs OS/container isolation, network denial by default, filesystem allowlists, CPU/memory/process quotas, permission mediation, signed resource packages, and a reviewed trust workflow. Runtime execution remains disabled by default.
