import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { parseResourceManifest, type ResourceManifest } from "../../../packages/resource-contract/src/index";

export type DiscoveredResource = { root: string; manifest: ResourceManifest };

async function validateEntrypoints(resourceRoot: string, manifest: ResourceManifest): Promise<void> {
  for (const relativePath of Object.values(manifest.entrypoints)) {
    if (!relativePath) continue;
    const candidate = resolve(resourceRoot, relativePath);
    if (!candidate.startsWith(resourceRoot + sep)) {
      throw new Error("Resource entrypoint escapes its resource directory.");
    }
    const actual = await realpath(candidate);
    if (!actual.startsWith(resourceRoot + sep) || !(await stat(actual)).isFile()) {
      throw new Error("Resource entrypoint must be a file inside its resource directory.");
    }
  }
}

export async function discoverResources(resourcesRoot: string): Promise<DiscoveredResource[]> {
  const root = await realpath(resourcesRoot);
  const entries = await readdir(root, { withFileTypes: true });
  const discovered: DiscoveredResource[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const candidate = resolve(root, entry.name);
    try {
      const actual = await realpath(candidate);
      if (actual !== candidate || !actual.startsWith(root + sep)) continue;
      const source = await readFile(join(actual, "cyberrp.resource.json"), "utf8");
      const manifest = parseResourceManifest(JSON.parse(source));
      await validateEntrypoints(actual, manifest);
      discovered.push({ root: actual, manifest });
    } catch {
      // Invalid or incomplete resources are skipped rather than loaded.
      // A diagnostics channel will expose per-resource errors in a later milestone.
      continue;
    }
  }
  return discovered;
}
