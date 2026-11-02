import type { ResourceLanguage, ResourceManifest } from "../../../packages/resource-contract/src/index";

export type RuntimeContext = {
  resourceRoot: string;
  resourceName: string;
  environment: "server" | "client";
};

export type RuntimeHandle = {
  stop: () => Promise<void>;
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
