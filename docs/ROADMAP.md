# Roadmap

## Milestone 0 — Foundation
- [x] Create Electron + React + TypeScript application
- [x] Add initial Night City-inspired launcher UI
- [x] Add server discovery demo, search, persistent favorites, recently viewed servers, and settings
- [x] Add secure renderer/preload boundary
- [ ] Verify CI and Windows packaging

## Milestone 1 — Launcher core
- [x] Detect supported Cyberpunk 2077 installations (Steam, GOG, Epic common locations)
- [x] Add user-selected game folder validation
- [x] Persist the selected game path in local launcher settings
- [x] Add Play action with Steam routing and REDprelauncher/direct executable fallback
- [ ] Add configurable launch arguments with validation
- [x] Persist selected game installation, favorites, and recently viewed servers
- [x] Connect launcher to typed public directory API with explicit demo fallback

## Milestone 2 — Multi-language resource foundation
- [x] Define a versioned resource manifest shared by C#, JavaScript, and Lua
- [x] Add JSON Schema and TypeScript manifest validation
- [x] Add initial C# SDK interfaces
- [x] Add JavaScript SDK type contracts
- [x] Document the Lua SDK contract
- [x] Add resource catalog discovery and a sample JavaScript resource
- [ ] Add isolated .NET worker host and lifecycle management
- [x] Add opt-in Node.js worker host and process lifecycle adapter (trusted resources only)
- [ ] Add isolated Lua 5.4 worker host and lifecycle management
- [x] Define versioned newline-delimited JSON host protocol
- [x] Add shared resource lifecycle manager and event bus foundation
- [ ] Add protocol authentication, permission enforcement, OS-level network isolation, and resource quotas
- [ ] Add integration tests for all three runtimes

## Milestone 3 — Community services
- [x] Server detail panel with community rule review and local acknowledgement
- [x] Invite-only owner/staff account provisioning and secure session handling
- [ ] Character profiles and community identity
- [x] Server owner dashboard and moderation roles\n- [x] Server-host registration CLI and protected credential configuration\n- [x] Owner dashboard host status, player count, and heartbeat monitoring
- [x] Persist and display bounded server heartbeat history
- [x] Visualize recent host-reported player counts in the owner dashboard

## Milestone 3 — Mod/resource distribution
- [ ] Versioned resource manifests and SHA-256 verification
- [ ] Install/update/repair resource workflow
- [ ] Compatibility checks for supported mod loaders
- [ ] Signed launcher releases and update verification

## Milestone 4 — Experimental multiplayer research
- [ ] Document feasibility and technical constraints
- [ ] Prototype a separate synchronization service only if a viable game-side integration exists
- [ ] Define server authority, state validation, and compatibility boundaries

## Milestone 5 — Release
- [ ] Windows installer and portable build
- [ ] Crash reporting with user consent
- [ ] Release documentation and support policy
