export type DirectoryServer = {
  id: string;
  name: string;
  description: string;
  address: string;
  port: number;
  maxPlayers: number;
  tags: string[];
  gameVersion: string;
  playerCount: number;
  status: "online" | "offline";
  createdAt: string;
  lastHeartbeatAt: string;
};

type DirectoryResponse = { servers: DirectoryServer[]; storage?: "memory" | "postgres" };

const DIRECTORY_URL = (import.meta.env.VITE_CYBERRP_DIRECTORY_URL ?? "http://127.0.0.1:8787").replace(/\\/$/, "");

export async function fetchDirectoryServers(search: string, signal?: AbortSignal): Promise<DirectoryResponse> {
  const url = new URL("/v1/servers", DIRECTORY_URL);
  if (search.trim()) url.searchParams.set("search", search.trim());
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal
  });
  if (!response.ok) throw new Error(`Directory returned HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as DirectoryResponse).servers)) {
    throw new Error("Directory returned an invalid response");
  }
  const servers = (payload as DirectoryResponse).servers;
  if (!servers.every((server) => server && typeof server.id === "string" && typeof server.name === "string" &&
    typeof server.address === "string" && Number.isInteger(server.port) && Number.isInteger(server.maxPlayers) &&
    Number.isInteger(server.playerCount) && Array.isArray(server.tags) &&
    (server.status === "online" || server.status === "offline"))) {
    throw new Error("Directory returned malformed server records");
  }
  return payload as DirectoryResponse;
}
