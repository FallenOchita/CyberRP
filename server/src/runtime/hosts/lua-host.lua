-- CyberRP experimental Lua 5.4 worker.
-- Requires lua-cjson. This process boundary is not a security sandbox.
local json = require("cjson")
local listeners = {}
local started = false

local function send(message)
  message.protocol = 1
  io.stdout:write(json.encode(message), "\n")
  io.stdout:flush()
end

local function log(level, message)
  send({ type = "log", level = level, message = tostring(message):sub(1, 4000) })
end

local function handle(request)
  if type(request) ~= "table" or request.protocol ~= 1 or type(request.type) ~= "string" then
    send({ type = "fatal", error = "Unsupported host request." })
    os.exit(1)
  end

  if request.type == "start" and not started then
    if type(request.entrypoint) ~= "string" then
      send({ type = "fatal", error = "Start request is missing an entrypoint." })
      os.exit(1)
    end

    CyberRP = {
      Log = {
        info = function(message) log("info", message) end,
        warn = function(message) log("warn", message) end,
        error = function(message) log("error", message) end
      },
      Emit = function(eventName, payload)
        assert(type(eventName) == "string" and #eventName > 0 and #eventName <= 128, "Invalid event name")
        send({ type = "emit", eventName = eventName, payload = payload })
      end,
      On = function(eventName, callback)
        assert(type(eventName) == "string" and #eventName > 0 and #eventName <= 128, "Invalid event name")
        assert(type(callback) == "function", "Event callback must be a function")
        listeners[eventName] = listeners[eventName] or {}
        table.insert(listeners[eventName], callback)
      end
    }

    local chunk, loadError = loadfile(request.entrypoint)
    if not chunk then
      send({ type = "fatal", error = tostring(loadError) })
      os.exit(1)
    end
    local ok, runError = pcall(chunk)
    if not ok then
      send({ type = "fatal", error = tostring(runError) })
      os.exit(1)
    end
    started = true
    send({ type = "ready", id = request.id })
    return
  end

  if request.type == "event" and started and type(request.eventName) == "string" then
    for _, callback in ipairs(listeners[request.eventName] or {}) do
      local ok, callbackError = pcall(callback, request.payload)
      if not ok then log("error", callbackError) end
    end
    return
  end

  if request.type == "stop" then
    os.exit(0)
  end
end

for line in io.lines() do
  local ok, request = pcall(json.decode, line)
  if not ok then
    send({ type = "fatal", error = "Invalid host request JSON." })
    os.exit(1)
  end
  local handled, err = pcall(handle, request)
  if not handled then
    send({ type = "fatal", error = tostring(err) })
    os.exit(1)
  end
end
