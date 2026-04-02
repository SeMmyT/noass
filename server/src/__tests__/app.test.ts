import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../app";
import { _resetForTests, generateMagicToken, verifyMagicToken, createSession } from "../auth";

// Helper: create a valid session cookie for authenticated requests
function authCookie(): string {
  const sid = createSession();
  return `noass_session=${sid}`;
}

beforeEach(() => {
  _resetForTests();
});

describe("Auth flow", () => {
  it("GET /auth/login returns login page", async () => {
    const res = await app.request("/auth/login");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("NOASS");
    expect(html).toContain("email");
  });

  it("POST /auth/login with invalid email still returns 200 (no enumeration)", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "hacker@evil.com" }),
    });
    expect(res.status).toBe(200);
  });

  it("POST /auth/login with valid email returns 200", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "semmytrane@gmail.com" }),
    });
    expect(res.status).toBe(200);
  });

  it("GET /auth/verify with valid token sets cookie and redirects", async () => {
    const token = generateMagicToken("semmytrane@gmail.com")!;
    const res = await app.request(`/auth/verify?token=${token}`);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/dashboard");
    expect(res.headers.get("set-cookie")).toContain("noass_session=");
  });

  it("GET /auth/verify with invalid token returns 401", async () => {
    const res = await app.request("/auth/verify?token=bogus");
    expect(res.status).toBe(401);
  });

  it("GET /auth/verify with expired token returns 401", async () => {
    const token = generateMagicToken("semmytrane@gmail.com")!;
    // Consume it
    verifyMagicToken(token);
    // Second use fails
    const res = await app.request(`/auth/verify?token=${token}`);
    expect(res.status).toBe(401);
  });

  it("GET /dashboard without auth redirects to login", async () => {
    const res = await app.request("/dashboard");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/auth/login");
  });

  it("GET /dashboard with valid cookie returns 200", async () => {
    const res = await app.request("/dashboard", {
      headers: { Cookie: authCookie() },
    });
    expect(res.status).toBe(200);
  });
});

describe("HTTP endpoints (authenticated)", () => {
  it("GET /health returns 200 (no auth needed)", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
  });

  it("POST /event with valid hook returns 202 (no webhook key = open)", async () => {
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

  it("GET /status requires auth", async () => {
    const res = await app.request("/status", {
      headers: { Accept: "application/json" },
    });
    expect(res.status).toBe(401);
  });

  it("GET /status with auth returns sessions", async () => {
    await app.request("/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hook_event_name: "PreToolUse", session_id: "s2", tool_name: "Bash", tool_input: { command: "test" } }),
    });
    const res = await app.request("/status", {
      headers: { Cookie: authCookie() },
    });
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

  it("POST /session/:id/input requires auth", async () => {
    const res = await app.request("/session/s1/input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "continue" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /session/:id/input with auth queues input", async () => {
    const res = await app.request("/session/s1/input", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: authCookie() },
      body: JSON.stringify({ text: "continue" }),
    });
    expect(res.status).toBe(202);
  });

  it("GET /session/:id/input polls and consumes (with auth)", async () => {
    const cookie = authCookie();
    await app.request("/session/poll-test/input", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ text: "yes" }),
    });
    const res = await app.request("/session/poll-test/input", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.messages).toContain("yes");

    const res2 = await app.request("/session/poll-test/input", {
      headers: { Cookie: cookie },
    });
    const data2 = await res2.json();
    expect(data2.messages).toHaveLength(0);
  });

  it("POST /broadcast requires auth", async () => {
    const res = await app.request("/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello all" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /broadcast with auth sends to all sessions", async () => {
    const res = await app.request("/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: authCookie() },
      body: JSON.stringify({ text: "hello all" }),
    });
    expect(res.status).toBe(202);
  });
});
