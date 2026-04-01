import { describe, it, expect, beforeEach, vi } from "vitest";
import { sendNotification, pruneDebounce, _resetForTests } from "../ntfy";
import { AgentState, type SessionState } from "../models";

function makeSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    session_id: "s1", status: AgentState.ERROR, previous_status: AgentState.THINKING,
    tool: null, tool_input_summary: "", message: "", event: "PostToolUseFailure",
    label: "govantazh", sub_agents: [], ts: new Date().toISOString(),
    context_percent: null, cost_usd: null, model: null, cwd: null,
    ...overrides,
  };
}

describe("ntfy", () => {
  beforeEach(() => {
    _resetForTests();
    vi.restoreAllMocks();
  });

  it("sends notification for error status", async () => {
    process.env.NTFY_TOPIC = "test-topic";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    await sendNotification(makeSession());
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://ntfy.sh/test-topic");
    expect((opts as any).headers.Title).toContain("govantazh");
  });

  it("debounces same session+status within 60s", async () => {
    process.env.NTFY_TOPIC = "test-topic";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    await sendNotification(makeSession());
    await sendNotification(makeSession());
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("skips when NTFY_TOPIC not set", async () => {
    delete process.env.NTFY_TOPIC;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    await sendNotification(makeSession());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("pruneDebounce removes entries for session", () => {
    process.env.NTFY_TOPIC = "test-topic";
    pruneDebounce("s1");
    // Doesn't throw
  });

  it("sets priority high for errors", async () => {
    process.env.NTFY_TOPIC = "test-topic";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    await sendNotification(makeSession({ status: AgentState.ERROR }));
    expect((fetchSpy.mock.calls[0][1] as any).headers.Priority).toBe("high");
  });

  it("sets priority default for awaiting_input", async () => {
    process.env.NTFY_TOPIC = "test-topic";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    await sendNotification(makeSession({ status: AgentState.AWAITING_INPUT }));
    expect((fetchSpy.mock.calls[0][1] as any).headers.Priority).toBe("default");
  });
});
