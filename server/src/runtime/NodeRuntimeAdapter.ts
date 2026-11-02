import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type { ResourceManifest } from "../../../packages/resource-contract/src/index";
import type { RuntimeAdapter, RuntimeContext, RuntimeHandle } from "./RuntimeAdapter";
import type { HostMessage, HostRequest, JsonValue } from "./protocol";

export type NodeRuntimeOptions = {
  hostScriptPath: string;
  enabled?: boolean;
  startupTimeoutMs?: number;
  shutdownTimeoutMs?: number;
  maxMessageBytes?: number;
  nodeExecutable?: string;
  onMessage?: (resourceName: string, message: HostMessage) => void;
};

export class NodeRuntimeAdapter implements RuntimeAdapter {
  readonly language = "javascript" as const;
  private readonly enabled: boolean;
  private readonly startupTimeoutMs: number;
  private readonly shutdownTimeoutMs: number;
  private readonly maxMessageBytes: number;
  private readonly nodeExecutable: string;

  constructor(private readonly options: NodeRuntimeOptions) {
    if (!isAbsolute(options.hostScriptPath)) {
      throw new Error("The Node host script path must be absolute.");
    }
    this.enabled = options.enabled === true;
    this.startupTimeoutMs = options.startupTimeoutMs ?? 5000;
    this.shutdownTimeoutMs = options.shutdownTimeoutMs ?? 3000;
    this.maxMessageBytes = options.maxMessageBytes ?? 64 * 1024;
    this.nodeExecutable = options.nodeExecutable ?? process.execPath;
  }

  async isAvailable(): Promise<boolean> {
    return this.enabled && (await stat(this.options.hostScriptPath).then((item) => item.isFile()).catch(() => false));
  }

  async start(manifest: ResourceManifest, context: RuntimeContext): Promise<RuntimeHandle> {
    if (!this.enabled) throw new Error("JavaScript resource execution is disabled. Enable it only for trusted resources.");
    if (context.environment !== "server") throw new Error("The Node runtime currently supports server resources only.");

    const relativeEntrypoint = manifest.entrypoints.server ?? manifest.entrypoints.shared;
    if (!relativeEntrypoint) throw new Error("Resource has no server or shared JavaScript entrypoint.");

    const resourceRoot = await realpath(context.resourceRoot);
    const entrypoint = await realpath(resolve(resourceRoot, relativeEntrypoint));
    if (!entrypoint.startsWith(resourceRoot + sep) || !(await stat(entrypoint)).isFile()) {
      throw new Error("Resource entrypoint must be a file inside its resource directory.");
    }

    const hostScriptPath = await realpath(this.options.hostScriptPath);
    const child = spawn(this.nodeExecutable, [
      "--permission",
      \`--allow-fs-read=\${resourceRoot}\`,
      \`--allow-fs-read=\${dirname(hostScriptPath)}\`,
      hostScriptPath
    ], {
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

    return this.waitForReady(child, manifest.name, entrypoint);
  }

  private waitForReady(
    child: ChildProcessWithoutNullStreams,
    resourceName: string,
    entrypoint: string
  ): Promise<RuntimeHandle> {
    return new Promise((resolveReady, rejectReady) => {
      const requestId = randomUUID();
      const reader = createInterface({ input: child.stdout, crlfDelay: Infinity });
      let settled = false;
      let outputBytes = 0;
      let stderrBytes = 0;

      const cleanupStartup = () => clearTimeout(startupTimer);
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanupStartup();
        reader.close();
        child.kill();
        rejectReady(error);
      };

      const startupTimer = setTimeout(
        () => fail(new Error(\`JavaScript resource did not start within \${this.startupTimeoutMs}ms.\`)),
        this.startupTimeoutMs
      );

      reader.on("line", (line) => {
        outputBytes += Buffer.byteLength(line, "utf8");
        if (outputBytes > this.maxMessageBytes) {
          fail(new Error("JavaScript resource exceeded its startup output limit."));
          return;
        }
        let message: HostMessage;
        try {
          message = JSON.parse(line) as HostMessage;
          if (message.protocol !== 1 || typeof message.type !== "string") throw new Error("Invalid protocol.");
        } catch {
          fail(new Error("JavaScript resource sent an invalid host message."));
          return;
        }

        this.options.onMessage?.(resourceName, message);
        if (message.type === "fatal") {
          fail(new Error(\`JavaScript resource failed to start: \${message.error}\`));
        } else if (message.type === "ready" && message.id === requestId && !settled) {
          settled = true;
          cleanupStartup();
          resolveReady(this.createHandle(child, reader, resourceName));
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (stderrBytes > this.maxMessageBytes) child.stderr.pause();
      });
      child.once("error", (error) => fail(error));
      child.once("exit", (code, signal) => {
        if (!settled) fail(new Error(\`JavaScript resource exited before ready (code \${code}, signal \${signal}).\`));
      });

      const startRequest: HostRequest = {
        protocol: 1,
        id: requestId,
        type: "start",
        resourceName,
        entrypoint,
        permissions: []
      };
      child.stdin.write(\`\${JSON.stringify(startRequest)}\\n\`);
    });
  }

  private createHandle(
    child: ChildProcessWithoutNullStreams,
    reader: ReturnType<typeof createInterface>,
    resourceName: string
  ): RuntimeHandle {
    let stopPromise: Promise<void> | undefined;
    return {
      sendEvent: (eventName: string, payload: JsonValue) => {
        if (child.killed || child.exitCode !== null) throw new Error(\`Resource is not running: \${resourceName}\`);
        const request: HostRequest = { protocol: 1, id: randomUUID(), type: "event", eventName, payload };
        child.stdin.write(\`\${JSON.stringify(request)}\\n\`);
      },
      stop: () => {
        if (stopPromise) return stopPromise;
        stopPromise = new Promise<void>((resolveStop, rejectStop) => {
          const timer = setTimeout(() => {
            child.kill();
            rejectStop(new Error(\`Timed out stopping JavaScript resource: \${resourceName}\`));
          }, this.shutdownTimeoutMs);
          child.once("exit", () => {
            clearTimeout(timer);
            reader.close();
            resolveStop();
          });
          const request: HostRequest = { protocol: 1, id: randomUUID(), type: "stop" };
          child.stdin.write(\`\${JSON.stringify(request)}\\n\`);
        });
        return stopPromise;
      }
    };
  }
}
