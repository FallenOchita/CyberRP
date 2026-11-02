import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
const listeners = new Map();
let started = false;

function send(message) {
  process.stdout.write(\`\${JSON.stringify({ protocol: 1, ...message })}\n\`);
}

function log(level, message) {
  send({ type: "log", level, message: String(message).slice(0, 4000) });
}

async function handle(line) {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    send({ type: "fatal", error: "Invalid host request JSON." });
    process.exitCode = 1;
    input.close();
    return;
  }

  if (request?.protocol !== 1 || typeof request.type !== "string") {
    send({ type: "fatal", error: "Unsupported host request." });
    process.exitCode = 1;
    input.close();
    return;
  }

  if (request.type === "start" && !started) {
    if (typeof request.entrypoint !== "string") {
      send({ type: "fatal", error: "Start request is missing an entrypoint." });
      process.exitCode = 1;
      input.close();
      return;
    }

    const api = Object.freeze({
      log: (message) => log("info", message),
      warn: (message) => log("warn", message),
      error: (message) => log("error", message),
      emit: (eventName, payload = null) => {
        if (typeof eventName !== "string" || eventName.length < 1 || eventName.length > 128) {
          throw new Error("Invalid event name.");
        }
        send({ type: "emit", eventName, payload });
      },
      on: (eventName, callback) => {
        if (typeof eventName !== "string" || eventName.length < 1 || eventName.length > 128 || typeof callback !== "function") {
          throw new Error("Invalid event subscription.");
        }
        const handlers = listeners.get(eventName) ?? new Set();
        handlers.add(callback);
        listeners.set(eventName, handlers);
        return () => handlers.delete(callback);
      }
    });

    Object.defineProperty(globalThis, "cyberrp", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: api
    });

    try {
      await import(pathToFileURL(request.entrypoint).href);
      started = true;
      send({ type: "ready", id: request.id });
    } catch (error) {
      send({ type: "fatal", error: error instanceof Error ? error.message : String(error) });
      process.exitCode = 1;
      input.close();
    }
    return;
  }

  if (request.type === "event" && started && typeof request.eventName === "string") {
    const handlers = [...(listeners.get(request.eventName) ?? [])];
    for (const handler of handlers) {
      try {
        await handler(request.payload);
      } catch (error) {
        log("error", error instanceof Error ? error.message : error);
      }
    }
    return;
  }

  if (request.type === "stop") {
    input.close();
    process.exit(0);
  }
}

input.on("line", (line) => {
  void handle(line);
});
