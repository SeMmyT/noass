import { writeFile, readFile, rename, unlink } from "node:fs/promises";
import type { SessionStore } from "./store";
import type { SessionState, ConversationEntry } from "./models";
import type { LogEntry } from "./store";

interface CacheFile {
  version: 1;
  saved_at: string;
  sessions: Record<string, SessionState>;
  log: LogEntry[];
  conversations: Record<string, ConversationEntry[]>;
}

export async function saveToDisk(store: SessionStore, filePath: string): Promise<void> {
  const data: CacheFile = {
    version: 1,
    saved_at: new Date().toISOString(),
    sessions: Object.fromEntries(store.getSessions()),
    log: store.getLog(),
    conversations: Object.fromEntries(store.getConversations()),
  };
  const tmp = filePath + ".tmp";
  await writeFile(tmp, JSON.stringify(data), "utf-8");
  await rename(tmp, filePath);
}

export async function loadFromDisk(filePath: string): Promise<CacheFile | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as CacheFile;
    if (data.version !== 1 || !data.sessions) return null;
    return data;
  } catch {
    return null;
  }
}

export function hydrateStore(store: SessionStore, cache: CacheFile): number {
  store.hydrate({
    sessions: cache.sessions,
    log: cache.log ?? [],
    conversations: cache.conversations ?? {},
  });
  return Object.keys(cache.sessions).length;
}
