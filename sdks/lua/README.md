# CyberRP Lua SDK

CyberRP Lua resources use Lua 5.4 and the shared `cyberrp.resource.json` manifest.

## Example

```lua
CyberRP.Log.info("Resource started")

CyberRP.On("player:joined", function(payload)
  CyberRP.Log.info("A player joined")
  CyberRP.Emit("chat:system", { text = "Welcome!" })
end)
```

The experimental worker exposes `CyberRP.Log.info/warn/error`, `CyberRP.On(eventName, callback)`, and `CyberRP.Emit(eventName, payload)`.

The worker requires Lua 5.4 and the `lua-cjson` module. It is disabled by default and supports server/shared entrypoints only.

**Security:** A separate process is not a complete sandbox. The current host does not restrict filesystem, network, CPU, memory, or native-module access. Enable it only for trusted scripts; do not run untrusted community resources.
