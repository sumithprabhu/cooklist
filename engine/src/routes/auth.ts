/**
 * OAuth callback — Swiggy redirects here after user authenticates.
 * GET /auth/callback?code=...&state=...
 */

import type { FastifyInstance } from "fastify";
import { exchangeCode, generateAuthUrl } from "../services/swiggy/auth.js";
import { getToken } from "../services/swiggy/token-store.js";

export default async function authRoute(fastify: FastifyInstance) {
  // Open this in a browser to start the Swiggy login flow
  fastify.get<{ Querystring: { user_id?: string } }>(
    "/auth/login",
    async (request, reply) => {
      const userId = request.query.user_id ?? "local-test-user";
      const sessionId = "local-test-session";
      const authUrl = generateAuthUrl(userId, sessionId);
      return reply.redirect(authUrl);
    }
  );

  // Check if a user is authenticated
  fastify.get<{ Querystring: { user_id?: string } }>(
    "/auth/status",
    async (request, reply) => {
      const userId = request.query.user_id ?? "local-test-user";
      const token = getToken(userId);
      return reply.send({ authenticated: !!token, user_id: userId });
    }
  );

  fastify.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/auth/callback",
    async (request, reply) => {
      const { code, state, error } = request.query;

      if (error || !code || !state) {
        return reply.status(400).send({ error: error ?? "Missing code or state" });
      }

      const result = await exchangeCode(code, state);
      if (!result) {
        return reply.status(400).send({ error: "Invalid or expired state — restart the login flow" });
      }

      // In production, redirect back into the chat app (Telegram deep link, etc.)
      // For now, return a success page the user can close.
      return reply.type("text/html").send(`
        <!DOCTYPE html>
        <html>
          <head><title>Swiggy Login — Cooklist</title></head>
          <body style="font-family:sans-serif;text-align:center;padding:60px;background:#f9f9f9">
            <h2 style="color:#e85d26">Logged in to Swiggy!</h2>
            <p>User: <code>${result.userId}</code></p>
            <p>You can now close this tab and test ordering via the API.</p>
            <hr style="margin:32px auto;width:300px"/>
            <p style="color:#888;font-size:14px">
              Test: <code>POST /message</code> with <code>action_id: "order|dal tadka|2"</code>
            </p>
          </body>
        </html>
      `);
    }
  );
}
