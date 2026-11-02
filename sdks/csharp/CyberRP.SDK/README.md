# CyberRP C# Resource SDK

Build a .NET 8 class library and reference `CyberRP.SDK`. Implement `ICyberRPResource` with a public parameterless constructor.

```csharp
using System.Text.Json;
using CyberRP.SDK;

public sealed class ExampleResource : ICyberRPResource
{
    public Task StartAsync(ICyberRPServerApi api, CancellationToken cancellationToken = default)
    {
        api.Log.Info($"Resource started: {api.ResourceName}");
        api.On("player:joined", payload =>
        {
            api.Log.Info($"Player event received: {payload}");
            return Task.CompletedTask;
        });
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }
}
```

Compile the resource and set `entrypoints.server` in its manifest to the resulting DLL. The C# host is experimental, server-only, and disabled by default.
