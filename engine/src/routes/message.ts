import type { FastifyInstance } from "fastify";
import { MessageInputSchema } from "../protocol.js";
import { getSession, saveSession } from "../session/store.js";
import { process } from "../conversation/engine.js";

export default async function messageRoute(fastify: FastifyInstance) {
  fastify.post("/message", async (request, reply) => {
    const parsed = MessageInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const input = parsed.data;
    const state = await getSession(input.session_id);
    const output = await process(state, input);
    await saveSession(input.session_id, output.state);

    return reply.send(output);
  });

  // Health check
  fastify.get("/health", async () => ({ ok: true }));

  // List available recipes (useful for adapters to build menus)
  fastify.get("/recipes", async () => {
    const { listRecipes } = await import("../recipes/data.js");
    return { recipes: listRecipes() };
  });
}
