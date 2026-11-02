# CyberRP

A community-focused Cyberpunk 2077 roleplay launcher and server directory, inspired by the discovery and convenience of FiveM.

> **Project status:** Early foundation. Cyberpunk 2077 does not provide a supported native multiplayer API. CyberRP's launcher, account services, server directory, and mod distribution can be developed independently; real-time multiplayer gameplay requires a separate, experimental synchronization layer and compatible game-side integration. The launcher does not claim to make the single-player game multiplayer by itself.

## Planned capabilities

- Server browser with search, tags, status, and player counts
- Favorites and recently visited servers
- Server detail pages, rules, and connection instructions
- Local game installation detection and launch
- Mod/resource manifests with integrity verification
- Launcher self-update through signed GitHub Releases
- Account and character services (later milestone)
- Server administration and community APIs (later milestone)

## Resource scripting model

CyberRP is designed for three resource languages, following a FiveM-style authoring model:

- **C#** — .NET resource SDK for strongly typed server resources.
- **JavaScript** — TypeScript-friendly resource API contracts and JavaScript entrypoints.
- **Lua** — lightweight resource API contract for Lua scripts.

Every resource uses a shared `cyberrp.resource.json` manifest with a language, semantic version, entrypoints, dependencies, and requested permissions. The manifest contract, schema, initial SDK interfaces, and a sample JavaScript resource are in this repository.

**Runtime status:** The repository includes experimental JavaScript, C#, and Lua worker processes, a dependency-aware resource lifecycle manager, and cross-runtime JSON event routing. Workers are opt-in and are not complete security sandboxes. Community resource code must never be evaluated inside the launcher or directory API process. See [resource development](docs/RESOURCE_DEVELOPMENT.md).

## Technology

- Electron + React + TypeScript + Vite
- Node.js 24
- GitHub Actions for validation and Windows packaging
- Future backend: Node.js service + PostgreSQL

## Development

Requirements: Node.js 24 and npm.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Directory API (development foundation)\n\nThe API can be built with `npm run api:build` and started with `CYBERRP_REGISTRATION_KEY=<long-random-secret> npm run api:start`. It listens on port `8787` by default; set `PORT` to override it. The registration key must contain at least 24 characters. The current server registry is in-memory and resets when the process restarts. Do not expose this development service as a production directory. See [docs/DIRECTORY_API.md](docs/DIRECTORY_API.md) for endpoints and limitations.\n\n## Security model

The renderer has no Node.js integration. It communicates with the main process through a narrow, typed preload API. Do not put secrets, authentication tokens, or privileged filesystem/network operations in renderer code. Production updates must be code-signed and verified before installation.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
