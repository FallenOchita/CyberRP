# CyberRP Lua SDK

Lua resources use the same `cyberrp.resource.json` manifest as C# and JavaScript resources.

The planned Lua host will provide a restricted `CyberRP` table with:
- `CyberRP.Log.info(message)`
- `CyberRP.Log.warn(message)`
- `CyberRP.On(eventName, callback)`
- `CyberRP.Emit(eventName, payload)`

These functions are an API contract, not an available in-game API yet. Lua execution will be hosted in a separate process with explicit resource permissions; community scripts must not be loaded into the launcher process.
