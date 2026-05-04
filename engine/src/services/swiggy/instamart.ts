/**
 * Instamart tool wrappers — parameter shapes match the MCP reference docs exactly.
 * https://mcp.swiggy.com/builders/docs/reference/instamart/
 *
 * Order flow: get_addresses → search_products → update_cart → get_cart → checkout
 */

import { callTool } from "./client.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Address {
  addressId: string;
  label?: string;
  formatted: string;
}

export interface ProductVariant {
  spinId: string;     // used for cart operations
  name: string;
  price: number;
  unit: string;
  available: boolean;
}

export interface Product {
  name: string;
  variants: ProductVariant[];
}

export interface CartItem {
  spinId: string;
  quantity: number;
}

export interface CartBill {
  itemTotal: number;
  deliveryFee: number;
  platformFee: number;
  total: number;
}

export interface PaymentMethod {
  type: string;
  label: string;
}

export interface Cart {
  items: Array<{ spinId: string; name: string; quantity: number; price: number }>;
  bill: CartBill;
  availablePaymentMethods: PaymentMethod[];
}

export interface Order {
  orderId: string;
  status: string;
  estimatedDeliveryMinutes?: number;
}

export interface OrderSummary {
  orderId: string;
  status: string;
  items: Array<{ name: string; quantity: number }>;
}

export interface TrackingInfo {
  orderId: string;
  status: string;
  eta: string;
  deliveryPartnerLocation?: { lat: number; lng: number };
}

export const CART_LIMIT = 1000;

// ── Discover ──────────────────────────────────────────────────────────────────

export async function getAddresses(token: string): Promise<Address[]> {
  const data = await callTool<{ addresses: Address[] }>(token, "get_addresses", {});
  return data.addresses ?? [];
}

export async function searchProducts(
  token: string,
  addressId: string,
  query: string,
  offset = 0
): Promise<Product[]> {
  const data = await callTool<{ products: Product[] }>(token, "search_products", {
    addressId,
    query,
    offset,
  });
  return data.products ?? [];
}

export async function getGoToItems(token: string, addressId: string): Promise<Product[]> {
  const data = await callTool<{ products: Product[] }>(token, "your_go_to_items", { addressId });
  return data.products ?? [];
}

// ── Cart ──────────────────────────────────────────────────────────────────────

export async function clearCart(token: string): Promise<void> {
  await callTool(token, "clear_cart", {});
}

export async function updateCart(
  token: string,
  selectedAddressId: string,
  items: CartItem[]
): Promise<void> {
  await callTool(token, "update_cart", { selectedAddressId, items });
}

export async function getCart(token: string): Promise<Cart> {
  return callTool<Cart>(token, "get_cart", {});
}

// ── Order ─────────────────────────────────────────────────────────────────────

export async function checkout(
  token: string,
  addressId: string,
  paymentMethod?: string
): Promise<Order> {
  const args: Record<string, unknown> = { addressId };
  if (paymentMethod) args.paymentMethod = paymentMethod;
  return callTool<Order>(token, "checkout", args);
}

// ── Track ─────────────────────────────────────────────────────────────────────

export async function getOrders(
  token: string,
  opts: { count?: number; activeOnly?: boolean } = {}
): Promise<OrderSummary[]> {
  const data = await callTool<{ orders: OrderSummary[] }>(token, "get_orders", {
    count: opts.count ?? 10,
    orderType: "INSTAMART",
    activeOnly: opts.activeOnly ?? false,
  });
  return data.orders ?? [];
}

export async function getOrderDetails(token: string, orderId: string): Promise<OrderSummary> {
  return callTool<OrderSummary>(token, "get_order_details", { orderId });
}

export async function trackOrder(
  token: string,
  orderId: string,
  lat: number,
  lng: number
): Promise<TrackingInfo> {
  return callTool<TrackingInfo>(token, "track_order", { orderId, lat, lng });
}

// ── Ingredient matching helpers ───────────────────────────────────────────────

export interface IngredientMatch {
  ingredient_name: string;
  variant: ProductVariant | null;
}

export async function matchIngredients(
  token: string,
  ingredients: Array<{ name: string }>,
  addressId: string
): Promise<IngredientMatch[]> {
  return Promise.all(
    ingredients.map(async (ing) => {
      const products = await searchProducts(token, addressId, ing.name);
      const variant = products.flatMap((p) => p.variants).find((v) => v.available) ?? null;
      return { ingredient_name: ing.name, variant };
    })
  );
}

export function buildCartItems(matches: IngredientMatch[]): CartItem[] {
  return matches
    .filter((m): m is IngredientMatch & { variant: ProductVariant } => m.variant !== null)
    .map((m) => ({ spinId: m.variant.spinId, quantity: 1 }));
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
  lines.push(`Items total: ₹${cart.bill.itemTotal}`);
  lines.push(`Delivery fee: ₹${cart.bill.deliveryFee}`);
  if (cart.bill.platformFee > 0) lines.push(`Platform fee: ₹${cart.bill.platformFee}`);
  lines.push(`*Total: ₹${cart.bill.total}*`);

  if (cart.bill.total > CART_LIMIT) {
    lines.push(`\n_Cart exceeds ₹${CART_LIMIT} limit for chat ordering. Please use the Swiggy app._`);
  }

  if (cart.availablePaymentMethods?.length > 0) {
    const methods = cart.availablePaymentMethods.map((m) => m.label).join(", ");
    lines.push(`\nPay via: ${methods}`);
  }

  return lines.join("\n");
}
