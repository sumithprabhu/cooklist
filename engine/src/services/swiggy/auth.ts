/**
 * OAuth 2.1 + PKCE flow for Swiggy.
 * Docs: https://mcp.swiggy.com/builders/docs/start/authenticate/
 *
 * Flow:
 *  1. generateAuthUrl()  → redirect user to this URL
 *  2. User logs in on Swiggy, gets redirected to GET /auth/callback?code=...&state=...
 *  3. exchangeCode()     → swaps code + verifier for access token
 *  4. saveToken()        → stored per userId, valid 5 days
 */

import crypto from "crypto";
import { saveToken } from "./token-store.js";

const BASE = "https://mcp.swiggy.com";
const CLIENT_ID = process.env.SWIGGY_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.SWIGGY_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.SWIGGY_REDIRECT_URI ?? "http://localhost:3000/auth/callback";

interface PendingAuth {
  verifier: string;
  userId: string;
  sessionId: string;
}

// Keyed by `state` param — matches callback to the initiating user
const pending = new Map<string, PendingAuth>();

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function generateAuthUrl(userId: string, sessionId: string): string {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  const state = base64url(crypto.randomBytes(16));

  pending.set(state, { verifier, userId, sessionId });

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  return `${BASE}/auth/authorize?${params}`;
}

export async function exchangeCode(
  code: string,
  state: string
): Promise<{ userId: string; sessionId: string } | null> {
  const entry = pending.get(state);
  if (!entry) return null;
  pending.delete(state);

  const res = await fetch(`${BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: entry.verifier,
    }),
  });

  if (!res.ok) {
    console.error("[auth] token exchange failed:", res.status, await res.text());
    return null;
  }

  const data = await res.json() as { access_token: string };
  saveToken(entry.userId, data.access_token);
  return { userId: entry.userId, sessionId: entry.sessionId };
}
