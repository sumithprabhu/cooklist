/**
 * Integration tests — these make real Groq API calls.
 * Requires GROQ_API_KEY in environment.
 * Run with: npm test (dotenv loads the key from .env)
 */

import { describe, it, expect } from "vitest";
import "dotenv/config";
import { parseRecipe } from "./ai.js";

describe("parseRecipe — real Groq calls", () => {
  it("returns structured ingredients for a well-known recipe", async () => {
    const result = await parseRecipe("Butter Chicken");

    expect(result).not.toBeNull();
    expect(result!.key).toBe("butter chicken");
    expect(result!.recipe.display_name).toBeTruthy();
    expect(result!.recipe.ingredients.length).toBeGreaterThan(3);

    // Every ingredient must have the required fields
    for (const ing of result!.recipe.ingredients) {
      expect(ing.name).toBeTruthy();
      expect(ing.qty).toBeGreaterThan(0);
      expect(["g", "ml", "nos", "tsp", "tbsp", "cloves"]).toContain(ing.unit);
      expect(ing.category).toBeTruthy();
    }
  }, 15000);

  it("returns structured ingredients for a South Indian recipe", async () => {
    const result = await parseRecipe("Masala Dosa");

    expect(result).not.toBeNull();
    expect(result!.recipe.ingredients.length).toBeGreaterThan(4);

    // Quantities should be for 1 serving — nothing absurdly large
    for (const ing of result!.recipe.ingredients) {
      if (ing.unit === "g") expect(ing.qty).toBeLessThan(500);
      if (ing.unit === "nos") expect(ing.qty).toBeLessThan(20);
    }
  }, 15000);

  it("returns null for nonsense input", async () => {
    const result = await parseRecipe("xyzzy florbgrob zap");
    expect(result).toBeNull();
  }, 15000);

  it("uses cache — second call for same recipe does not hit Groq again", async () => {
    // First call populates cache
    const first = await parseRecipe("Pav Bhaji");
    // Second call should return instantly from cache (same object shape)
    const start = Date.now();
    const second = await parseRecipe("Pav Bhaji");
    const elapsed = Date.now() - start;

    expect(first?.recipe.display_name).toBe(second?.recipe.display_name);
    expect(elapsed).toBeLessThan(50); // cache hit should be near-instant
  }, 15000);
});
