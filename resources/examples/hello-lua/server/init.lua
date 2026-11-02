CyberRP.Log.info("Hello from CyberRP Lua!")

CyberRP.On("player:joined", function(player)
  CyberRP.Log.info("A player joined the server")
  CyberRP.Emit("chat:system", { text = "Welcome to CyberRP!" })
end)
