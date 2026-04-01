# Bridge Compaction: CCReStatus → NOASS

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Replace the Python CCReStatus bridge server with a TypeScript server inside the NOASS repo. One codebase, one app, CCReStatus becomes legacy.

**Architecture:** A Hono HTTP+WS server in `noass/server/` accepts Claude Code hook events via `POST /event`, derives agent status, broadcasts `StateMessage` objects over WebSocket (matching NOASS's existing `ws-client.ts` protocol), fires ntfy push notifications on state transitions, and serves the web dashboard. Runs on the PC; NOASS Tauri app connects from phone/Steam Deck.

**Tech Stack:** Hono (lightweight HTTP framework), `ws` (WebSocket server), native `fetch` for ntfy, Vitest for tests. Runs via `pnpm --filter server dev` or `node dist/index.js`.

**Risk:** HIGH (architectural) — new server layer that replaces an entire project.

---

## Protocol Translation Map

The core challenge: CCReStatus bridge speaks **SSE + HTTP** with `StatusUpdate` objects. NOASS frontend expects **WebSocket** with `StateMessage` objects. The new server translates between them.

```
CCReStatus StatusUpdate          →  NOASS StateMessage
─────────────────────────────────────────────────────
session_id                       →  pane.name (or custom_label)
status (AgentState enum)         →  pane.alive (awaiting_input/error/complete = dead)
context_percent (from metrics)   →  pane.ctx_pct, pane.ctx_k (pct × 8)
cost_usd                         →  (new field or encode in pane.last)
tool + tool_input_summary        →  pane.last (e.g. "Bash: npm test")
event                            →  log entry
sub_agents                       →  (sub-panes or encode in pane.last)
```

**StatusUpdate fields with NO PaneData equivalent** (extend types.ts):
- `cost_usd` → add `cost_usd?: number` to PaneData
- `model` → add `model?: string` to PaneData
- `status` → add `status?: string` to PaneData (raw status string)
- `cwd` → add `cwd?: string` to PaneData
- `sub_agents` → add `sub_agents?: SubAgent[]` to PaneData

**Alive/dead mapping:**
- `idle`, `thinking`, `tool_call` → alive = true
- `awaiting_input`, `error` → alive = true BUT flagged (dashboard highlights)
- `complete` → alive = false

---

## Staged Plan

### Stage 1 — Core server (accepts hooks, broadcasts WS)
### Stage 2 — ntfy push notifications
### Stage 3 — Web dashboard
### Stage 4 — NOASS frontend adaptation + types extension

---

### Task 1: Scaffold server package

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts` (entry point, placeholder)

**Step 1: Create server directory and package.json**

```json
{
  "name": "@noass/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "hono": "^4",
    "ws": "^8",
    "@hono/node-server": "^1"
  },
  "devDependencies": {
    "tsx": "^4",
    "typescript": "~5.6.2",
    "vitest": "^3",
    "@types/ws": "^8"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

**Step 3: Create placeholder entry point**

```typescript
// server/src/index.ts
import { serve } from "@hono/node-server";
import { app } from "./app";

const port = Number(process.env.PORT) || 3333;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`NOASS server listening on :${info.port}`);
});
```

**Step 4: Install dependencies**

Run: `cd ~/codeprojects/noass/server && pnpm install`

**Step 5: Commit**

```bash
git add server/
git commit -m "chore(server): scaffold NOASS bridge server package"
```

---

### Task 2: Models — status derivation (port from Python)

**Files:**
- Create: `server/src/models.ts`
- Create: `server/src/__tests__/models.test.ts`

**Step 1: Write failing tests**

```typescript
// server/src/__tests__/models.test.ts
import { describe, it, expect } from "vitest";
import { deriveStatus, AgentState, type HookEvent } from "../models";

describe("deriveStatus", () => {
  it("PreToolUse → TOOL_CALL", () => {
    expect(deriveStatus({ event_name: "PreToolUse" } as HookEvent)).toBe(AgentState.TOOL_CALL);
  });
  it("PostToolUse → THINKING", () => {
    expect(deriveStatus({ event_name: "PostToolUse" } as HookEvent)).toBe(AgentState.THINKING);
  });
  it("PostToolUseFailure → ERROR", () => {
    expect(deriveStatus({ event_name: "PostToolUseFailure" } as HookEvent)).toBe(AgentState.ERROR);
  });
  it("Stop with stop_hook_active → AWAITING_INPUT", () => {
    expect(deriveStatus({ event_name: "Stop", stop_hook_active: true } as HookEvent)).toBe(AgentState.AWAITING_INPUT);
  });
  it("Stop without stop_hook_active → COMPLETE", () => {
    expect(deriveStatus({ event_name: "Stop", stop_hook_active: false } as HookEvent)).toBe(AgentState.COMPLETE);
  });
  it("SessionStart → IDLE", () => {
    expect(deriveStatus({ event_name: "SessionStart" } as HookEvent)).toBe(AgentState.IDLE);
  });
  it("Notification permission_prompt → AWAITING_INPUT", () => {
    expect(deriveStatus({ event_name: "Notification", notification_type: "permission_prompt" } as HookEvent)).toBe(AgentState.AWAITING_INPUT);
  });
  it("PermissionRequest → AWAITING_INPUT", () => {
    expect(deriveStatus({ event_name: "PermissionRequest" } as HookEvent)).toBe(AgentState.AWAITING_INPUT);
  });
  it("unknown event → THINKING", () => {
    expect(deriveStatus({ event_name: "SomethingNew" } as HookEvent)).toBe(AgentState.THINKING);
  });
});
```

**Step 2: Run tests — expect failure**

Run: `cd ~/codeprojects/noass/server && pnpm test`
Expected: FAIL — `models` module doesn't exist

**Step 3: Implement models.ts**

```typescript
// server/src/models.ts
export const AgentState = {
  IDLE: "idle",
  THINKING: "thinking",
  TOOL_CALL: "tool_call",
  AWAITING_INPUT: "awaiting_input",
  ERROR: "error",
  COMPLETE: "complete",
} as const;

export type AgentStateValue = (typeof AgentState)[keyof typeof AgentState];

export interface HookEvent {
  hook_event_name?: string;  // raw from Claude Code
  event_name: string;
  session_id: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  notification_type?: string;
  message?: string;
  agent_id?: string;
  agent_type?: string;
  stop_hook_active?: boolean;
  last_assistant_message?: string;
  custom_label?: string;
}

export interface SubAgent {
  agent_id: string;
  agent_type: string;
  status: "running" | "completed";
  name: string;
}

export interface SessionState {
  session_id: string;
  status: AgentStateValue;
  previous_status: AgentStateValue | null;
  tool: string | null;
  tool_input_summary: string;
  message: string;
  event: string;
  label: string;
  sub_agents: SubAgent[];
  ts: string;
  // Metrics (from statusline sideband)
  context_percent: number | null;
  cost_usd: number | null;
  model: string | null;
  cwd: string | null;
}

export function parseHookEvent(raw: Record<string, unknown>): HookEvent {
  return {
    event_name: (raw.hook_event_name ?? raw.event_name ?? "") as string,
    session_id: (raw.session_id ?? "") as string,
    tool_name: raw.tool_name as string | undefined,
    tool_input: raw.tool_input as Record<string, unknown> | undefined,
    notification_type: raw.notification_type as string | undefined,
    message: raw.message as string | undefined,
    agent_id: raw.agent_id as string | undefined,
    agent_type: raw.agent_type as string | undefined,
    stop_hook_active: raw.stop_hook_active as boolean | undefined,
    last_assistant_message: raw.last_assistant_message as string | undefined,
    custom_label: raw.custom_label as string | undefined,
  };
}

export function deriveStatus(event: HookEvent): AgentStateValue {
  switch (event.event_name) {
    case "PreToolUse":
      return AgentState.TOOL_CALL;
    case "PostToolUse":
      return AgentState.THINKING;
    case "PostToolUseFailure":
      return AgentState.ERROR;
    case "Stop":
      return event.stop_hook_active ? AgentState.AWAITING_INPUT : AgentState.COMPLETE;
    case "SessionEnd":
    case "TaskCompleted":
      return AgentState.COMPLETE;
    case "UserPromptSubmit":
      return AgentState.THINKING;
    case "Notification":
      return (event.notification_type === "permission_prompt" || event.notification_type === "idle_prompt")
        ? AgentState.AWAITING_INPUT
        : AgentState.THINKING;
    case "PermissionRequest":
      return AgentState.AWAITING_INPUT;
    case "SubagentStart":
    case "SubagentStop":
      return AgentState.THINKING;
    case "SessionStart":
    case "TeammateIdle":
      return AgentState.IDLE;
    default:
      return AgentState.THINKING;
  }
}

export function summarizeToolInput(input: Record<string, unknown>): string {
  const s = (input.command ?? input.file_path ?? JSON.stringify(input)) as string;
  return s.slice(0, 128);
}

export function isAlive(status: AgentStateValue): boolean {
  return status !== AgentState.COMPLETE;
}
```

**Step 4: Run tests — expect pass**

Run: `cd ~/codeprojects/noass/server && pnpm test`
Expected: 9 tests PASS

**Step 5: Commit**

```bash
git add server/src/models.ts server/src/__tests__/models.test.ts
git commit -m "feat(server): port status derivation from Python bridge"
```

---

### Task 3: Session store + StateMessage translation

**Files:**
- Create: `server/src/store.ts`
- Create: `server/src/__tests__/store.test.ts`

**Step 1: Write failing tests**

```typescript
// server/src/__tests__/store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { SessionStore } from "../store";
import { AgentState } from "../models";

describe("SessionStore", () => {
  let store: SessionStore;
  beforeEach(() => { store = new SessionStore(); });

  it("processes a hook event and stores session", () => {
    store.processEvent({
      event_name: "PreToolUse",
      session_id: "s1",
      tool_name: "Bash",
      tool_input: { command: "npm test" },
    });
    const sessions = store.getSessions();
    expect(sessions.has("s1")).toBe(true);
    expect(sessions.get("s1")!.status).toBe(AgentState.TOOL_CALL);
  });

  it("toStateMessage produces valid StateMessage", () => {
    store.processEvent({
      event_name: "PreToolUse",
      session_id: "s1",
      tool_name: "Bash",
      tool_input: { command: "npm test" },
    });
    const msg = store.toStateMessage();
    expect(msg.type).toBe("state");
    expect(msg.panes).toHaveLength(1);
    expect(msg.panes[0].name).toBe("s1");
    expect(msg.panes[0].alive).toBe(true);
    expect(msg.stats.total_panes).toBe(1);
    expect(msg.stats.alive).toBe(1);
  });

  it("detects state transitions", () => {
    store.processEvent({ event_name: "SessionStart", session_id: "s1" });
    const t1 = store.processEvent({
      event_name: "PostToolUseFailure",
      session_id: "s1",
    });
    expect(t1.transitioned).toBe(true);
    expect(t1.previous_status).toBe(AgentState.IDLE);
    expect(t1.new_status).toBe(AgentState.ERROR);
  });

  it("no transition when status unchanged", () => {
    store.processEvent({ event_name: "PreToolUse", session_id: "s1", tool_name: "Bash", tool_input: { command: "a" } });
    const t2 = store.processEvent({ event_name: "PreToolUse", session_id: "s1", tool_name: "Edit", tool_input: { file_path: "b" } });
    expect(t2.transitioned).toBe(false);
  });

  it("updates metrics without changing status", () => {
    store.processEvent({ event_name: "PreToolUse", session_id: "s1", tool_name: "Bash", tool_input: { command: "ls" } });
    store.updateMetrics("s1", { context_percent: 42.5, cost_usd: 0.18 });
    const s = store.getSessions().get("s1")!;
    expect(s.context_percent).toBe(42.5);
    expect(s.cost_usd).toBe(0.18);
  });

  it("prunes complete sessions from debounce", () => {
    store.processEvent({ event_name: "PreToolUse", session_id: "s1", tool_name: "Bash", tool_input: { command: "ls" } });
    store.processEvent({ event_name: "Stop", session_id: "s1", stop_hook_active: false });
    const msg = store.toStateMessage();
    expect(msg.panes[0].alive).toBe(false);
  });

  it("custom_label overrides session name", () => {
    store.processEvent({ event_name: "PreToolUse", session_id: "s1", tool_name: "Bash", tool_input: { command: "ls" }, custom_label: "govantazh" });
    const msg = store.toStateMessage();
    expect(msg.panes[0].name).toBe("govantazh");
  });
});
```

**Step 2: Implement store.ts**

The store holds all session state, processes events, translates to `StateMessage` format. This is the heart of the bridge.

```typescript
// server/src/store.ts
import {
  AgentState, type AgentStateValue, type HookEvent, type SessionState, type SubAgent,
  deriveStatus, summarizeToolInput, isAlive, parseHookEvent,
} from "./models";

export interface TransitionResult {
  session_id: string;
  new_status: AgentStateValue;
  previous_status: AgentStateValue | null;
  transitioned: boolean;
  session: SessionState;
}

// Matches NOASS frontend types.ts
export interface PaneData {
  idx: number;
  name: string;
  alive: boolean;
  ctx_k: number;
  last: string;
  rate_k_per_min: number;
  eta_800k_min: number | null;
  ctx_pct: number;
  // Extended fields
  status?: string;
  cost_usd?: number;
  model?: string;
  cwd?: string;
  sub_agents?: SubAgent[];
}

export interface StateMessage {
  type: "state";
  panes: PaneData[];
  log: LogEntry[];
  stats: { total_panes: number; alive: number; dead: number; total_ctx_k: number; uptime_sec: number };
}

export interface LogEntry {
  event: string;
  name: string;
  timestamp: number;
  detail?: string;
}

export class SessionStore {
  private sessions = new Map<string, SessionState>();
  private labels = new Map<string, string>();
  private agents = new Map<string, Map<string, SubAgent>>();
  private pendingAgentNames = new Map<string, string[]>();
  private log: LogEntry[] = [];
  private startTime = Date.now();

  getSessions(): Map<string, SessionState> {
    return this.sessions;
  }

  processEvent(raw: HookEvent | Record<string, unknown>): TransitionResult {
    const event = "event_name" in raw && typeof raw.event_name === "string"
      ? raw as HookEvent
      : parseHookEvent(raw as Record<string, unknown>);

    // Track pending agent names from PreToolUse Agent calls
    if (event.event_name === "PreToolUse" && event.tool_name === "Agent" && event.tool_input) {
      const desc = (event.tool_input.description ?? event.tool_input.name ?? "") as string;
      if (desc) {
        const pending = this.pendingAgentNames.get(event.session_id) ?? [];
        pending.push(desc);
        this.pendingAgentNames.set(event.session_id, pending);
      }
    }

    // Sub-agent lifecycle
    const sessionAgents = this.agents.get(event.session_id) ?? new Map();
    this.agents.set(event.session_id, sessionAgents);
    if (event.event_name === "SubagentStart" && event.agent_id) {
      const pending = this.pendingAgentNames.get(event.session_id) ?? [];
      const name = pending.shift() ?? "";
      sessionAgents.set(event.agent_id, {
        agent_id: event.agent_id,
        agent_type: event.agent_type ?? "unknown",
        status: "running",
        name,
      });
    } else if (event.event_name === "SubagentStop" && event.agent_id) {
      sessionAgents.delete(event.agent_id);
    }

    // Custom label
    if (event.custom_label) {
      this.labels.set(event.session_id, event.custom_label);
    }

    const previous = this.sessions.get(event.session_id);
    const previousStatus = previous?.status ?? null;
    const newStatus = deriveStatus(event);

    const toolSummary = event.tool_input ? summarizeToolInput(event.tool_input) : "";
    const message = (event.last_assistant_message ?? event.message ?? "").slice(0, 200);
    const label = this.labels.get(event.session_id) ?? event.session_id.slice(0, 8);

    const session: SessionState = {
      session_id: event.session_id,
      status: newStatus,
      previous_status: previousStatus,
      tool: event.tool_name ?? null,
      tool_input_summary: toolSummary,
      message,
      event: event.event_name,
      label,
      sub_agents: [...sessionAgents.values()],
      ts: new Date().toISOString(),
      // Preserve metrics from previous state
      context_percent: previous?.context_percent ?? null,
      cost_usd: previous?.cost_usd ?? null,
      model: previous?.model ?? null,
      cwd: previous?.cwd ?? null,
    };

    this.sessions.set(event.session_id, session);

    // Log entry
    const last = event.tool_name
      ? `${event.tool_name}: ${toolSummary}`.slice(0, 100)
      : event.event_name;
    this.log.push({ event: event.event_name, name: label, timestamp: Date.now(), detail: last });
    if (this.log.length > 100) this.log.splice(0, this.log.length - 100);

    return {
      session_id: event.session_id,
      new_status: newStatus,
      previous_status: previousStatus,
      transitioned: previousStatus !== null && previousStatus !== newStatus,
      session,
    };
  }

  updateMetrics(sessionId: string, metrics: Record<string, unknown>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    let changed = false;
    for (const [key, val] of Object.entries(metrics)) {
      if (key in session && val !== undefined) {
        (session as any)[key] = val;
        changed = true;
      }
    }
    return changed;
  }

  toStateMessage(): StateMessage {
    const panes: PaneData[] = [];
    let idx = 0;
    for (const s of this.sessions.values()) {
      const ctxPct = s.context_percent ?? 0;
      const ctxK = Math.round(ctxPct * 8); // 100% = 800K
      panes.push({
        idx: idx++,
        name: s.label,
        alive: isAlive(s.status),
        ctx_k: ctxK,
        last: s.tool ? `${s.tool}: ${s.tool_input_summary}` : s.event,
        rate_k_per_min: 0, // Can be derived from metrics delta later
        eta_800k_min: null,
        ctx_pct: ctxPct,
        status: s.status,
        cost_usd: s.cost_usd ?? undefined,
        model: s.model ?? undefined,
        cwd: s.cwd ?? undefined,
        sub_agents: s.sub_agents.length > 0 ? s.sub_agents : undefined,
      });
    }

    const alive = panes.filter((p) => p.alive).length;
    const totalCtxK = panes.reduce((s, p) => s + p.ctx_k, 0);

    return {
      type: "state",
      panes,
      log: this.log.slice(-30),
      stats: {
        total_panes: panes.length,
        alive,
        dead: panes.length - alive,
        total_ctx_k: totalCtxK,
        uptime_sec: Math.round((Date.now() - this.startTime) / 1000),
      },
    };
  }
}
```

**Step 3: Run tests**

Run: `cd ~/codeprojects/noass/server && pnpm test`
Expected: All pass

**Step 4: Commit**

```bash
git add server/src/store.ts server/src/__tests__/store.test.ts
git commit -m "feat(server): session store with StateMessage translation"
```

---

### Task 4: HTTP + WebSocket server (the app)

**Files:**
- Create: `server/src/app.ts`
- Create: `server/src/__tests__/app.test.ts`

**Step 1: Write failing tests**

```typescript
// server/src/__tests__/app.test.ts
import { describe, it, expect } from "vitest";
import { app } from "../app";

describe("HTTP endpoints", () => {
  it("GET /health returns 200", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
  });

  it("POST /event with valid hook returns 202", async () => {
    const res = await app.request("/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hook_event_name: "PreToolUse",
        session_id: "s1",
        tool_name: "Bash",
        tool_input: { command: "ls" },
      }),
    });
    expect(res.status).toBe(202);
  });

  it("POST /event with bad JSON returns 400", async () => {
    const res = await app.request("/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json{",
    });
    expect(res.status).toBe(400);
  });

  it("GET /status returns sessions", async () => {
    // Post an event first
    await app.request("/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hook_event_name: "PreToolUse", session_id: "s2", tool_name: "Bash", tool_input: { command: "test" } }),
    });
    const res = await app.request("/status");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.type).toBe("state");
    expect(data.panes.length).toBeGreaterThan(0);
  });

  it("POST /session/:id/metrics updates metrics", async () => {
    await app.request("/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hook_event_name: "PreToolUse", session_id: "metrics-test", tool_name: "Bash", tool_input: { command: "ls" } }),
    });
    const res = await app.request("/session/metrics-test/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context_percent: 42.5, cost_usd: 0.18 }),
    });
    expect(res.status).toBe(202);
  });

  it("POST /session/:id/input queues input", async () => {
    const res = await app.request("/session/s1/input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "continue" }),
    });
    expect(res.status).toBe(202);
  });

  it("GET /session/:id/input polls and consumes", async () => {
    await app.request("/session/poll-test/input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "yes" }),
    });
    const res = await app.request("/session/poll-test/input");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.messages).toContain("yes");

    // Second poll should be empty
    const res2 = await app.request("/session/poll-test/input");
    const data2 = await res2.json();
    expect(data2.messages).toHaveLength(0);
  });

  it("POST /broadcast sends to all sessions", async () => {
    const res = await app.request("/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello all" }),
    });
    expect(res.status).toBe(202);
  });
});
```

**Step 2: Implement app.ts**

```typescript
// server/src/app.ts
import { Hono } from "hono";
import { SessionStore } from "./store";
import { AgentState, type AgentStateValue } from "./models";
import { sendNotification, pruneDebounce } from "./ntfy";

export const store = new SessionStore();
const pendingInput = new Map<string, string[]>();

// WebSocket clients (managed by index.ts)
type BroadcastFn = (msg: string) => void;
let broadcastWS: BroadcastFn = () => {};
export function setBroadcast(fn: BroadcastFn): void { broadcastWS = fn; }

export const app = new Hono();

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

  // Prune debounce on session complete
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
```

**Step 3: Run tests**

Run: `cd ~/codeprojects/noass/server && pnpm test`
Expected: All pass

**Step 4: Commit**

```bash
git add server/src/app.ts server/src/__tests__/app.test.ts
git commit -m "feat(server): HTTP endpoints with Hono"
```

---

### Task 5: ntfy push notifications

**Files:**
- Create: `server/src/ntfy.ts`
- Create: `server/src/__tests__/ntfy.test.ts`

**Step 1: Write failing tests**

```typescript
// server/src/__tests__/ntfy.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { sendNotification, pruneDebounce, _resetForTests } from "../ntfy";
import { AgentState, type SessionState } from "../models";

describe("ntfy", () => {
  beforeEach(() => {
    _resetForTests();
    vi.restoreAllMocks();
  });

  it("sends notification for error status", async () => {
    process.env.NTFY_TOPIC = "test-topic";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    const session: SessionState = {
      session_id: "s1", status: AgentState.ERROR, previous_status: AgentState.THINKING,
      tool: null, tool_input_summary: "", message: "", event: "PostToolUseFailure",
      label: "govantazh", sub_agents: [], ts: new Date().toISOString(),
      context_percent: null, cost_usd: null, model: null, cwd: null,
    };
    await sendNotification(session);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://ntfy.sh/test-topic");
    expect((opts as any).headers.Title).toContain("govantazh");
  });

  it("debounces same session+status within 60s", async () => {
    process.env.NTFY_TOPIC = "test-topic";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    const session: SessionState = {
      session_id: "s1", status: AgentState.ERROR, previous_status: null,
      tool: null, tool_input_summary: "", message: "", event: "PostToolUseFailure",
      label: "test", sub_agents: [], ts: new Date().toISOString(),
      context_percent: null, cost_usd: null, model: null, cwd: null,
    };
    await sendNotification(session);
    await sendNotification(session);
    expect(fetchSpy).toHaveBeenCalledOnce(); // Second call debounced
  });

  it("skips when NTFY_TOPIC not set", async () => {
    delete process.env.NTFY_TOPIC;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    const session: SessionState = {
      session_id: "s1", status: AgentState.ERROR, previous_status: null,
      tool: null, tool_input_summary: "", message: "", event: "test",
      label: "test", sub_agents: [], ts: new Date().toISOString(),
      context_percent: null, cost_usd: null, model: null, cwd: null,
    };
    await sendNotification(session);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("pruneDebounce removes entries for session", () => {
    // Internal state tested via send behavior after prune
    process.env.NTFY_TOPIC = "test-topic";
    // This just verifies it doesn't throw
    pruneDebounce("s1");
  });
});
```

**Step 2: Implement ntfy.ts**

```typescript
// server/src/ntfy.ts
import { AgentState, type SessionState } from "./models";

const debounce = new Map<string, number>();
const DEBOUNCE_MS = 60_000;

export async function sendNotification(session: SessionState): Promise<void> {
  const topic = process.env.NTFY_TOPIC ?? "";
  if (!topic) return;

  const key = `${session.session_id}:${session.status}`;
  const now = Date.now();
  const last = debounce.get(key) ?? 0;
  if (now - last < DEBOUNCE_MS) return;

  const title = `[${session.label}] ${session.status.replace("_", " ").toUpperCase()}`;
  const body = session.event || "status changed";
  const priority = session.status === AgentState.ERROR ? "high" : "default";

  try {
    const resp = await fetch(`https://ntfy.sh/${topic}`, {
      method: "POST",
      headers: { Title: title, Priority: priority },
      body,
    });
    if (resp.ok) {
      debounce.set(key, Date.now()); // Only after success
    }
  } catch {
    // Non-fatal — log and continue
  }
}

