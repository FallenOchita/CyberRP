# Register a CyberRP server host

The registration CLI creates a directory listing and writes the returned host credential to a private local JSON file. Run it on the trusted host machine. The bootstrap registration key is required only for registration; routine heartbeats use the generated server credential.

## Requirements

- Node.js 24
- A deployed CyberRP directory API
- A bootstrap key configured as `CYBERRP_REGISTRATION_KEY`
- A server endpoint/address reachable by players (registration does not test connectivity)

## PowerShell example

Set the variables in the current terminal session. Do not put secrets in source control, screenshots, shared command history, or public logs.

```powershell
$env:CYBERRP_DIRECTORY_URL = "https://directory.example.com"
$env:CYBERRP_REGISTRATION_KEY = Read-Host "Directory bootstrap key"
$env:CYBERRP_SERVER_NAME = "Night City Roleplay"
$env:CYBERRP_SERVER_DESCRIPTION = "Community roleplay server"
$env:CYBERRP_SERVER_ADDRESS = "play.example.net"
$env:CYBERRP_SERVER_PORT = "30120"
$env:CYBERRP_SERVER_MAX_PLAYERS = "64"
$env:CYBERRP_SERVER_TAGS = "serious-rp,english"
$env:CYBERRP_GAME_VERSION = "2.31"
$env:CYBERRP_SERVER_CONFIG = "$env:LOCALAPPDATA\CyberRP\server-host.json"
npm run api:register
```

The command refuses to overwrite an existing configuration file. Use `-- --force` only when intentionally replacing it:

```powershell
npm run api:register -- --force
```

On success, the CLI prints the server ID and file path, but never prints the raw host credential. The output file is created with owner-only permissions where supported. Restrict access to this file, back it up securely, and do not commit it. The directory stores only a hash of the credential.

## Connect the heartbeat agent

Load `directoryUrl`, `serverId`, and `credential` from the generated file and pass them to `DirectoryHeartbeatAgent`. The host integration must provide a real player-count callback from its game/server adapter. See [Server host agent](./SERVER_HOST_AGENT.md).

The registration workflow only registers metadata and credentials. It does not create a Cyberpunk 2077 dedicated server, prove that the advertised address is reachable, or add multiplayer synchronization.
