import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function localHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function validateRegistrationInput(input) {
  let directory;
  try {
    directory = new URL(input.directoryUrl);
  } catch {
    throw new Error("CYBERRP_DIRECTORY_URL must be an absolute URL.");
  }
  if (directory.protocol !== "https:" && !(directory.protocol === "http:" && localHost(directory.hostname))) {
    throw new Error("Remote directory URLs must use HTTPS. HTTP is allowed only for localhost development.");
  }
  if (!input.registrationKey || input.registrationKey.length < 24) {
    throw new Error("CYBERRP_REGISTRATION_KEY must contain at least 24 characters.");
  }
  const server = input.server;
  if (!server || typeof server !== "object") throw new Error("Server details are required.");
  if (typeof server.name !== "string" || !server.name.trim() || server.name.length > 64) throw new Error("Server name must be 1–64 characters.");
  if (typeof server.description !== "string" || server.description.length > 500) throw new Error("Description must be at most 500 characters.");
  if (typeof server.address !== "string" || !/^[a-zA-Z0-9.:[\]-]+$/.test(server.address) || server.address.length > 253) throw new Error("Server address is invalid.");
  if (!Number.isInteger(server.port) || server.port < 1 || server.port > 65535) throw new Error("Server port must be between 1 and 65535.");
  if (!Number.isInteger(server.maxPlayers) || server.maxPlayers < 1 || server.maxPlayers > 10000) throw new Error("Maximum players must be between 1 and 10000.");
  if (!Array.isArray(server.tags) || server.tags.length > 12 || !server.tags.every(tag => typeof tag === "string" && tag.trim() && tag.length <= 32)) throw new Error("Tags must be up to 12 non-empty strings of at most 32 characters.");
  if (typeof server.gameVersion !== "string" || !server.gameVersion.trim() || server.gameVersion.length > 32) throw new Error("Game version must be 1–32 characters.");
  return { directory, server: { ...server, name: server.name.trim(), address: server.address.trim(), tags: [...new Set(server.tags.map(tag => tag.trim()))], gameVersion: server.gameVersion.trim(), description: server.description.trim() } };
}

export async function registerServer(input, dependencies = {}) {
  const { directory, server } = validateRegistrationInput(input);
  const fetcher = dependencies.fetcher ?? fetch;
  const outputPath = resolve(input.outputPath);
  const response = await fetcher(new URL("/v1/servers", directory), {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.registrationKey}`,
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify(server),
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    const reason = response.status === 401 ? "The directory rejected the bootstrap key." :
      response.status === 409 ? "The server registration conflicts with an existing record." :
      `Directory registration failed (HTTP ${response.status}).`;
    throw new Error(reason);
  }
  const payload = await response.json();
  if (!payload || typeof payload !== "object" || !payload.server || typeof payload.server.id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(payload.server.id) || typeof payload.credential !== "string" ||
      payload.credential.length < 32 || payload.credential.length > 256) {
    throw new Error("The directory returned an invalid registration response; no credential file was written.");
  }

  const config = {
    directoryUrl: directory.origin,
    serverId: payload.server.id,
    credential: payload.credential,
    server: payload.server,
    createdAt: new Date().toISOString()
  };
  const file = await open(outputPath, input.force === true ? "w" : "wx", 0o600);
  try {
    await file.writeFile(`${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8" });
    await file.chmod(0o600);
  } catch (error) {
    await file.close();
    throw error;
  }
  await file.close();
  return { serverId: payload.server.id, outputPath };
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}

async function main() {
  const tags = (process.env.CYBERRP_SERVER_TAGS ?? "").split(",").map(tag => tag.trim()).filter(Boolean);
  const result = await registerServer({
    directoryUrl: required("CYBERRP_DIRECTORY_URL"),
    registrationKey: required("CYBERRP_REGISTRATION_KEY"),
    outputPath: process.env.CYBERRP_SERVER_CONFIG ?? "./cyberrp-server-credentials.json",
    force: process.argv.includes("--force"),
    server: {
      name: required("CYBERRP_SERVER_NAME"),
      description: process.env.CYBERRP_SERVER_DESCRIPTION ?? "",
      address: required("CYBERRP_SERVER_ADDRESS"),
      port: Number(required("CYBERRP_SERVER_PORT")),
      maxPlayers: Number(required("CYBERRP_SERVER_MAX_PLAYERS")),
      tags,
      gameVersion: required("CYBERRP_GAME_VERSION")
    }
  });
  process.stdout.write(`Registered server ${result.serverId}.\nCredential configuration saved to ${result.outputPath}.\nKeep this file private; the raw server credential is stored inside it.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(`CyberRP registration failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
    process.exitCode = 1;
  });
}
