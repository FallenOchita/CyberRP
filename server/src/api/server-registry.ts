import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export type ServerRegistration = {
  name: string;
  description: string;
  address: string;
  port: number;
  maxPlayers: number;
  tags: string[];
  gameVersion: string;
};

export type PublicServer = ServerRegistration & {
  id: string;
  playerCount: number;
  status: "online" | "offline";
  createdAt: string;
  lastHeartbeatAt: string;
};

type StoredServer = PublicServer & { credentialHash: string };

const HEARTBEAT_TIMEOUT_MS = 90_000;

function hashCredential(value: string): Buffer {
  return Buffer.from(value, "utf8");
}

export function credentialsMatch(provided: string, expected: string): boolean {
  const a = hashCredential(provided);
  const b = hashCredential(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class InMemoryServerRegistry {
  private readonly servers = new Map<string, StoredServer>();

  register(input: ServerRegistration): { server: PublicServer; credential: string } {
    const credential = randomBytes(32).toString("base64url");
    const now = new Date().toISOString();
    const server: StoredServer = {
      ...input,
      id: randomUUID(),
      playerCount: 0,
      status: "online",
      createdAt: now,
      lastHeartbeatAt: now,
      credentialHash: credential
    };
    this.servers.set(server.id, server);
    return { server: this.toPublic(server), credential };
  }

  list(filters: { search?: string; tag?: string } = {}): PublicServer[] {
    const now = Date.now();
    const search = filters.search?.trim().toLocaleLowerCase();
    const tag = filters.tag?.trim().toLocaleLowerCase();
    return [...this.servers.values()]
      .map((server) => ({
        ...this.toPublic(server),
        status: now - Date.parse(server.lastHeartbeatAt) <= HEARTBEAT_TIMEOUT_MS ? "online" as const : "offline" as const
      }))
      .filter((server) => !search || [server.name, server.description, server.address].some((value) => value.toLocaleLowerCase().includes(search)))
      .filter((server) => !tag || server.tags.some((value) => value.toLocaleLowerCase() === tag))
      .sort((a, b) => Number(b.status === "online") - Number(a.status === "online") || a.name.localeCompare(b.name));
  }

  heartbeat(id: string, credential: string, playerCount: number): PublicServer | null {
    const server = this.servers.get(id);
    if (!server || !credentialsMatch(credential, server.credentialHash)) return null;
    server.playerCount = playerCount;
    server.lastHeartbeatAt = new Date().toISOString();
    server.status = "online";
    return this.toPublic(server);
  }

  remove(id: string, credential: string): boolean {
    const server = this.servers.get(id);
    if (!server || !credentialsMatch(credential, server.credentialHash)) return false;
    return this.servers.delete(id);
  }

  private toPublic(server: StoredServer): PublicServer {
    const { credentialHash: _credentialHash, ...publicServer } = server;
    return publicServer;
  }
}
