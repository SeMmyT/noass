import { Hono } from "hono";
import { SessionStore } from "./store";
import { AgentState } from "./models";
import { sendNotification, pruneDebounce } from "./ntfy";
import { DASHBOARD_HTML } from "./dashboard";
import {
  authMiddleware, generateMagicToken, verifyMagicToken,
  createSession, deleteSession, sendMagicLink,
  setSessionCookie, clearSessionCookie, isAllowedEmail,
  LOGIN_HTML,
} from "./auth";

export const store = new SessionStore();
const pendingInput = new Map<string, string[]>();

type BroadcastFn = (msg: string) => void;
let broadcastWS: BroadcastFn = () => {};
export function setBroadcast(fn: BroadcastFn): void { broadcastWS = fn; }

export const app = new Hono();

// Auth middleware — before all routes
app.use("*", authMiddleware);

// Auth routes
app.get("/auth/login", (c) => c.html(LOGIN_HTML));

app.post("/auth/login", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }
  const email = String(body.email ?? "").toLowerCase().trim();
  if (!email) return c.json({ error: "email required" }, 400);

  // Always return success-like response to prevent email enumeration
  if (!isAllowedEmail(email)) {
    return c.json({ message: "If that email is authorized, you'll receive a magic link" });
  }

  const token = generateMagicToken(email);
  if (!token) return c.json({ error: "failed to generate token" }, 500);

  const proto = c.req.header("x-forwarded-proto") ?? "https";
  const host = c.req.header("host") ?? "noass.semmy.dev";
  const baseUrl = `${proto}://${host}`;
  const sent = await sendMagicLink(token, baseUrl);

  if (!sent) return c.json({ error: "failed to send magic link" }, 500);
  return c.json({ message: "If that email is authorized, you'll receive a magic link" });
});

app.get("/auth/verify", (c) => {
  const token = c.req.query("token");
  if (!token) return c.html("<p>Missing token</p>", 400);

  const email = verifyMagicToken(token);
  if (!email) return c.html("<p>Invalid or expired link. <a href='/auth/login'>Try again</a></p>", 401);

  const sessionId = createSession();
  setSessionCookie(c, sessionId);
  return c.redirect("/dashboard");
});

app.get("/auth/logout", (c) => {
  clearSessionCookie(c);
  return c.redirect("/auth/login");
});

// Public
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
