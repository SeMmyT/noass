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

export interface PaneData {
  idx: number;
  session_id: string;
  name: string;
  alive: boolean;
  ctx_k: number;
  last: string;
  rate_k_per_min: number;
  eta_800k_min: number | null;
  ctx_pct: number;
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
      const ctxK = Math.round(ctxPct * 8);
      panes.push({
        idx: idx++,
        session_id: s.session_id,
        name: s.label,
        alive: isAlive(s.status),
        ctx_k: ctxK,
        last: s.tool ? `${s.tool}: ${s.tool_input_summary}` : s.event,
        rate_k_per_min: 0,
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
