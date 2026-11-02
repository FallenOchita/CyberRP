import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type { ResourceManifest } from "../../../packages/resource-contract/src/index";
import type { RuntimeAdapter, RuntimeContext, RuntimeHandle } from "./RuntimeAdapter";
import type { HostMessage, HostRequest, JsonValue } from "./protocol";

export type LuaRuntimeOptions = {
  hostScriptPath: string;
  luaExecutable?: string;
  enabled?: boolean;
  startupTimeoutMs?: number;
  shutdownTimeoutMs?: number;
  maxMessageBytes?: number;
  onMessage?: (resourceName: string, message: HostMessage) => void;
};

/**
 * Experimental Lua 5.4 adapter. Lua scripts execute in a separate process,
 * but this is not a security sandbox. Only enable it for trusted resources.
 */
export class LuaRuntimeAdapter implements RuntimeAdapter {
  readonly language = "lua" as const;
  private readonly startupTimeoutMs: number;
  private readonly shutdownTimeoutMs: number;
  private readonly maxMessageBytes: number;

  constructor(private readonly options: LuaRuntimeOptions) {
    if (!isAbsolute(options.hostScriptPath)) throw new Error("The Lua host script path must be absolute.");
    this.startupTimeoutMs = options.startupTimeoutMs ?? 8000;
    this.shutdownTimeoutMs = options.shutdownTimeoutMs ?? 3000;
    this.maxMessageBytes = options.maxMessageBytes ?? 64 * 1024;
  }

  async isAvailable(): Promise<boolean> {
    if (this.options.enabled !== true) return false;
    return stat(this.options.hostScriptPath).then((file) => file.isFile()).catch(() => false);
  }

  async start(manifest: ResourceManifest, context: RuntimeContext): Promise<RuntimeHandle> {
    if (this.options.enabled !== true) throw new Error("Lua resource execution is disabled by default.");
    if (context.environment !== "server") throw new Error("The Lua runtime currently supports server resources only.");
    const relativeEntrypoint = manifest.entrypoints.server ?? manifest.entrypoints.shared;
    if (!relativeEntrypoint) throw new Error("Resource has no server or shared Lua entrypoint.");

    const resourceRoot = await realpath(context.resourceRoot);
    const entrypoint = await realpath(resolve(resourceRoot, relativeEntrypoint));
    if (!entrypoint.startsWith(resourceRoot + sep) || !(await stat(entrypoint)).isFile()) {
      throw new Error("Lua entrypoint must be a file inside its resource directory.");
    }
    if (!entrypoint.toLowerCase().endsWith(".lua")) throw new Error("Lua entrypoint must be a .lua file.");

    const hostScriptPath = await realpath(this.options.hostScriptPath);
    const child = spawn(this.options.luaExecutable ?? "lua5.4", [hostScriptPath], {
      cwd: resourceRoot,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        PATH: process.env.PATH ?? "",
        ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
        ...(process.env.WINDIR ? { WINDIR: process.env.WINDIR } : {})
      }
    });

    return this.waitForReady(child, manifest.name, entrypoint, context.emitEvent);
  }

  private waitForReady(child: ChildProcessWithoutNullStreams, resourceName: string, entrypoint: string, emitEvent?: (eventName: string, payload: JsonValue) => void): Promise<RuntimeHandle> {
    return new Promise((resolveReady, rejectReady) => {
      const id = randomUUID();
      const reader = createInterface({ input: child.stdout, crlfDelay: Infinity });
      let settled = false;
      const timer = setTimeout(() => fail(new Error("Lua resource startup timed out.")), this.startupTimeoutMs);
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reader.close();
        child.kill();
        rejectReady(error);
      };

      reader.on("line", (line) => {
        if (Buffer.byteLength(line, "utf8") > this.maxMessageBytes) return fail(new Error("Lua worker message exceeded the size limit."));
        let message: HostMessage;
        try {
          message = JSON.parse(line) as HostMessage;
          if (message.protocol !== 1 || typeof message.type !== "string") throw new Error("Invalid protocol.");
        } catch {
          return fail(new Error("Lua worker sent an invalid protocol message."));
        }
        this.options.onMessage?.(resourceName, message);
        if (message.type === "emit") emitEvent?.(message.eventName, message.payload);
        if (message.type === "fatal") return fail(new Error(message.error));
        if (message.type === "ready" && message.id === id && !settled) {
          settled = true;
          clearTimeout(timer);
          resolveReady(this.createHandle(child, reader, resourceName));
        }
      });

      child.once("error", fail);
      child.once("exit", (code) => {
        if (!settled) fail(new Error(`Lua worker exited before ready (code ${code}).`));
      });
      const request: HostRequest = { protocol: 1, id, type: "start", resourceName, entrypoint, permissions: [] };
      child.stdin.write(`${JSON.stringify(request)}\n`);
    });
  }

  private createHandle(child: ChildProcessWithoutNullStreams, reader: ReturnType<typeof createInterface>, resourceName: string): RuntimeHandle {
    let stopping: Promise<void> | undefined;
    return {
      sendEvent: (eventName: string, payload: JsonValue) => {
        if (child.exitCode !== null || child.killed) throw new Error(`Lua resource is not running: ${resourceName}`);
        const request: HostRequest = { protocol: 1, id: randomUUID(), type: "event", eventName, payload };
        child.stdin.write(`${JSON.stringify(request)}\n`);
      },
      stop: () => {
        if (stopping) return stopping;
        stopping = new Promise<void>((resolveStop, rejectStop) => {
          const timer = setTimeout(() => {
            child.kill();
            rejectStop(new Error(`Timed out stopping Lua resource: ${resourceName}`));
          }, this.shutdownTimeoutMs);
          child.once("exit", () => {
            clearTimeout(timer);
            reader.close();
            resolveStop();
          });
          const request: HostRequest = { protocol: 1, id: randomUUID(), type: "stop" };
          child.stdin.write(`${JSON.stringify(request)}\n`);
        });
        return stopping;
      }
    };
  }
}
