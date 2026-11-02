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
- [ ] Persist selected game path and add launch arguments
- [ ] Persist local settings and favorites
- [ ] Replace demo servers with a typed directory API

## Milestone 2 — Community services
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
