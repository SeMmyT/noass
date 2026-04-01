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

  it("complete session is not alive", () => {
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

  it("tracks sub-agents", () => {
    store.processEvent({ event_name: "PreToolUse", session_id: "s1", tool_name: "Agent", tool_input: { description: "scout" } });
    store.processEvent({ event_name: "SubagentStart", session_id: "s1", agent_id: "a1", agent_type: "Explore" });
    const msg = store.toStateMessage();
    expect(msg.panes[0].sub_agents).toHaveLength(1);
    expect(msg.panes[0].sub_agents![0].name).toBe("scout");
  });

  it("removes sub-agent on stop", () => {
    store.processEvent({ event_name: "SubagentStart", session_id: "s1", agent_id: "a1", agent_type: "Explore" });
    store.processEvent({ event_name: "SubagentStop", session_id: "s1", agent_id: "a1", agent_type: "Explore" });
    const msg = store.toStateMessage();
    expect(msg.panes[0].sub_agents).toBeUndefined();
  });

  it("preserves metrics across events", () => {
    store.processEvent({ event_name: "PreToolUse", session_id: "s1", tool_name: "Bash", tool_input: { command: "ls" } });
    store.updateMetrics("s1", { context_percent: 50, cost_usd: 1.0 });
    store.processEvent({ event_name: "PostToolUse", session_id: "s1" });
    const s = store.getSessions().get("s1")!;
    expect(s.context_percent).toBe(50);
    expect(s.cost_usd).toBe(1.0);
  });

  it("log accumulates entries", () => {
    store.processEvent({ event_name: "SessionStart", session_id: "s1" });
    store.processEvent({ event_name: "PreToolUse", session_id: "s1", tool_name: "Bash", tool_input: { command: "ls" } });
    const msg = store.toStateMessage();
    expect(msg.log.length).toBe(2);
  });
});
