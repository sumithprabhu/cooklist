import { describe, it, expect } from "vitest";
import { scaleIngredients, formatIngredientLine, formatIngredientsMessage } from "./scaler.js";
import type { Ingredient } from "./data.js";

const BASE: Ingredient[] = [
  { name: "Paneer", qty: 100, unit: "g", category: "dairy" },
  { name: "Tomatoes", qty: 1.5, unit: "nos", category: "vegetables" },
  { name: "Butter", qty: 25, unit: "g", category: "dairy" },
  { name: "Cream", qty: 50, unit: "ml", category: "dairy" },
  { name: "Garam Masala", qty: 0.25, unit: "tsp", category: "spices" },
];

describe("scaleIngredients", () => {
  it("scales quantities for 1 serving (identity)", () => {
    const scaled = scaleIngredients(BASE, 1);
    // 100g → stays 100g (rounds to nearest 25 since >50)
    expect(scaled.find((i) => i.name === "Paneer")?.qty).toBe(100);
  });

  it("doubles quantities for 2 servings", () => {
    const scaled = scaleIngredients(BASE, 2);
    expect(scaled.find((i) => i.name === "Paneer")?.qty).toBe(200);
    expect(scaled.find((i) => i.name === "Cream")?.qty).toBe(100);
    expect(scaled.find((i) => i.name === "Butter")?.qty).toBe(50);
  });

  it("rounds g/ml to nearest 25 for larger amounts", () => {
    const scaled = scaleIngredients(BASE, 3);
    // Paneer: 100*3=300 → 300 (already on 25 boundary)
    expect(scaled.find((i) => i.name === "Paneer")?.qty).toBe(300);
  });

  it("rounds g/ml to nearest 5 for small amounts (<=50)", () => {
    const small: Ingredient[] = [{ name: "Saffron", qty: 8, unit: "g", category: "spices" }];
    const scaled = scaleIngredients(small, 2);
    expect(scaled[0].qty % 5).toBe(0); // must be a multiple of 5
  });

  it("rounds nos to whole numbers", () => {
    const scaled = scaleIngredients(BASE, 3);
    // Tomatoes: 1.5 * 3 = 4.5 → rounds to 5
    expect(Number.isInteger(scaled.find((i) => i.name === "Tomatoes")?.qty)).toBe(true);
  });

  it("does not mutate original ingredients", () => {
    scaleIngredients(BASE, 4);
    expect(BASE.find((i) => i.name === "Paneer")?.qty).toBe(100);
  });
});

describe("formatIngredientLine", () => {
  it("formats grams without space", () => {
    const result = formatIngredientLine({ name: "Paneer", qty: 200, unit: "g", category: "dairy" });
    expect(result).toBe("• Paneer — 200g");
  });

  it("formats ml without space", () => {
    const result = formatIngredientLine({ name: "Cream", qty: 100, unit: "ml", category: "dairy" });
    expect(result).toBe("• Cream — 100ml");
  });

  it("formats nos without unit label", () => {
    const result = formatIngredientLine({ name: "Tomatoes", qty: 3, unit: "nos", category: "vegetables" });
    expect(result).toBe("• Tomatoes — 3");
  });

  it("formats tsp with space", () => {
    const result = formatIngredientLine({ name: "Cumin", qty: 1, unit: "tsp", category: "spices" });
    expect(result).toBe("• Cumin — 1 tsp");
  });

  it("omits decimal when qty is a whole number", () => {
    const result = formatIngredientLine({ name: "Butter", qty: 50.0, unit: "g", category: "dairy" });
    expect(result).toBe("• Butter — 50g");
  });
});

describe("formatIngredientsMessage", () => {
  it("includes recipe name and serving count in header", () => {
    const scaled = scaleIngredients(BASE, 2);
    const msg = formatIngredientsMessage("Paneer Butter Masala", scaled, 2);
    expect(msg).toContain("Paneer Butter Masala");
    expect(msg).toContain("2 servings");
  });

  it("uses singular serving for 1", () => {
    const scaled = scaleIngredients(BASE, 1);
    const msg = formatIngredientsMessage("Dal Tadka", scaled, 1);
    expect(msg).toContain("1 serving");
    expect(msg).not.toContain("1 servings");
  });

  it("lists all ingredients as bullet points", () => {
    const scaled = scaleIngredients(BASE, 2);
    const msg = formatIngredientsMessage("Test", scaled, 2);
    expect(msg).toContain("• Paneer");
    expect(msg).toContain("• Tomatoes");
    expect(msg).toContain("• Butter");
  });
});
