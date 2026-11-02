import type { JsonValue } from "./protocol";

type Listener = (payload: JsonValue, sourceResource: string) => void | Promise<void>;

export class ResourceEventBus {
  private readonly listeners = new Map<string, Map<string, Set<Listener>>>();

  subscribe(resourceName: string, eventName: string, listener: Listener): () => void {
    if (!eventName.trim() || eventName.length > 128) throw new Error("Invalid event name.");
    let byResource = this.listeners.get(eventName);
    if (!byResource) {
      byResource = new Map();
      this.listeners.set(eventName, byResource);
    }
    let handlers = byResource.get(resourceName);
    if (!handlers) {
      handlers = new Set();
      byResource.set(resourceName, handlers);
    }
    handlers.add(listener);
    return () => {
      handlers?.delete(listener);
      if (handlers?.size === 0) byResource?.delete(resourceName);
      if (byResource?.size === 0) this.listeners.delete(eventName);
    };
  }

  async emit(sourceResource: string, eventName: string, payload: JsonValue): Promise<void> {
    if (!eventName.trim() || eventName.length > 128) throw new Error("Invalid event name.");
    const targets = this.listeners.get(eventName);
    if (!targets) return;
    const callbacks = [...targets.entries()]
      .filter(([resource]) => resource !== sourceResource)
      .flatMap(([, handlers]) => [...handlers]);
    const results = await Promise.allSettled(callbacks.map((handler) => handler(payload, sourceResource)));
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length) throw new AggregateError(failures.map((result) => result.status === "rejected" ? result.reason : undefined), `${failures.length} listener(s) failed for ${eventName}.`);
  }

  clearResource(resourceName: string): void {
    for (const [eventName, byResource] of this.listeners) {
      byResource.delete(resourceName);
      if (byResource.size === 0) this.listeners.delete(eventName);
    }
  }
}
