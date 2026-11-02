# Architecture

## Current desktop boundary

- **Renderer:** React UI only. No Node.js integration and no direct filesystem access.
- **Preload:** Exposes a minimal typed API through `contextBridge`.
- **Main process:** Owns Electron window lifecycle and privileged operations.
- **Directory data:** Currently static demo fixtures in the renderer. A future API client will replace these fixtures.

## Planned services

1. Public directory API: server listings, health/status, tags, and community metadata.
2. Identity API: account registration, sessions, and player profiles.
3. Resource service: versioned manifests, hashes, and download metadata.
4. Admin API: authenticated server-owner management.

## Multiplayer reality check

Cyberpunk 2077 is a single-player title and does not expose an official general-purpose multiplayer server API. A FiveM-like experience therefore cannot be achieved by a launcher alone. Any future gameplay synchronization component must be separately researched, clearly marked experimental, compatible with the game/mod ecosystem, and designed with server-authoritative validation. The initial product focuses on launcher, discovery, installation, and community services.
