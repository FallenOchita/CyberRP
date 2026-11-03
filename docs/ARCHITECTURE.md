# Architecture

## Current desktop boundary

- **Renderer:** React UI only. No Node.js integration and no direct filesystem access.
- **Preload:** Exposes a minimal typed API through `contextBridge`.
- **Main process:** Owns Electron window lifecycle, local settings persistence, game validation, and game launch operations.
- **Game launch:** Steam installs are handed to Steam using Cyberpunk 2077's app ID; other supported installs prefer CD PROJEKT RED's REDprelauncher when available, then use the validated game executable.
- **Directory data:** A typed API client loads live directory records and falls back explicitly to sample listings when the API is unavailable.
- **Local preferences:** The main process persists the validated game installation; the renderer persists favorites, recently viewed server IDs, and local rule acknowledgements.

## Resource runtime architecture

- **Shared resource contract:** `cyberrp.resource.json` describes language, version, server/client/shared entrypoints, dependencies, and requested permissions.
- **Resource catalog:** discovers resource folders and validates manifests before they can be considered for loading.
- **C# adapter:** experimental .NET worker process using the CyberRP.SDK contracts.
- **JavaScript adapter:** experimental Node.js worker process using the typed CyberRP JavaScript API.
- **Lua adapter:** experimental Lua 5.4 worker process using the documented CyberRP Lua API.
- **Host boundary:** each runtime will communicate with the server host through a versioned, permission-checked message protocol. Resource scripts will not run in the launcher or API process.

The repository contains the manifest contract, schema, catalog discovery function, SDK starting points, example resources, versioned newline-delimited JSON host protocol, executable JavaScript/C#/Lua workers, cross-runtime event routing, and a dependency-aware lifecycle manager. Production isolation, comprehensive RPC permission enforcement, and actual game APIs remain future implementation work.

## Planned services

1. Public directory API: PostgreSQL-backed server registration, listings, heartbeats, owner access, and bounded heartbeat history are implemented; rate limiting and production deployment controls remain outstanding.
2. Identity API: invite-only owner/staff provisioning and hashed bearer sessions are implemented; player profiles and community identity remain outstanding.
3. Resource service: versioned manifests, hashes, and download metadata.
4. Admin API: authenticated server-owner and staff management is implemented.

## Multiplayer reality check

Cyberpunk 2077 is a single-player title and does not expose an official general-purpose multiplayer server API. A FiveM-like experience therefore cannot be achieved by a launcher alone. Any future gameplay synchronization component must be separately researched, clearly marked experimental, compatible with the game/mod ecosystem, and designed with server-authoritative validation. The initial product focuses on launcher, discovery, installation, and community services.
