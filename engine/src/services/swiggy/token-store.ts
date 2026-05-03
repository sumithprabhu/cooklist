/**
 * Per-user Swiggy access token storage.
 * Tokens are valid for 5 days (per Swiggy docs). No refresh tokens in v1.
 * Swap Map → Redis when scaling to multiple server instances.
 */

interface TokenEntry {
  access_token: string;
  expires_at: number; // ms epoch
}

const store = new Map<string, TokenEntry>();

const TOKEN_TTL_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export function saveToken(userId: string, accessToken: string): void {
  store.set(userId, { access_token: accessToken, expires_at: Date.now() + TOKEN_TTL_MS });
}

export function getToken(userId: string): string | null {
  const entry = store.get(userId);
  if (!entry || entry.expires_at < Date.now()) {
    store.delete(userId);
    return null;
  }
  return entry.access_token;
}

export function deleteToken(userId: string): void {
  store.delete(userId);
}
