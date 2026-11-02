export const HOST_PROTOCOL_VERSION = 1 as const;

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type HostRequest =
  | { protocol: 1; id: string; type: "start"; resourceName: string; entrypoint: string; permissions: string[] }
  | { protocol: 1; id: string; type: "stop" }
  | { protocol: 1; id: string; type: "event"; eventName: string; payload: JsonValue };

export type HostMessage =
  | { protocol: 1; id: string; type: "ready" }
  | { protocol: 1; id: string; type: "response"; ok: true; result?: JsonValue }
  | { protocol: 1; id: string; type: "response"; ok: false; error: string }
  | { protocol: 1; type: "log"; level: "info" | "warn" | "error"; message: string }
  | { protocol: 1; type: "emit"; eventName: string; payload: JsonValue }
  | { protocol: 1; type: "subscribe"; eventName: string }
  | { protocol: 1; type: "fatal"; error: string };

export function parseHostMessage(line: string): HostMessage {
  const value: unknown = JSON.parse(line);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Host message must be an object.");
  const message = value as Record<string, unknown>;
  if (message.protocol !== HOST_PROTOCOL_VERSION || typeof message.type !== "string") {
    throw new Error("Host protocol version or message type is invalid.");
  }
  if (message.type === "ready" && typeof message.id === "string") return message as HostMessage;
  if (message.type === "response" && typeof message.id === "string" && typeof message.ok === "boolean") return message as HostMessage;
  if (message.type === "log" && ["info", "warn", "error"].includes(String(message.level)) && typeof message.message === "string") return message as HostMessage;
  if (message.type === "emit" && typeof message.eventName === "string" && "payload" in message) return message as HostMessage;
  if (message.type === "subscribe" && typeof message.eventName === "string") return message as HostMessage;
  if (message.type === "fatal" && typeof message.error === "string") return message as HostMessage;
  throw new Error("Malformed host message.");
}
