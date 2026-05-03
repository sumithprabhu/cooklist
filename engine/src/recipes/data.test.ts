import { describe, it, expect, beforeEach } from "vitest";
import { findRecipe, listRecipes, registerRecipe, RECIPES } from "./data.js";

describe("findRecipe", () => {
  it("finds an exact key", () => {
    const [key, recipe] = findRecipe("paneer butter masala");
    expect(key).toBe("paneer butter masala");
    expect(recipe?.display_name).toBe("Paneer Butter Masala");
  });

  it("is case-insensitive", () => {
    const [key] = findRecipe("DAL TADKA");
    expect(key).toBe("dal tadka");
  });

  it("resolves aliases", () => {
    const [key] = findRecipe("saag paneer");
    expect(key).toBe("palak paneer");

    const [key2] = findRecipe("chana masala");
    expect(key2).toBe("chole");

    const [key3] = findRecipe("paneer makhani");
    expect(key3).toBe("paneer butter masala");
  });

  it("does a partial match", () => {
    const [key] = findRecipe("biryani");
    expect(key).toBe("veg biryani");
  });

  it("returns null for unknown recipes", () => {
    const [key, recipe] = findRecipe("spaghetti carbonara xyz unknown");
    expect(key).toBeNull();
    expect(recipe).toBeNull();
  });
});

describe("registerRecipe", () => {
  it("adds a new recipe that findRecipe can then find", () => {
    const key = "test butter chicken";
    registerRecipe(key, {
      display_name: "Test Butter Chicken",
      servings_default: 2,
      ingredients: [{ name: "Chicken", qty: 200, unit: "g", category: "meat" }],
    });
    const [foundKey, recipe] = findRecipe(key);
    expect(foundKey).toBe(key);
    expect(recipe?.display_name).toBe("Test Butter Chicken");

    // Clean up so we don't leak into other tests
    delete (RECIPES as Record<string, unknown>)[key];
  });
});

describe("listRecipes", () => {
  it("returns all hardcoded recipes with key and display_name", () => {
    const list = listRecipes();
    expect(list.length).toBeGreaterThanOrEqual(10);
    expect(list[0]).toHaveProperty("key");
    expect(list[0]).toHaveProperty("display_name");
  });

  it("includes expected recipes", () => {
    const names = listRecipes().map((r) => r.key);
    expect(names).toContain("paneer butter masala");
    expect(names).toContain("dal tadka");
    expect(names).toContain("chole");
  });
});
