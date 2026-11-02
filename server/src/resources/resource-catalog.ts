import { readdir, readFile, realpath } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { parseResourceManifest, type ResourceManifest } from "../../../packages/resource-contract/src/index";

export type DiscoveredResource = { root: string; manifest: ResourceManifest };

export async function discoverResources(resourcesRoot: string): Promise<DiscoveredResource[]> {
  const root = await realpath(resourcesRoot);
  const entries = await readdir(root, { withFileTypes: true });
  const discovered: DiscoveredResource[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const candidate = resolve(root, entry.name);
    const actual = await realpath(candidate);
    if (actual !== candidate || !actual.startsWith(root + sep)) continue;
    try {
      const source = await readFile(join(actual, "cyberrp.resource.json"), "utf8");
      discovered.push({ root: actual, manifest: parseResourceManifest(JSON.parse(source)) });
    } catch (error) {
      // Invalid resources are skipped; callers can surface diagnostics separately.
      if (error instanceof SyntaxError) continue;
    }
  }
  return discovered;
}
