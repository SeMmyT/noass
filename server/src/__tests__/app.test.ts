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
