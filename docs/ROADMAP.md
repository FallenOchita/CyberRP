# Roadmap

## Milestone 0 — Foundation
- [x] Create Electron + React + TypeScript application
- [x] Add initial Night City-inspired launcher UI
- [x] Add server discovery demo, search, favorites, recent view, and settings
- [x] Add secure renderer/preload boundary
- [ ] Verify CI and Windows packaging

## Milestone 1 — Launcher core
- [x] Detect supported Cyberpunk 2077 installations (Steam, GOG, Epic common locations)
- [x] Add user-selected game folder validation
- [x] Persist the selected game path in local launcher settings
- [x] Add Play action with Steam routing and REDprelauncher/direct executable fallback
- [ ] Add configurable launch arguments with validation
- [ ] Persist local settings and favorites
- [ ] Replace demo servers with a typed directory API

## Milestone 2 — Multi-language resource foundation
- [x] Define a versioned resource manifest shared by C#, JavaScript, and Lua
- [x] Add JSON Schema and TypeScript manifest validation
- [x] Add initial C# SDK interfaces
- [x] Add JavaScript SDK type contracts
- [x] Document the Lua SDK contract
- [x] Add resource catalog discovery and a sample JavaScript resource
- [ ] Add isolated .NET worker host and lifecycle management
- [ ] Add isolated Node.js worker host and lifecycle management
- [ ] Add isolated Lua 5.4 worker host and lifecycle management
- [x] Define versioned newline-delimited JSON host protocol
- [x] Add shared resource lifecycle manager and event bus foundation
- [ ] Add protocol authentication, permission enforcement, and resource quotas
- [ ] Add integration tests for all three runtimes

## Milestone 3 — Community services
- [ ] Server detail pages and rule acknowledgement
- [ ] Account registration and secure session handling
- [ ] Character profiles and community identity
- [ ] Server owner dashboard and moderation roles

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
