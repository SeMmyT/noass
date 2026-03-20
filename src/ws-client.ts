// ── ws-client.ts — WebSocket client with exponential backoff reconnect ────────

import type { AppState, ServerMessage, StateMessage } from "./types";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

const MAX_RETRIES = 20;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

let status: ConnectionStatus = "disconnected";
let retryCount = 0;

export function getConnectionStatus(): ConnectionStatus {
  return status;
}

function isValidStateMessage(msg: any): msg is StateMessage {
  return (
    msg &&
    msg.type === "state" &&
    Array.isArray(msg.panes) &&
    msg.stats &&
    typeof msg.stats.total_panes === "number"
  );
}

function isValidServerMessage(msg: any): msg is ServerMessage {
  if (!msg || typeof msg.type !== "string") return false;
  switch (msg.type) {
    case "state":
      return isValidStateMessage(msg);
    case "readResult":
      return typeof msg.target === "string" && typeof msg.content === "string";
    case "ack":
      return typeof msg.command === "string" && typeof msg.success === "boolean";
    default:
      return false;
  }
}

export function connectWS(
  state: AppState,
  url: string,
  onMessage: (msg: ServerMessage) => void
): void {
  status = retryCount === 0 ? "connecting" : "reconnecting";

  let ws: WebSocket;
  try {
    ws = new WebSocket(url);
  } catch {
    status = "disconnected";
    return;
  }
  state.ws = ws;

  ws.addEventListener("open", () => {
    status = "connected";
    retryCount = 0; // Reset on successful connection
  });

  ws.addEventListener("message", (e) => {
    try {
      const raw = JSON.parse(e.data as string);
      if (isValidServerMessage(raw)) {
        onMessage(raw);
      }
    } catch {
      // Malformed JSON — ignore
    }
  });

  ws.addEventListener("close", () => {
    status = "reconnecting";
    state.ws = null;

    if (retryCount >= MAX_RETRIES) {
      status = "disconnected";
      return;
    }

    const delay = Math.min(BASE_DELAY_MS * 2 ** retryCount, MAX_DELAY_MS);
    retryCount++;
    setTimeout(() => connectWS(state, url, onMessage), delay);
  });

  ws.addEventListener("error", () => {
    ws.close();
  });
}

export function resetRetries(): void {
  retryCount = 0;
}

export function sendCommand(
  state: AppState,
  type: string,
  target: string,
  extra?: Record<string, unknown>
): void {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({ type, target, ...extra }));
  }
}
