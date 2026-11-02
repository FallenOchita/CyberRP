export const RESOURCE_API_VERSION = "1" as const;

export type ResourceLanguage = "csharp" | "javascript" | "lua";
export type ResourceEntrypoints = {
  server?: string;
  client?: string;
  shared?: string;
};

export type ResourceManifest = {
  schemaVersion: 1;
  name: string;
  version: string;
  description?: string;
  author?: string;
  language: ResourceLanguage;
  entrypoints: ResourceEntrypoints;
  dependencies?: string[];
  permissions?: string[];
};

const identifier = /^[a-z0-9][a-z0-9._-]{1,63}$/i;
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

function isSafeRelativePath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 240) return false;
  if (value.includes("\\") || value.startsWith("/") || /^[a-z]:/i.test(value)) return false;
  return value.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

export function parseResourceManifest(value: unknown): ResourceManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Resource manifest must be a JSON object.");
  }
  const item = value as Record<string, unknown>;
  if (item.schemaVersion !== 1) throw new Error("Unsupported resource schemaVersion.");
  if (typeof item.name !== "string" || !identifier.test(item.name)) {
    throw new Error("Resource name must be 2-64 characters and use letters, numbers, dot, underscore, or hyphen.");
  }
  if (typeof item.version !== "string" || !semver.test(item.version)) {
    throw new Error("Resource version must use semantic versioning.");
  }
  if (!["csharp", "javascript", "lua"].includes(String(item.language))) {
    throw new Error("Resource language must be csharp, javascript, or lua.");
  }
  if (!item.entrypoints || typeof item.entrypoints !== "object" || Array.isArray(item.entrypoints)) {
    throw new Error("Resource entrypoints are required.");
  }
  const raw = item.entrypoints as Record<string, unknown>;
  const entrypoints: ResourceEntrypoints = {};
  for (const key of ["server", "client", "shared"] as const) {
    if (raw[key] !== undefined) {
      if (!isSafeRelativePath(raw[key])) throw new Error(`Invalid ${key} entrypoint path.`);
      entrypoints[key] = raw[key];
    }
  }
  if (!entrypoints.server && !entrypoints.client && !entrypoints.shared) {
    throw new Error("At least one resource entrypoint is required.");
  }
  const list = (field: unknown, label: string): string[] | undefined => {
    if (field === undefined) return undefined;
    if (!Array.isArray(field) || field.some((entry) => typeof entry !== "string" || entry.length > 96)) {
      throw new Error(`${label} must be an array of short strings.`);
    }
    return field as string[];
  };
  const permissions = list(item.permissions, "permissions");
  const dependencies = list(item.dependencies, "dependencies");
  return {
    schemaVersion: 1,
    name: item.name,
    version: item.version,
    ...(typeof item.description === "string" ? { description: item.description.slice(0, 500) } : {}),
    ...(typeof item.author === "string" ? { author: item.author.slice(0, 120) } : {}),
    language: item.language as ResourceLanguage,
    entrypoints,
    ...(dependencies ? { dependencies } : {}),
    ...(permissions ? { permissions } : {})
  };
}
