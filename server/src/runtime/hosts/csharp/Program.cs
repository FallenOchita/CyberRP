using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;
using System.Text.Json.Serialization;
using CyberRP.SDK;

var host = new ResourceHost();
await host.RunAsync();

internal sealed class ResourceHost
{
    private readonly Dictionary<string, List<Func<JsonElement, Task>>> _handlers = new(StringComparer.Ordinal);
    private ICyberRPResource? _resource;
    private CancellationTokenSource? _lifetime;
    private string _resourceName = "unknown";

    public async Task RunAsync()
    {
        string? line;
        while ((line = await Console.ReadLineAsync()) is not null)
        {
            try
            {
                using var document = JsonDocument.Parse(line);
                var root = document.RootElement;
                if (root.GetProperty("protocol").GetInt32() != 1)
                    throw new InvalidOperationException("Unsupported host protocol.");

                var type = root.GetProperty("type").GetString();
                switch (type)
                {
                    case "start":
                        await StartAsync(root);
                        break;
                    case "event":
                        await DispatchAsync(root);
                        break;
                    case "stop":
                        await StopAsync();
                        return;
                    default:
                        throw new InvalidOperationException("Unknown host request type.");
                }
            }
            catch (Exception exception)
            {
                Send(new { type = "fatal", error = exception.GetBaseException().Message });
                return;
            }
        }

        await StopAsync();
    }

    private async Task StartAsync(JsonElement request)
    {
        if (_resource is not null)
            throw new InvalidOperationException("Resource has already started.");

        _resourceName = request.GetProperty("resourceName").GetString() ?? "unknown";
        var entrypoint = Path.GetFullPath(request.GetProperty("entrypoint").GetString()
            ?? throw new InvalidOperationException("Missing assembly entrypoint."));

        if (!File.Exists(entrypoint) || !entrypoint.EndsWith(".dll", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("C# entrypoint must be an existing .dll file.");

        var loadContext = new AssemblyLoadContext($"CyberRP:{_resourceName}", isCollectible: true);
        var assembly = loadContext.LoadFromAssemblyPath(entrypoint);
        var resourceType = assembly.GetTypes().FirstOrDefault(type =>
            !type.IsAbstract && !type.IsInterface && typeof(ICyberRPResource).IsAssignableFrom(type));

        if (resourceType is null || Activator.CreateInstance(resourceType) is not ICyberRPResource resource)
            throw new InvalidOperationException("Assembly must contain a public parameterless ICyberRPResource implementation.");

        _resource = resource;
        _lifetime = new CancellationTokenSource();
        await _resource.StartAsync(new ServerApi(_resourceName, _handlers, EmitAsync), _lifetime.Token);
        Send(new { type = "ready", id = request.GetProperty("id").GetString() ?? string.Empty });
    }

    private async Task DispatchAsync(JsonElement request)
    {
        var eventName = request.GetProperty("eventName").GetString() ?? string.Empty;
        var payload = request.TryGetProperty("payload", out var value) ? value.Clone() : JsonDocument.Parse("null").RootElement.Clone();
        if (_handlers.TryGetValue(eventName, out var handlers))
            foreach (var handler in handlers.ToArray())
                await handler(payload);
    }

    private async Task EmitAsync(string eventName, JsonElement payload, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        Send(new { type = "emit", eventName, payload });
        await Task.CompletedTask;
    }

    private async Task StopAsync()
    {
        if (_resource is not null)
        {
            try { await _resource.StopAsync(CancellationToken.None); }
            finally { _resource = null; }
        }
        _lifetime?.Cancel();
        _lifetime?.Dispose();
        _lifetime = null;
    }

    private static void Send(object message)
    {
        var json = JsonSerializer.Serialize(new { protocol = 1, message });
        using var document = JsonDocument.Parse(json);
        var output = new Dictionary<string, object?> { ["protocol"] = 1 };
        foreach (var property in document.RootElement.GetProperty("message").EnumerateObject())
            output[property.Name] = property.Value.Clone();
        Console.Out.WriteLine(JsonSerializer.Serialize(output));
        Console.Out.Flush();
    }

    private sealed class ServerApi(
        string resourceName,
        Dictionary<string, List<Func<JsonElement, Task>>> handlers,
        Func<string, JsonElement, CancellationToken, Task> emit) : ICyberRPServerApi
    {
        public string ResourceName => resourceName;
        public ICyberRPLogger Log { get; } = new HostLogger();

        public void On(string eventName, Func<JsonElement, Task> handler)
        {
            if (string.IsNullOrWhiteSpace(eventName) || eventName.Length > 128)
                throw new ArgumentException("Event name must be between 1 and 128 characters.", nameof(eventName));
            if (!handlers.TryGetValue(eventName, out var list))
                handlers[eventName] = list = [];
            list.Add(handler);
        }

        public Task EmitAsync(string eventName, JsonElement payload, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(eventName) || eventName.Length > 128)
                throw new ArgumentException("Event name must be between 1 and 128 characters.", nameof(eventName));
            return emit(eventName, payload, cancellationToken);
        }
    }

    private sealed class HostLogger : ICyberRPLogger
    {
        public void Info(string message) => Write("info", message);
        public void Warn(string message) => Write("warn", message);
        public void Error(string message) => Write("error", message);

        private static void Write(string level, string message) =>
            Console.Error.WriteLine($"[{level}] {message}");
    }
}
