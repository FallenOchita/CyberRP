import type { ResourceManifest } from "../../../packages/resource-contract/src/index";
import type { RuntimeAdapter, RuntimeContext, RuntimeHandle } from "./RuntimeAdapter";

export class ResourceRuntimeManager {
  private readonly adapters: Map<string, RuntimeAdapter>;
  private readonly running = new Map<string, RuntimeHandle>();

  constructor(adapters: RuntimeAdapter[]) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.language, adapter]));
    if (this.adapters.size !== adapters.length) throw new Error("Only one runtime adapter per language may be registered.");
  }

  async start(manifest: ResourceManifest, context: RuntimeContext): Promise<void> {
    if (this.running.has(manifest.name)) throw new Error(`Resource already running: ${manifest.name}`);
    const adapter = this.adapters.get(manifest.language);
    if (!adapter) throw new Error(`No runtime adapter registered for ${manifest.language}.`);
    if (!(await adapter.isAvailable())) throw new Error(`The ${manifest.language} runtime is not installed or configured.`);
    const handle = await adapter.start(manifest, context);
    this.running.set(manifest.name, handle);
  }

  async stop(resourceName: string): Promise<void> {
    const handle = this.running.get(resourceName);
    if (!handle) return;
    this.running.delete(resourceName);
    await handle.stop();
  }

  async stopAll(): Promise<void> {
    const entries = [...this.running.entries()];
    this.running.clear();
    const results = await Promise.allSettled(entries.map(([, handle]) => handle.stop()));
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length) throw new AggregateError(failures.map((result) => result.status === "rejected" ? result.reason : undefined), "One or more resources failed to stop.");
  }

  get runningResources(): string[] {
    return [...this.running.keys()];
  }
}
