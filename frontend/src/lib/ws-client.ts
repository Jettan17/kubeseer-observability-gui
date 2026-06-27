/**
 * WebSocket protocol types matching the Rust backend.
 */

// Client → Server messages
export type ClientMessage =
  | { type: 'subscribe'; channel: 'topology' | 'logs' | 'metrics'; params: Record<string, string> }
  | { type: 'unsubscribe'; channel: string; subscriptionId: string }
  | { type: 'ping' };

// Server → Client messages
export type ServerMessage =
  | { type: 'snapshot'; channel: string; data: unknown }
  | { type: 'patch'; channel: string; patches: JsonPatch[] }
  | { type: 'log_batch'; subscriptionId: string; lines: LogLineWire[] }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong' };

export interface LogLineWire {
  timestamp: string;
  container: string;
  level?: 'error' | 'warn' | 'info' | 'debug';
  message: string;
}

export interface JsonPatch {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}
