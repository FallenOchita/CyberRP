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

## Security model

The renderer has no Node.js integration. It communicates with the main process through a narrow, typed preload API. Do not put secrets, authentication tokens, or privileged filesystem/network operations in renderer code. Production updates must be code-signed and verified before installation.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
