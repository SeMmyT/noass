import { serve } from "@hono/node-server";
import { WebSocketServer, WebSocket } from "ws";
import { resolve } from "node:path";
import { app, store, setBroadcast } from "./app";
import { saveToDisk, loadFromDisk, hydrateStore } from "./persistence";

const port = Number(process.env.PORT) || 3333;
const cachePath = process.env.NOASS_CACHE_PATH || resolve("noass-cache.json");

// Load cached sessions before starting
const cache = await loadFromDisk(cachePath);
if (cache) {
  const count = hydrateStore(store, cache);
  console.log(`Restored ${count} sessions from cache (${cache.saved_at})`);
}

const server = serve({ fetch: app.fetch, port }, (info) => {
  const ntfy = process.env.NTFY_TOPIC || "disabled";
  console.log(`NOASS server :${info.port} (ntfy: ${ntfy}, cache: ${cachePath})`);
});

// WebSocket server on same port
const wss = new WebSocketServer({ server: server as any });
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify(store.toStateMessage()));

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type && msg.target) {
        ws.send(JSON.stringify({ type: "ack", command: msg.type, target: msg.target, success: true }));
      }
    } catch { /* ignore malformed */ }
  });

  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
});

setBroadcast((msg: string) => {
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
});

// Periodic cache save (every 30s)
const saveInterval = setInterval(() => {
  saveToDisk(store, cachePath).catch(e => console.warn("Cache save failed:", e));
}, 30_000);

// Graceful shutdown
async function shutdown() {
  console.log("Saving cache...");
  clearInterval(saveInterval);
  await saveToDisk(store, cachePath);
  wss.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
