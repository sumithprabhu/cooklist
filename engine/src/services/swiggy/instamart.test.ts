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
  CART_LIMIT,
} from "./instamart.js";

const mockCallTool = vi.mocked(callTool);
const TOKEN = "test-token";

beforeEach(() => vi.clearAllMocks());

describe("getAddresses", () => {
  it("returns list of addresses", async () => {
    mockCallTool.mockResolvedValue({
      addresses: [{ addressId: "addr1", label: "Home", formatted: "123 Main St, Bengaluru" }],
    });
    const result = await getAddresses(TOKEN);
    expect(result).toHaveLength(1);
    expect(result[0].addressId).toBe("addr1");
    expect(mockCallTool).toHaveBeenCalledWith(TOKEN, "get_addresses", {});
  });

  it("returns empty array when no addresses saved", async () => {
    mockCallTool.mockResolvedValue({ addresses: [] });
    expect(await getAddresses(TOKEN)).toHaveLength(0);
  });
});

describe("searchProducts", () => {
  it("returns products with variants", async () => {
    mockCallTool.mockResolvedValue({
      products: [
        {
          name: "Paneer",
          variants: [
            { spinId: "spin1", name: "Paneer 200g", price: 80, unit: "200g", available: true },
            { spinId: "spin2", name: "Paneer 400g", price: 150, unit: "400g", available: false },
          ],
        },
      ],
    });
    const result = await searchProducts(TOKEN, "addr1", "Paneer");
    expect(result).toHaveLength(1);
    expect(result[0].variants).toHaveLength(2);
  });

  it("passes addressId and query correctly", async () => {
    mockCallTool.mockResolvedValue({ products: [] });
    await searchProducts(TOKEN, "addr-xyz", "Tomatoes");
    expect(mockCallTool).toHaveBeenCalledWith(TOKEN, "search_products", {
      addressId: "addr-xyz",
      query: "Tomatoes",
      offset: 0,
    });
  });

  it("returns empty array when nothing found", async () => {
    mockCallTool.mockResolvedValue({ products: [] });
    expect(await searchProducts(TOKEN, "addr1", "Truffle Oil")).toHaveLength(0);
  });
});

describe("updateCart", () => {
  it("calls update_cart with selectedAddressId and spinId items", async () => {
    mockCallTool.mockResolvedValue({});
    const items = [{ spinId: "spin1", quantity: 1 }, { spinId: "spin2", quantity: 2 }];
    await updateCart(TOKEN, "addr1", items);
    expect(mockCallTool).toHaveBeenCalledWith(TOKEN, "update_cart", {
      selectedAddressId: "addr1",
      items,
    });
  });
});

describe("getCart", () => {
  it("returns cart with billing breakdown and payment methods", async () => {
    mockCallTool.mockResolvedValue({
      items: [{ spinId: "spin1", name: "Paneer", quantity: 1, price: 80 }],
      bill: { itemTotal: 80, deliveryFee: 25, platformFee: 5, total: 110 },
      availablePaymentMethods: [{ type: "COD", label: "Cash on Delivery" }],
    });
    const cart = await getCart(TOKEN);
    expect(cart.bill.total).toBe(110);
    expect(cart.availablePaymentMethods).toHaveLength(1);
    expect(mockCallTool).toHaveBeenCalledWith(TOKEN, "get_cart", {});
  });
});

describe("checkout", () => {
  it("places order and returns order details", async () => {
    mockCallTool.mockResolvedValue({
      orderId: "ORD-12345",
      status: "confirmed",
      estimatedDeliveryMinutes: 15,
    });
    const order = await checkout(TOKEN, "addr1");
    expect(order.orderId).toBe("ORD-12345");
    expect(order.estimatedDeliveryMinutes).toBe(15);
    expect(mockCallTool).toHaveBeenCalledWith(TOKEN, "checkout", { addressId: "addr1" });
  });

  it("passes paymentMethod when provided", async () => {
    mockCallTool.mockResolvedValue({ orderId: "ORD-2", status: "confirmed" });
    await checkout(TOKEN, "addr1", "COD");
    expect(mockCallTool).toHaveBeenCalledWith(TOKEN, "checkout", {
      addressId: "addr1",
      paymentMethod: "COD",
    });
  });
});

describe("matchIngredients", () => {
  it("picks first available variant per ingredient", async () => {
    mockCallTool
      .mockResolvedValueOnce({
        products: [{
          name: "Paneer",
          variants: [{ spinId: "spin1", name: "Paneer 200g", price: 80, unit: "200g", available: true }],
        }],
      })
      .mockResolvedValueOnce({ products: [] });

    const result = await matchIngredients(TOKEN, [{ name: "Paneer" }, { name: "Kasuri Methi" }], "addr1");
    expect(result).toHaveLength(2);
    expect(result[0].variant?.spinId).toBe("spin1");
    expect(result[1].variant).toBeNull();
  });

  it("skips unavailable variants", async () => {
    mockCallTool.mockResolvedValue({
      products: [{
        name: "Paneer",
        variants: [
          { spinId: "spin1", name: "Paneer 200g", price: 80, unit: "200g", available: false },
          { spinId: "spin2", name: "Paneer 400g", price: 150, unit: "400g", available: true },
        ],
      }],
    });
    const result = await matchIngredients(TOKEN, [{ name: "Paneer" }], "addr1");
    expect(result[0].variant?.spinId).toBe("spin2");
  });

  it("searches all ingredients in parallel", async () => {
    mockCallTool.mockResolvedValue({ products: [] });
    await matchIngredients(TOKEN, Array.from({ length: 5 }, (_, i) => ({ name: `Item ${i}` })), "addr1");
    expect(mockCallTool).toHaveBeenCalledTimes(5);
  });
});

describe("buildCartItems", () => {
  it("maps matched variants to spinId cart items", () => {
    const matches = [
      { ingredient_name: "Paneer", variant: { spinId: "spin1", name: "Paneer 200g", price: 80, unit: "200g", available: true } },
      { ingredient_name: "Saffron", variant: null },
    ];
    const items = buildCartItems(matches);
    expect(items).toHaveLength(1);
    expect(items[0].spinId).toBe("spin1");
    expect(items[0].quantity).toBe(1);
  });
});

describe("formatCartSummary", () => {
  const cart = {
    items: [
      { spinId: "spin1", name: "Paneer 200g", quantity: 1, price: 80 },
      { spinId: "spin2", name: "Butter 100g", quantity: 1, price: 55 },
    ],
    bill: { itemTotal: 135, deliveryFee: 25, platformFee: 5, total: 165 },
    availablePaymentMethods: [{ type: "COD", label: "Cash on Delivery" }],
  };

  it("shows total and delivery fee", () => {
    const summary = formatCartSummary(cart, []);
    expect(summary).toContain("₹165");
    expect(summary).toContain("₹25");
  });

  it("lists out-of-stock items", () => {
    const summary = formatCartSummary(cart, ["Saffron"]);
    expect(summary).toContain("Not available on Instamart");
    expect(summary).toContain("Saffron");
  });

  it("shows payment methods", () => {
    const summary = formatCartSummary(cart, []);
    expect(summary).toContain("Cash on Delivery");
  });

  it("warns when cart exceeds limit", () => {
    const overLimit = { ...cart, bill: { ...cart.bill, total: CART_LIMIT + 1 } };
    const summary = formatCartSummary(overLimit, []);
    expect(summary).toContain(`₹${CART_LIMIT} limit`);
  });
});
