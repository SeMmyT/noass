import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { SessionStore } from "../store";
import { saveToDisk, loadFromDisk, hydrateStore } from "../persistence";

describe("persistence", () => {
  let dir: string;
  let cachePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "noass-test-"));
    cachePath = join(dir, "cache.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("saves and loads round-trip", async () => {
    const store = new SessionStore();
    store.processEvent({ event_name: "UserPromptSubmit", session_id: "s1", message: "hello" });
    store.processEvent({ event_name: "PreToolUse", session_id: "s1", tool_name: "Bash", tool_input: { command: "ls" } });

    await saveToDisk(store, cachePath);

    const cache = await loadFromDisk(cachePath);
    expect(cache).not.toBeNull();
    expect(cache!.version).toBe(1);
    expect(Object.keys(cache!.sessions)).toContain("s1");
    expect(cache!.conversations["s1"]).toHaveLength(1);
    expect(cache!.conversations["s1"][0].role).toBe("user");
  });

  it("hydrate restores into new store", async () => {
    const store1 = new SessionStore();
    store1.processEvent({ event_name: "UserPromptSubmit", session_id: "s1", message: "test" });
    store1.processEvent({ event_name: "Stop", session_id: "s1", last_assistant_message: "done" });
    store1.updateMetrics("s1", { context_percent: 42, cost_usd: 1.5 });
    await saveToDisk(store1, cachePath);

    const store2 = new SessionStore();
    const cache = await loadFromDisk(cachePath);
    const count = hydrateStore(store2, cache!);

    expect(count).toBe(1);
    const msg = store2.toStateMessage();
    expect(msg.panes).toHaveLength(1);
    expect(msg.panes[0].ctx_pct).toBe(42);
    expect(msg.panes[0].cost_usd).toBe(1.5);
    expect(msg.panes[0].conversation).toHaveLength(2);
  });

  it("loadFromDisk returns null for missing file", async () => {
    const result = await loadFromDisk(join(dir, "nonexistent.json"));
    expect(result).toBeNull();
  });

  it("loadFromDisk returns null for corrupt JSON", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(cachePath, "not json{{{", "utf-8");
    const result = await loadFromDisk(cachePath);
    expect(result).toBeNull();
  });

  it("atomic write: no .tmp file remains", async () => {
    const store = new SessionStore();
    store.processEvent({ event_name: "SessionStart", session_id: "s1" });
    await saveToDisk(store, cachePath);

    try {
      await stat(cachePath + ".tmp");
      expect.fail(".tmp file should not exist");
    } catch (e: any) {
      expect(e.code).toBe("ENOENT");
    }
  });
});
