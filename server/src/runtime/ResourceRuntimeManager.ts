import type { ResourceManifest } from "../../../packages/resource-contract/src/index";
import type { DiscoveredResource } from "../resources/resource-catalog";
import type { RuntimeAdapter, RuntimeContext, RuntimeHandle } from "./RuntimeAdapter";
import type { JsonValue } from "./protocol";

type RunningResource = {
  manifest: ResourceManifest;
  context: RuntimeContext;
  handle: RuntimeHandle;
};

export class ResourceRuntimeManager {
  private readonly adapters: Map<string, RuntimeAdapter>;
  private readonly running = new Map<string, RunningResource>();

  constructor(adapters: RuntimeAdapter[]) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.language, adapter]));
    if (this.adapters.size !== adapters.length) {
      throw new Error("Only one runtime adapter per language may be registered.");
    }
  }

  async start(manifest: ResourceManifest, context: RuntimeContext): Promise<void> {
    this.assertNotRunning(manifest.name);
    this.assertDependenciesRunning(manifest);
    await this.startOne(manifest, context);
  }

  /**
   * Starts a discovered resource set in dependency order. If any resource
   * fails to start, resources started by this call are stopped in reverse
   * order before the original error is rethrown.
   */
  async startAll(resources: DiscoveredResource[]): Promise<void> {
    const ordered = this.resolveStartOrder(resources);
    const started: string[] = [];
    try {
      for (const resource of ordered) {
        if (this.running.has(resource.manifest.name)) continue;
        await this.startOne(resource.manifest, {
          resourceRoot: resource.root,
          resourceName: resource.manifest.name,
          environment: "server"
        });
        started.push(resource.manifest.name);
      }
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      for (const name of started.reverse()) {
        try {
          await this.stop(name, true);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (rollbackErrors.length) {
        throw new AggregateError([error, ...rollbackErrors], "Resource startup failed and rollback was incomplete.");
      }
      throw error;
    }
  }

  private async startOne(manifest: ResourceManifest, context: RuntimeContext): Promise<void> {
    const adapter = this.adapters.get(manifest.language);
    if (!adapter) throw new Error(`No runtime adapter registered for ${manifest.language}.`);
    if (!(await adapter.isAvailable())) {
      throw new Error(`The ${manifest.language} runtime is not installed or is disabled.`);
    }
    const pendingEvents: Array<{ eventName: string; payload: JsonValue }> = [];
    const runtimeContext: RuntimeContext = {
      ...context,
      emitEvent: (eventName, payload) => {
        if (this.running.has(manifest.name)) this.emit(manifest.name, eventName, payload);
        else pendingEvents.push({ eventName, payload });
      }
    };
    const handle = await adapter.start(manifest, runtimeContext);
    this.running.set(manifest.name, { manifest, context: runtimeContext, handle });
    try {
      for (const event of pendingEvents) this.emit(manifest.name, event.eventName, event.payload);
    } catch (error) {
      this.running.delete(manifest.name);
      try {
        await handle.stop();
      } catch (stopError) {
        throw new AggregateError([error, stopError], `Resource ${manifest.name} failed while flushing startup events and could not be stopped cleanly.`);
      }
      throw error;
    }
  }

  emit(sourceResource: string, eventName: string, payload: JsonValue): number {
    if (!eventName.trim() || eventName.length > 128) throw new Error("Invalid event name.");
    if (!this.running.has(sourceResource)) throw new Error(`Event source is not running: ${sourceResource}`);

    const recipients = [...this.running.entries()].filter(([name]) => name !== sourceResource);
    const failures: unknown[] = [];
    let delivered = 0;
    for (const [name, resource] of recipients) {
      try {
        if (!resource.handle.sendEvent) {
          throw new Error(`Runtime for ${name} does not support event delivery.`);
        }
        resource.handle.sendEvent(eventName, payload);
        delivered += 1;
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) {
      throw new AggregateError(failures, `Event ${eventName} was not delivered to every running resource.`);
    }
    return delivered;
  }

  async stop(resourceName: string, allowDependents = false): Promise<void> {
    const resource = this.running.get(resourceName);
    if (!resource) return;

    if (!allowDependents) {
      const dependents = [...this.running.values()]
        .filter((candidate) => candidate.manifest.dependencies?.includes(resourceName))
        .map((candidate) => candidate.manifest.name);
      if (dependents.length) {
        throw new Error(`Cannot stop ${resourceName}; running resources depend on it: ${dependents.join(", ")}.`);
      }
    }

    await resource.handle.stop();
    this.running.delete(resourceName);
  }

  async stopAll(): Promise<void> {
    const names = [...this.running.keys()].reverse();
    const failures: unknown[] = [];
    for (const name of names) {
      try {
        await this.stop(name, true);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) {
      throw new AggregateError(failures, "One or more resources failed to stop.");
    }
  }

  private assertNotRunning(resourceName: string): void {
    if (this.running.has(resourceName)) throw new Error(`Resource already running: ${resourceName}`);
  }

  private assertDependenciesRunning(manifest: ResourceManifest): void {
    const missing = (manifest.dependencies ?? []).filter((name) => !this.running.has(name));
    if (missing.length) {
      throw new Error(`Resource ${manifest.name} requires resources that are not running: ${missing.join(", ")}.`);
    }
  }

  private resolveStartOrder(resources: DiscoveredResource[]): DiscoveredResource[] {
    const byName = new Map<string, DiscoveredResource>();
    for (const resource of resources) {
      const name = resource.manifest.name;
      if (byName.has(name)) throw new Error(`Duplicate resource name discovered: ${name}`);
      byName.set(name, resource);
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const ordered: DiscoveredResource[] = [];

    const visit = (name: string): void => {
      if (visited.has(name) || this.running.has(name)) return;
      if (visiting.has(name)) throw new Error(`Resource dependency cycle detected at ${name}.`);
      const resource = byName.get(name);
      if (!resource) throw new Error(`Missing resource dependency: ${name}.`);

      visiting.add(name);
      for (const dependency of resource.manifest.dependencies ?? []) {
        if (!this.running.has(dependency)) visit(dependency);
      }
      visiting.delete(name);
      visited.add(name);
      ordered.push(resource);
    };

    for (const resource of resources) visit(resource.manifest.name);
    return ordered;
  }

  get runningResources(): string[] {
    return [...this.running.keys()];
  }
}
