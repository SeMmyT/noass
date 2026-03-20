// ── ws-client.ts — WebSocket client with auto-reconnect ─────────────────────

import type { AppState, ServerMessage } from "./types";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

let status: ConnectionStatus = "disconnected";

export function getConnectionStatus(): ConnectionStatus {
  return status;
}

export function connectWS(
  state: AppState,
  url: string,
  onMessage: (msg: ServerMessage) => void
): void {
  status = status === "disconnected" ? "connecting" : "reconnecting";
  const ws = new WebSocket(url);
  state.ws = ws;

  ws.addEventListener("open", () => {
    status = "connected";
  });

  ws.addEventListener("message", (e) => {
    try {
      const msg: ServerMessage = JSON.parse(e.data as string);
      onMessage(msg);
    } catch (err) {
      console.error("WS parse error:", err);
    }
  });

  ws.addEventListener("close", () => {
    status = "reconnecting";
    state.ws = null;
    setTimeout(() => connectWS(state, url, onMessage), 3000);
  });

  ws.addEventListener("error", () => {
    ws.close();
  });
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
