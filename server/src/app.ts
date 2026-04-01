import { Hono } from "hono";
import { SessionStore } from "./store";
import { AgentState } from "./models";
import { sendNotification, pruneDebounce } from "./ntfy";
import { DASHBOARD_HTML } from "./dashboard";

export const store = new SessionStore();
const pendingInput = new Map<string, string[]>();

type BroadcastFn = (msg: string) => void;
let broadcastWS: BroadcastFn = () => {};
export function setBroadcast(fn: BroadcastFn): void { broadcastWS = fn; }

export const app = new Hono();

app.get("/", (c) => c.redirect("/dashboard"));
app.get("/dashboard", (c) => c.html(DASHBOARD_HTML));
app.get("/health", (c) => c.json({ status: "ok" }));

app.post("/event", async (c) => {
  let raw: Record<string, unknown>;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const result = store.processEvent(raw);
  const msg = store.toStateMessage();
  broadcastWS(JSON.stringify(msg));

  // ntfy on transition into notifiable state (fire-and-forget)
  if (result.transitioned &&
      (result.new_status === AgentState.AWAITING_INPUT || result.new_status === AgentState.ERROR)) {
    sendNotification(result.session).catch(() => {});
  }

  if (result.new_status === AgentState.COMPLETE) {
    pruneDebounce(result.session_id);
  }

  return c.json({ accepted: true }, 202);
});

app.get("/status", (c) => c.json(store.toStateMessage()));

app.post("/session/:id/metrics", async (c) => {
  const sessionId = c.req.param("id");
  let data: Record<string, unknown>;
  try {
    data = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }
  const changed = store.updateMetrics(sessionId, data);
  if (changed) {
    broadcastWS(JSON.stringify(store.toStateMessage()));
  }
  return c.json({ accepted: true }, 202);
});

app.post("/session/:id/input", async (c) => {
  const sessionId = c.req.param("id");
  let data: Record<string, unknown>;
  try {
    data = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }
  const text = String(data.text ?? "").trim();
  if (!text) return c.json({ error: "empty input" }, 400);
  const queue = pendingInput.get(sessionId) ?? [];
  queue.push(text);
  pendingInput.set(sessionId, queue);
  return c.json({ accepted: true, session_id: sessionId }, 202);
});

app.get("/session/:id/input", (c) => {
  const sessionId = c.req.param("id");
  const messages = pendingInput.get(sessionId) ?? [];
  pendingInput.delete(sessionId);
  return c.json({ session_id: sessionId, messages });
});

app.post("/broadcast", async (c) => {
  let data: Record<string, unknown>;
  try {
    data = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }
  const text = String(data.text ?? "").trim();
  if (!text) return c.json({ error: "empty input" }, 400);
  for (const session of store.getSessions().keys()) {
    const queue = pendingInput.get(session) ?? [];
    queue.push(text);
    pendingInput.set(session, queue);
  }
  return c.json({ accepted: true }, 202);
});
