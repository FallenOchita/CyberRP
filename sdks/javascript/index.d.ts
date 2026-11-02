export interface CyberRPLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface CyberRPServerApi {
  readonly resourceName: string;
  readonly log: CyberRPLogger;
  on(eventName: string, handler: (payload: unknown) => void | Promise<void>): void;
  emit(eventName: string, payload: unknown): Promise<void>;
}

export type CyberRPResourceStart = (api: CyberRPServerApi) => void | Promise<void>;
export type CyberRPResourceStop = () => void | Promise<void>;
