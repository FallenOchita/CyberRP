namespace CyberRP.SDK;

public interface ICyberRPLogger
{
    void Info(string message);
    void Warn(string message);
    void Error(string message);
}

public interface ICyberRPServerApi
{
    string ResourceName { get; }
    ICyberRPLogger Log { get; }
    void On(string eventName, Func<JsonElement, Task> handler);
    Task EmitAsync(string eventName, JsonElement payload, CancellationToken cancellationToken = default);
}

public interface ICyberRPResource
{
    Task StartAsync(ICyberRPServerApi api, CancellationToken cancellationToken = default);
    Task StopAsync(CancellationToken cancellationToken = default);
}