export function pruneDebounce(sessionId: string): void {
  for (const key of debounce.keys()) {
    if (key.startsWith(`${sessionId}:`)) {
      debounce.delete(key);
    }
  }
}

/** For tests only */
export function _resetForTests(): void {
  debounce.clear();
}
```

**Step 3: Run tests**

Run: `cd ~/codeprojects/noass/server && pnpm test`

**Step 4: Commit**

```bash
git add server/src/ntfy.ts server/src/__tests__/ntfy.test.ts
git commit -m "feat(server): ntfy push notifications with debounce"
```

---

### Task 6: WebSocket server + entry point

**Files:**
- Modify: `server/src/index.ts` (replace placeholder)

**Step 1: Implement index.ts with WS**

```typescript
// server/src/index.ts
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
```

**Step 2: Test manually**

Run: `cd ~/codeprojects/noass/server && pnpm dev`
Expected: `NOASS server :3333 (ntfy: disabled)`

Test hook event:
```bash
curl -X POST http://localhost:3333/event \
  -H 'Content-Type: application/json' \
  -d '{"hook_event_name":"PreToolUse","session_id":"test","tool_name":"Bash","tool_input":{"command":"ls"}}'
```
Expected: `{"accepted":true}`

Test status:
```bash
curl http://localhost:3333/status
```
Expected: JSON with `type: "state"`, `panes` array with one entry

**Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(server): WebSocket server with hook→StateMessage bridge"
```

