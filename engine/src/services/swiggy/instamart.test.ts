/**
 * Swiggy Instamart service tests — all Swiggy API calls are mocked.
 * No real credentials needed. Tests verify service logic and error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client.js", () => ({
  callTool: vi.fn(),
  SwiggyAuthError: class SwiggyAuthError extends Error { readonly type = "auth" as const; },
  SwiggyAPIError: class SwiggyAPIError extends Error { readonly type = "api" as const; },
}));

import { callTool } from "./client.js";
import {
  getAddresses,
  searchProducts,
  updateCart,
  getCart,
  checkout,
  matchIngredients,
  buildCartItems,
  formatCartSummary,
} from "./instamart.js";

const mockCallTool = vi.mocked(callTool);

beforeEach(() => vi.clearAllMocks());

const TOKEN = "test-token";

describe("getAddresses", () => {
  it("returns list of addresses", async () => {
    mockCallTool.mockResolvedValue({
      addresses: [
        { address_id: "addr1", label: "Home", formatted: "123 Main St, Bengaluru" },
      ],
    });

    const result = await getAddresses(TOKEN);
    expect(result).toHaveLength(1);
    expect(result[0].address_id).toBe("addr1");
    expect(mockCallTool).toHaveBeenCalledWith(TOKEN, "get_addresses", {});
  });

  it("returns empty array when no addresses saved", async () => {
    mockCallTool.mockResolvedValue({ addresses: [] });
    const result = await getAddresses(TOKEN);
    expect(result).toHaveLength(0);
  });
});

describe("searchProducts", () => {
  it("returns only available products", async () => {
    mockCallTool.mockResolvedValue({
      products: [
        { product_id: "p1", store_id: "s1", name: "Paneer", price: 80, unit: "200g", available: true },
        { product_id: "p2", store_id: "s1", name: "Paneer Block", price: 150, unit: "400g", available: false },
      ],
    });

    const result = await searchProducts(TOKEN, "Paneer", "addr1");
    expect(result).toHaveLength(1);
    expect(result[0].product_id).toBe("p1");
  });

  it("returns empty array when nothing found", async () => {
    mockCallTool.mockResolvedValue({ products: [] });
    const result = await searchProducts(TOKEN, "Truffle Oil", "addr1");
    expect(result).toHaveLength(0);
  });

  it("passes query and address_id correctly", async () => {
    mockCallTool.mockResolvedValue({ products: [] });
    await searchProducts(TOKEN, "Tomatoes", "addr-xyz");
    expect(mockCallTool).toHaveBeenCalledWith(TOKEN, "search_products", {
      query: "Tomatoes",
      address_id: "addr-xyz",
    });
  });
});

describe("updateCart", () => {
  it("calls update_cart with full item list", async () => {
    mockCallTool.mockResolvedValue({});
    const items = [
      { product_id: "p1", store_id: "s1", quantity: 1 },
      { product_id: "p2", store_id: "s1", quantity: 2 },
    ];
    await updateCart(TOKEN, items);
    expect(mockCallTool).toHaveBeenCalledWith(TOKEN, "update_cart", { items });
  });
});

describe("getCart", () => {
  it("returns cart with billing breakdown", async () => {
    mockCallTool.mockResolvedValue({
      items: [{ product_id: "p1", name: "Paneer", quantity: 1, price: 80 }],
      bill: { item_total: 80, delivery_fee: 25, platform_fee: 5, total: 110 },
    });

    const cart = await getCart(TOKEN);
    expect(cart.bill.total).toBe(110);
    expect(cart.items).toHaveLength(1);
  });
});

describe("checkout", () => {
  it("places order and returns order details", async () => {
    mockCallTool.mockResolvedValue({
      order_id: "ORD-12345",
      status: "confirmed",
      estimated_delivery_minutes: 15,
    });

    const order = await checkout(TOKEN, "addr1");
    expect(order.order_id).toBe("ORD-12345");
    expect(order.estimated_delivery_minutes).toBe(15);
    expect(mockCallTool).toHaveBeenCalledWith(TOKEN, "checkout", { address_id: "addr1" });
  });
});

describe("matchIngredients", () => {
  it("returns a match for each ingredient", async () => {
    mockCallTool
      .mockResolvedValueOnce({
        products: [{ product_id: "p1", store_id: "s1", name: "Paneer 200g", price: 80, unit: "200g", available: true }],
      })
      .mockResolvedValueOnce({ products: [] }); // Kasuri Methi not found

    const result = await matchIngredients(
      TOKEN,
      [{ name: "Paneer" }, { name: "Kasuri Methi" }],
      "addr1"
    );

    expect(result).toHaveLength(2);
    expect(result[0].product?.product_id).toBe("p1");
    expect(result[1].product).toBeNull();
  });

  it("searches all ingredients in parallel", async () => {
    mockCallTool.mockResolvedValue({ products: [] });
    const ingredients = Array.from({ length: 5 }, (_, i) => ({ name: `Ingredient ${i}` }));
    await matchIngredients(TOKEN, ingredients, "addr1");
    expect(mockCallTool).toHaveBeenCalledTimes(5);
  });
});

describe("buildCartItems", () => {
  it("includes only matched products", () => {
    const matches = [
      { ingredient_name: "Paneer", product: { product_id: "p1", store_id: "s1", name: "Paneer", price: 80, unit: "200g", available: true } },
      { ingredient_name: "Saffron", product: null },
    ];
    const items = buildCartItems(matches);
    expect(items).toHaveLength(1);
    expect(items[0].product_id).toBe("p1");
    expect(items[0].quantity).toBe(1);
  });
});

describe("formatCartSummary", () => {
  const cart = {
    items: [
      { product_id: "p1", name: "Paneer 200g", quantity: 1, price: 80 },
      { product_id: "p2", name: "Butter 100g", quantity: 1, price: 55 },
    ],
    bill: { item_total: 135, delivery_fee: 25, platform_fee: 5, total: 165 },
  };

  it("shows total price", () => {
    const summary = formatCartSummary(cart, []);
    expect(summary).toContain("₹165");
    expect(summary).toContain("₹135");
  });

  it("lists out-of-stock items when present", () => {
    const summary = formatCartSummary(cart, ["Saffron", "Kasuri Methi"]);
    expect(summary).toContain("Not available on Instamart");
    expect(summary).toContain("Saffron");
    expect(summary).toContain("Kasuri Methi");
  });

  it("does not show out-of-stock section when all items found", () => {
    const summary = formatCartSummary(cart, []);
    expect(summary).not.toContain("Not available");
  });

  it("shows delivery fee", () => {
    const summary = formatCartSummary(cart, []);
    expect(summary).toContain("₹25");
  });
});
