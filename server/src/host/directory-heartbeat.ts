import { setTimeout as delay } from "node:timers/promises";

export type DirectoryHostAgentOptions = {
  directoryUrl: string;
  serverId: string;
  credential: string;
  getPlayerCount: () => number | Promise<number>;
  intervalMs?: number;
  requestTimeoutMs?: number;
  fetcher?: typeof fetch;
  onError?: (error: Error) => void;
};

function validateOptions(options: DirectoryHostAgentOptions): URL {
  let url: URL;
  try {
    url = new URL(options.directoryUrl);
  } catch {
    throw new Error("directoryUrl must be a valid absolute URL.");
  }
  const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && localHost)) {
    throw new Error("The directory URL must use HTTPS except for localhost development.");
  }
  if (!/^[0-9a-f-]{36}$/i.test(options.serverId)) throw new Error("serverId must be a UUID.");
  if (!options.credential || options.credential.length > 256) throw new Error("A valid server credential is required.");
  if (options.intervalMs !== undefined && (!Number.isInteger(options.intervalMs) || options.intervalMs < 10_000)) {
    throw new Error("intervalMs must be an integer of at least 10000.");
  }
  if (options.requestTimeoutMs !== undefined && (!Number.isInteger(options.requestTimeoutMs) || options.requestTimeoutMs < 1000)) {
    throw new Error("requestTimeoutMs must be an integer of at least 1000.");
  }
  return url;
}

/**
 * Sends authenticated heartbeats from a server-host process to the CyberRP
 * directory. The game/server adapter supplies the authoritative player count.
 */
export class DirectoryHeartbeatAgent {
  private readonly baseUrl: URL;
  private readonly fetcher: typeof fetch;
  private readonly intervalMs: number;
  private readonly requestTimeoutMs: number;
  private timer: ReturnType<typeof setInterval> | undefined;
  private inFlight: Promise<void> | undefined;

  constructor(private readonly options: DirectoryHostAgentOptions) {
    this.baseUrl = validateOptions(options);
    this.fetcher = options.fetcher ?? fetch;
    this.intervalMs = options.intervalMs ?? 30_000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
  }

  start(): void {
    if (this.timer) return;
    void this.heartbeatNow();
    this.timer = setInterval(() => { void this.heartbeatNow(); }, this.intervalMs);
    this.timer.unref?.();
  }

  async heartbeatNow(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.sendHeartbeat();
    try {
      await this.inFlight;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error("Directory heartbeat failed.");
      this.options.onError?.(normalized);
      throw normalized;
    } finally {
      this.inFlight = undefined;
    }
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.inFlight;
  }

  async unregister(): Promise<boolean> {
    const response = await this.request("DELETE");
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`Directory unregister failed (HTTP ${response.status}).`);
    return true;
  }

  private async sendHeartbeat(): Promise<void> {
    const playerCount = await this.options.getPlayerCount();
    if (!Number.isInteger(playerCount) || playerCount < 0 || playerCount > 10_000) {
      throw new Error("The server adapter returned an invalid player count.");
    }
    const response = await this.request("POST", JSON.stringify({ playerCount }));
    if (!response.ok) throw new Error(`Directory heartbeat failed (HTTP ${response.status}).`);
  }

  private async request(method: "POST" | "DELETE", body?: string): Promise<Response> {
    const url = new URL(`/v1/servers/${encodeURIComponent(this.options.serverId)}${method === "POST" ? "/heartbeat" : ""}`, this.baseUrl);
    return this.fetcher(url, {
      method,
      headers: {
        authorization: `Bearer ${this.options.credential}`,
        ...(body ? { "content-type": "application/json" } : {})
      },
      body,
      signal: AbortSignal.timeout(this.requestTimeoutMs)
    });
  }
}