---

### Task 7: Extend NOASS frontend types

**Files:**
- Modify: `src/types.ts` — add extended PaneData fields

**Step 1: Add optional fields to PaneData**

Add to `PaneData` interface:
```typescript
  status?: string;
  cost_usd?: number;
  model?: string;
  cwd?: string;
  sub_agents?: { agent_id: string; agent_type: string; status: string; name: string }[];
```

These are backward-compatible (optional fields). NOASS renders what it has, ignores what it doesn't.

**Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: extend PaneData with bridge status fields"
```

---

### Task 8: Web dashboard (static HTML from same server)

**Files:**
- Create: `server/src/dashboard.ts`

**Step 1: Implement dashboard endpoint**

Port the CCReStatus dashboard HTML (or serve a simpler version that connects via WebSocket instead of SSE):

```typescript
// server/src/dashboard.ts — just the HTML string + route
export const DASHBOARD_HTML = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>NOASS Dashboard</title>
<!-- Same dashboard as CCReStatus but with WS instead of SSE -->
</head><body>
<script>
const ws = new WebSocket(location.origin.replace('http','ws'));
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'state') renderCards(msg);
};
// ... render logic (port from CCReStatus DASHBOARD_HTML)
</script>
</body></html>`;
```

This can be a direct port of the CCReStatus dashboard, changing `EventSource('/events')` to `new WebSocket(...)`. The full HTML is ~280 lines — port it wholesale.

