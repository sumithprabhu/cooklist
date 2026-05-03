/**
 * Instamart tool wrappers.
 * All functions take a Bearer token + typed args, return typed results.
 *
 * Tool order for a full order flow:
 *   getAddresses → searchProducts (per ingredient) → updateCart → getCart → checkout
 */

import { callTool } from "./client.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Address {
  address_id: string;
  label?: string;
  formatted: string;
}

export interface Product {
  product_id: string;
  store_id: string;
  name: string;
  price: number;       // in rupees
  unit: string;        // e.g. "500g", "1L", "1 piece"
  available: boolean;
  image_url?: string;
}

export interface CartItem {
  product_id: string;
  store_id: string;
  quantity: number;
}

export interface CartBill {
  item_total: number;
  delivery_fee: number;
  platform_fee: number;
  total: number;
}

export interface Cart {
  items: Array<{ product_id: string; name: string; quantity: number; price: number }>;
  bill: CartBill;
}

export interface Order {
  order_id: string;
  status: string;
  estimated_delivery_minutes?: number;
}

// ── Tool wrappers ─────────────────────────────────────────────────────────────

export async function getAddresses(token: string): Promise<Address[]> {
  const res = await callTool<{ addresses: Address[] }>(token, "get_addresses", {});
  return res.addresses ?? [];
}

export async function searchProducts(
  token: string,
  query: string,
  addressId: string
): Promise<Product[]> {
  const res = await callTool<{ products: Product[] }>(token, "search_products", {
    query,
    address_id: addressId,
  });
  return (res.products ?? []).filter((p) => p.available);
}

export async function updateCart(token: string, items: CartItem[]): Promise<void> {
  await callTool(token, "update_cart", { items });
}

export async function getCart(token: string): Promise<Cart> {
  return callTool<Cart>(token, "get_cart", {});
}

export async function checkout(token: string, addressId: string): Promise<Order> {
  return callTool<Order>(token, "checkout", { address_id: addressId });
}

// ── Ingredient → product matching ─────────────────────────────────────────────

export interface IngredientMatch {
  ingredient_name: string;
  product: Product | null;   // null = not found / out of stock
}

/**
 * For each ingredient, search Instamart and pick the best match.
 * Returns one match per ingredient (first available result).
 */
export async function matchIngredients(
  token: string,
  ingredients: Array<{ name: string }>,
  addressId: string
): Promise<IngredientMatch[]> {
  const results = await Promise.all(
    ingredients.map(async (ing) => {
      const products = await searchProducts(token, ing.name, addressId);
      return {
        ingredient_name: ing.name,
        product: products[0] ?? null,
      };
    })
  );
  return results;
}

export function buildCartItems(matches: IngredientMatch[]): CartItem[] {
  return matches
    .filter((m): m is IngredientMatch & { product: Product } => m.product !== null)
    .map((m) => ({
      product_id: m.product.product_id,
      store_id: m.product.store_id,
      quantity: 1,
    }));
}

export function formatCartSummary(cart: Cart, outOfStock: string[]): string {
  const lines: string[] = [];

  if (outOfStock.length > 0) {
    lines.push(`_Not available on Instamart: ${outOfStock.join(", ")}_\n`);
  }

  lines.push(`*Order summary:*`);
  for (const item of cart.items) {
    lines.push(`• ${item.name} ×${item.quantity} — ₹${item.price}`);
  }

  lines.push("");
  lines.push(`Items total: ₹${cart.bill.item_total}`);
  lines.push(`Delivery fee: ₹${cart.bill.delivery_fee}`);
  if (cart.bill.platform_fee > 0) lines.push(`Platform fee: ₹${cart.bill.platform_fee}`);
  lines.push(`*Total: ₹${cart.bill.total}*`);

  return lines.join("\n");
}
