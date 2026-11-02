import type { ResourceLanguage, ResourceManifest } from "../../../packages/resource-contract/src/index";

export type RuntimeContext = {
  resourceRoot: string;
  resourceName: string;
  environment: "server" | "client";
  emitEvent?: (eventName: string, payload: import("./protocol").JsonValue) => void;
};

export type RuntimeHandle = {
  stop: () => Promise<void>;
  sendEvent?: (eventName: string, payload: import('./protocol').JsonValue) => void;
};

/**
 * Runtime implementations must run scripts out-of-process with restricted
 * permissions. Do not execute community resource code inside the launcher
 * or directory API process.
 */
export interface RuntimeAdapter {
  readonly language: ResourceLanguage;
  isAvailable(): Promise<boolean>;
  start(manifest: ResourceManifest, context: RuntimeContext): Promise<RuntimeHandle>;
}
