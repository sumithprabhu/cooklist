import type { Ingredient } from "./data.js";

const WHOLE_UNITS = new Set(["nos", "cloves", "set"]);

function roundQty(qty: number, unit: string): number {
  if (WHOLE_UNITS.has(unit)) return Math.max(1, Math.round(qty));
  if (unit === "g" || unit === "ml") {
    if (qty <= 50) return Math.max(5, Math.round(qty / 5) * 5);
    return Math.max(25, Math.round(qty / 25) * 25);
  }
  return Math.round(qty * 2) / 2;
}

function formatQty(qty: number, unit: string): string {
  const n = qty === Math.floor(qty) ? Math.floor(qty) : qty;
  if (unit === "g" || unit === "ml") return `${n}${unit}`;
  if (unit === "nos") return `${n}`;
  return `${n} ${unit}`;
}

export function scaleIngredients(ingredients: Ingredient[], servings: number): Ingredient[] {
  return ingredients.map((item) => ({
    ...item,
    qty: roundQty(item.qty * servings, item.unit),
  }));
}

export function formatIngredientLine(item: Ingredient): string {
  return `• ${item.name} — ${formatQty(item.qty, item.unit)}`;
}

export function formatIngredientsMessage(
  displayName: string,
  ingredients: Ingredient[],
  servings: number
): string {
  const header = `Here's what you need for *${displayName}* (${servings} serving${servings > 1 ? "s" : ""}):`;
  const lines = ingredients.map(formatIngredientLine);
  return [header, "", ...lines].join("\n");
}
