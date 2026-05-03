import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import messageRoute from "./routes/message.js";
import authRoute from "./routes/auth.js";

export async function createApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(cors);
  await app.register(messageRoute);
  await app.register(authRoute);
  return app;
}
