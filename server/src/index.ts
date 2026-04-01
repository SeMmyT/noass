import { serve } from "@hono/node-server";
import { WebSocketServer, WebSocket } from "ws";
import { app, store, setBroadcast } from "./app";

const port = Number(process.env.PORT) || 3333;
const server = serve({ fetch: app.fetch, port }, (info) => {
  const ntfy = process.env.NTFY_TOPIC || "disabled";
  console.log(`NOASS server :${info.port} (ntfy: ${ntfy})`);
});

// WebSocket server on same port
const wss = new WebSocketServer({ server: server as any });
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  // Send snapshot on connect
  ws.send(JSON.stringify(store.toStateMessage()));

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      // Handle commands from NOASS frontend (read, nudge, kill, revive)
      if (msg.type && msg.target) {
        // TODO: forward to OG orchestrator via tmux
        ws.send(JSON.stringify({ type: "ack", command: msg.type, target: msg.target, success: true }));
      }
    } catch { /* ignore malformed */ }
  });

  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
});

// Wire broadcast to WebSocket fanout
setBroadcast((msg: string) => {
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
});
