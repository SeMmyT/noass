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
      debounce.set(key, Date.now());
    }
  } catch {
    // Non-fatal
  }
}

export function pruneDebounce(sessionId: string): void {
  for (const key of debounce.keys()) {
    if (key.startsWith(`${sessionId}:`)) {
      debounce.delete(key);
    }
  }
}

export function _resetForTests(): void {
  debounce.clear();
}
