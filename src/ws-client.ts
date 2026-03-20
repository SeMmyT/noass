// ── ws-client.ts — WebSocket client with auto-reconnect ─────────────────────

import type { AppState, ServerMessage } from "./types";

export function connectWS(
  state: AppState,
  url: string,
  onMessage: (msg: ServerMessage) => void
): void {
  const ws = new WebSocket(url);
  state.ws = ws;

  ws.addEventListener("open", () => {
    console.log("WS connected to", url);
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
    console.log("WS disconnected, reconnecting in 3s...");
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
