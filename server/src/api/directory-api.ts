import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { InMemoryServerRegistry, credentialsMatch, type ServerRegistration } from "./server-registry";

const MAX_BODY_BYTES = 16 * 1024;

function send(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(JSON.stringify(value));
}

function bearer(request: IncomingMessage): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 && token.length <= 256 ? token : null;
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
    chunks.push(buffer);
  }
  if (size === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_BODY");
  return value as Record<string, unknown>;
}

function registration(value: unknown): ServerRegistration {
  const body = object(value);
  const stringField = (key: string, max: number): string => {
    const item = body[key];
    if (typeof item !== "string" || item.trim().length === 0 || item.length > max) throw new Error("INVALID_BODY");
    return item.trim();
  };
  const integerField = (key: string, min: number, max: number): number => {
    const item = body[key];
    if (!Number.isInteger(item) || (item as number) < min || (item as number) > max) throw new Error("INVALID_BODY");
    return item as number;
  };
  const tagsValue = body.tags;
  if (!Array.isArray(tagsValue) || tagsValue.length > 12 || !tagsValue.every((tag) => typeof tag === "string" && tag.trim().length > 0 && tag.length <= 32)) {
    throw new Error("INVALID_BODY");
  }
  const address = stringField("address", 253);
  if (!/^[a-zA-Z0-9.:[\]-]+$/.test(address)) throw new Error("INVALID_BODY");
  return {
    name: stringField("name", 64),
    description: typeof body.description === "string" ? body.description.trim().slice(0, 500) : "",
    address,
    port: integerField("port", 1, 65535),
    maxPlayers: integerField("maxPlayers", 1, 10_000),
    tags: [...new Set((tagsValue as string[]).map((tag) => tag.trim()))],
    gameVersion: stringField("gameVersion", 32)
  };
}

export type DirectoryApiOptions = {
  registrationKey: string;
  registry?: InMemoryServerRegistry;
};

export function createDirectoryApi(options: DirectoryApiOptions): { server: Server; registry: InMemoryServerRegistry } {
  if (!options.registrationKey || options.registrationKey.length < 24) {
    throw new Error("CYBERRP_REGISTRATION_KEY must be configured with at least 24 characters.");
  }
  const registry = options.registry ?? new InMemoryServerRegistry();

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/health") {
      send(response, 200, { status: "ok", storage: "memory" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/v1/servers") {
      send(response, 200, {
        servers: registry.list({ search: url.searchParams.get("search") ?? undefined, tag: url.searchParams.get("tag") ?? undefined }),
        storage: "memory"
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/v1/servers") {
      if (!credentialsMatch(bearer(request) ?? "", options.registrationKey)) {
        send(response, 401, { error: "unauthorized" });
        return;
      }
      try {
        const created = registry.register(registration(await readJson(request)));
        send(response, 201, { server: created.server, credential: created.credential });
      } catch (error) {
        send(response, error instanceof Error && error.message === "BODY_TOO_LARGE" ? 413 : 400, { error: "invalid_request" });
      }
      return;
    }

    const match = /^\/v1\/servers\/([0-9a-f-]{36})(?:\/(heartbeat))?$/.exec(url.pathname);
    if (match && request.method === "POST" && match[2] === "heartbeat") {
      const token = bearer(request);
      if (!token) {
        send(response, 401, { error: "unauthorized" });
        return;
      }
      try {
        const body = object(await readJson(request));
        const playerCount = body.playerCount;
        if (!Number.isInteger(playerCount) || (playerCount as number) < 0 || (playerCount as number) > 10_000) throw new Error("INVALID_BODY");
        const updated = registry.heartbeat(match[1], token, playerCount as number);
        if (!updated) {
          send(response, 404, { error: "server_not_found" });
          return;
        }
        send(response, 200, { server: updated });
      } catch {
        send(response, 400, { error: "invalid_request" });
      }
      return;
    }

    if (match && request.method === "DELETE" && !match[2]) {
      const token = bearer(request);
      if (!token) {
        send(response, 401, { error: "unauthorized" });
        return;
      }
      if (!registry.remove(match[1], token)) {
        send(response, 404, { error: "server_not_found" });
        return;
      }
      send(response, 200, { deleted: true });
      return;
    }

    send(response, 404, { error: "not_found" });
  });

  return { server, registry };
}

if (process.env.CYBERRP_REGISTRATION_KEY && process.env.CYBERRP_API_AUTOSTART === "1") {
  const port = Number(process.env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port.");
  const { server } = createDirectoryApi({ registrationKey: process.env.CYBERRP_REGISTRATION_KEY });
  server.listen(port, "0.0.0.0", () => {
    process.stdout.write(`CyberRP directory API listening on port ${port} (in-memory registry).\n`);
  });
}
