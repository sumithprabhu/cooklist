/**
 * Session store — in-memory for now.
 * Swap the implementation for Redis (ioredis + JSON.stringify/parse) when scaling.
 * Interface stays the same, so nothing else changes.
 */

import type { ConversationState } from "../protocol.js";
import { INITIAL_STATE } from "../protocol.js";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface Entry {
  state: ConversationState;
  expires_at: number;
}

const store = new Map<string, Entry>();

// Prune expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expires_at < now) store.delete(key);
  }
}, 10 * 60 * 1000);

export async function getSession(sessionId: string): Promise<ConversationState> {
  const entry = store.get(sessionId);
  if (!entry || entry.expires_at < Date.now()) return { ...INITIAL_STATE };
  return entry.state;
}

export async function saveSession(sessionId: string, state: ConversationState): Promise<void> {
  store.set(sessionId, { state, expires_at: Date.now() + SESSION_TTL_MS });
}
