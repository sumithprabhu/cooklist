import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../services/ai.js", () => ({
  parseRecipe: vi.fn().mockResolvedValue(null),
}));

import { createApp } from "../app.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeEach(async () => {
  app = await createApp();
});

afterEach(async () => {
  await app.close();
});

function post(payload: unknown) {
  return app.inject({ method: "POST", url: "/message", payload });
}

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe("GET /recipes", () => {
  it("returns list with at least 10 recipes", async () => {
    const res = await app.inject({ method: "GET", url: "/recipes" });
    expect(res.statusCode).toBe(200);
    const { recipes } = res.json();
    expect(recipes.length).toBeGreaterThanOrEqual(10);
    expect(recipes[0]).toHaveProperty("key");
    expect(recipes[0]).toHaveProperty("display_name");
  });
});

describe("POST /message — validation", () => {
  it("returns 400 when both text and action_id are missing", async () => {
    const res = await post({ session_id: "s1", platform: "telegram", user_id: "u1" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.formErrors).toContain("Provide either text or action_id");
  });

  it("returns 400 for unknown platform", async () => {
    const res = await post({ session_id: "s1", platform: "fax", user_id: "u1", text: "hi" });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when session_id is empty", async () => {
    const res = await post({ session_id: "", platform: "telegram", user_id: "u1", text: "hi" });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /message — conversation", () => {
  it("returns ingredients for a known recipe", async () => {
    const res = await post({ session_id: "s1", platform: "telegram", user_id: "u1", text: "Poha" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.state.step).toBe("recipe_shown");
    expect(body.state.recipe_key).toBe("poha");
    expect(body.text).toContain("Poha");
    expect(body.action_rows).toBeInstanceOf(Array);
  });

  it("session state persists across multiple requests with same session_id", async () => {
    // First request: show recipe at 2 servings
    await post({ session_id: "persist-test", platform: "telegram", user_id: "u1", text: "Upma" });

    // Second request: change servings — state from first request is used
    const res = await post({
      session_id: "persist-test",
      platform: "telegram",
      user_id: "u1",
      action_id: "set_servings|upma|4",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().state.step).toBe("recipe_shown");
    expect(res.json().state.servings).toBe(4);
  });

  it("different session_ids have independent state", async () => {
    await post({ session_id: "user-a", platform: "telegram", user_id: "ua", text: "Poha" });
    const res = await post({ session_id: "user-b", platform: "telegram", user_id: "ub", text: "Rajma" });

    expect(res.json().state.recipe_key).toBe("rajma");
  });

  it("browse action returns recipe list", async () => {
    const res = await post({ session_id: "s2", platform: "telegram", user_id: "u1", action_id: "browse" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.state.step).toBe("idle");
    expect(body.action_rows.length).toBeGreaterThanOrEqual(10);
  });
});
