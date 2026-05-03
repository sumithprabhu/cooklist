/**
 * OAuth callback — Swiggy redirects here after user authenticates.
 * GET /auth/callback?code=...&state=...
 */

import type { FastifyInstance } from "fastify";
import { exchangeCode } from "../services/swiggy/auth.js";

export default async function authRoute(fastify: FastifyInstance) {
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
          <head><title>Swiggy Login</title></head>
          <body style="font-family:sans-serif;text-align:center;padding:60px">
            <h2>You're logged in!</h2>
            <p>Go back to your chat and continue ordering.</p>
          </body>
        </html>
      `);
    }
  );
}