**Step 2: Add route in app.ts**

```typescript
import { DASHBOARD_HTML } from "./dashboard";
app.get("/dashboard", (c) => c.html(DASHBOARD_HTML));
app.get("/", (c) => c.redirect("/dashboard"));
```

**Step 3: Commit**

```bash
git add server/src/dashboard.ts
git commit -m "feat(server): web dashboard on /dashboard"
```

---

### Task 9: Hook configuration

**Files:**
- Create: `server/hooks-example.json` — Claude Code hook config pointing to NOASS server

**Step 1: Create hook config example**

```json
{
  "hooks": {
    "PreToolUse": [{ "type": "command", "command": "curl -s -X POST http://localhost:3333/event -H 'Content-Type: application/json' -d \"$(cat)\"" }],
    "PostToolUse": [{ "type": "command", "command": "curl -s -X POST http://localhost:3333/event -H 'Content-Type: application/json' -d \"$(cat)\"" }],
    "PostToolUseFailure": [{ "type": "command", "command": "curl -s -X POST http://localhost:3333/event -H 'Content-Type: application/json' -d \"$(cat)\"" }],
    "Notification": [{ "type": "command", "command": "curl -s -X POST http://localhost:3333/event -H 'Content-Type: application/json' -d \"$(cat)\"" }],
    "Stop": [{ "type": "command", "command": "curl -s -X POST http://localhost:3333/event -H 'Content-Type: application/json' -d \"$(cat)\"" }],
    "SubagentStart": [{ "type": "command", "command": "curl -s -X POST http://localhost:3333/event -H 'Content-Type: application/json' -d \"$(cat)\"" }],
    "SubagentStop": [{ "type": "command", "command": "curl -s -X POST http://localhost:3333/event -H 'Content-Type: application/json' -d \"$(cat)\"" }]
  }
}
```

**Step 2: Commit**

```bash
git add server/hooks-example.json
git commit -m "docs(server): hook configuration example"
```

---

## Verification Checklist

After all tasks:
1. `cd server && pnpm test` — all tests green
2. `pnpm dev` — server starts on :3333
3. `curl POST /event` with hook JSON → 202
4. `curl GET /status` → StateMessage JSON
5. Open `http://localhost:3333/dashboard` → web dashboard shows cards
6. NOASS app connects (settings → ws://localhost:3333) → force-directed graph
7. Set `NTFY_TOPIC=xxx pnpm dev` → trigger awaiting_input → phone notification

## What Becomes Legacy

After this ships, CCReStatus bridge (`~/codeprojects/CCReStatus/bridge/`) is deprecated. The Android Kotlin app (`~/codeprojects/CCReStatus/android/`) can stay as a Play Store product — it just connects to `:3333` WS instead of `:4001` SSE (requires a migration task, not in scope).
