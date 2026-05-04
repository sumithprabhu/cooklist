import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/ai.js", () => ({ parseRecipe: vi.fn() }));
vi.mock("../services/swiggy/token-store.js", () => ({ getToken: vi.fn() }));
vi.mock("../services/swiggy/auth.js", () => ({ generateAuthUrl: vi.fn(() => "https://swiggy.com/auth/mock") }));
vi.mock("../services/swiggy/instamart.js", () => ({
  getAddresses: vi.fn(),
  matchIngredients: vi.fn(),
  buildCartItems: vi.fn(),
  updateCart: vi.fn(),
  getCart: vi.fn(),
  checkout: vi.fn(),
  formatCartSummary: vi.fn(() => "*Order summary:*\n• Paneer — ₹80\n\n*Total: ₹165*"),
}));

import { process } from "./engine.js";
import { parseRecipe } from "../services/ai.js";
import { getToken } from "../services/swiggy/token-store.js";
import {
  getAddresses, matchIngredients, buildCartItems, updateCart, getCart, checkout,
} from "../services/swiggy/instamart.js";
import type { ConversationState } from "../protocol.js";
import { INITIAL_STATE } from "../protocol.js";

const mockParseRecipe = vi.mocked(parseRecipe);
const mockGetToken = vi.mocked(getToken);
const mockGetAddresses = vi.mocked(getAddresses);
const mockMatchIngredients = vi.mocked(matchIngredients);
const mockBuildCartItems = vi.mocked(buildCartItems);
const mockUpdateCart = vi.mocked(updateCart);
const mockGetCart = vi.mocked(getCart);
const mockCheckout = vi.mocked(checkout);

const idle: ConversationState = { ...INITIAL_STATE };

beforeEach(() => {
  vi.clearAllMocks();
  mockParseRecipe.mockResolvedValue(null);
  mockGetToken.mockReturnValue(null); // no Swiggy auth by default
});

// ── Recipe lookup ─────────────────────────────────────────────────────────────

describe("text input — hardcoded recipes", () => {
  it("finds a hardcoded recipe and transitions to recipe_shown", async () => {
    const out = await process(idle, { session_id: "s1", platform: "telegram", user_id: "u1", text: "Dal Tadka" });
    expect(out.state.step).toBe("recipe_shown");
    expect(out.state.recipe_key).toBe("dal tadka");
    expect(out.text).toContain("Dal Tadka");
    expect(mockParseRecipe).not.toHaveBeenCalled();
  });

  it("parses serving count from text", async () => {
    const out = await process(idle, { session_id: "s1", platform: "telegram", user_id: "u1", text: "Paneer Butter Masala for 4" });
    expect(out.state.servings).toBe(4);
    expect(out.text).toContain("4 servings");
  });

  it("resolves aliases without calling AI", async () => {
    const out = await process(idle, { session_id: "s1", platform: "telegram", user_id: "u1", text: "saag paneer" });
    expect(out.state.recipe_key).toBe("palak paneer");
    expect(mockParseRecipe).not.toHaveBeenCalled();
  });
});

describe("text input — AI fallback", () => {
  it("calls AI when recipe is not hardcoded", async () => {
    mockParseRecipe.mockResolvedValue({
      key: "butter chicken",
      recipe: {
        display_name: "Butter Chicken",
        servings_default: 2,
        ingredients: [
          { name: "Chicken", qty: 200, unit: "g", category: "meat" },
          { name: "Butter", qty: 30, unit: "g", category: "dairy" },
        ],
      },
    });

    const out = await process(idle, { session_id: "s1", platform: "telegram", user_id: "u1", text: "Butter Chicken" });
    expect(mockParseRecipe).toHaveBeenCalledWith("Butter Chicken");
    expect(out.state.step).toBe("recipe_shown");
    expect(out.state.recipe_key).toBe("butter chicken");
  });

  it("shows browse list when AI also returns nothing", async () => {
    const out = await process(idle, { session_id: "s1", platform: "telegram", user_id: "u1", text: "xyzzy unknown dish" });
    expect(out.state.step).toBe("idle");
    expect(out.text).toContain("couldn't find");
  });
});

// ── Navigation actions ────────────────────────────────────────────────────────

describe("action: browse", () => {
  it("returns recipe list and resets to idle", async () => {
    const out = await process(idle, { session_id: "s1", platform: "telegram", user_id: "u1", action_id: "browse" });
    expect(out.state.step).toBe("idle");
    expect(out.action_rows.length).toBeGreaterThanOrEqual(10);
  });
});

describe("action: set_servings", () => {
  it("updates serving count and stays in recipe_shown", async () => {
    const recipeShown: ConversationState = { step: "recipe_shown", recipe_key: "rajma", servings: 2 };
    const out = await process(recipeShown, { session_id: "s1", platform: "telegram", user_id: "u1", action_id: "set_servings|rajma|6" });
    expect(out.state.step).toBe("recipe_shown");
    expect(out.state.servings).toBe(6);
    expect(out.text).toContain("6 servings");
  });

  it("clamps servings to max 20", async () => {
    const out = await process(idle, { session_id: "s1", platform: "telegram", user_id: "u1", action_id: "set_servings|poha|99" });
    expect(out.state.servings).toBe(20);
  });
});

describe("action: back", () => {
  it("returns to recipe_shown", async () => {
    const preview: ConversationState = { step: "order_preview", recipe_key: "chole", servings: 3 };
    const out = await process(preview, { session_id: "s1", platform: "telegram", user_id: "u1", action_id: "back|chole|3" });
    expect(out.state.step).toBe("recipe_shown");
    expect(out.state.servings).toBe(3);
  });
});

// ── Swiggy order flow ─────────────────────────────────────────────────────────

describe("action: order — no Swiggy token", () => {
  it("prompts user to login when not authenticated", async () => {
    mockGetToken.mockReturnValue(null);
    const recipeShown: ConversationState = { step: "recipe_shown", recipe_key: "dal tadka", servings: 2 };
    const out = await process(recipeShown, { session_id: "s1", platform: "telegram", user_id: "u1", action_id: "order|dal tadka|2" });
    expect(out.state.step).toBe("awaiting_auth");
    expect(out.text).toContain("log in");
  });
});

describe("action: order — authenticated", () => {
  beforeEach(() => {
    mockGetToken.mockReturnValue("valid-token");
    mockGetAddresses.mockResolvedValue([{ addressId: "addr1", formatted: "123 Main St" }]);
    mockMatchIngredients.mockResolvedValue([
      { ingredient_name: "Toor Dal", variant: { spinId: "spin1", name: "Toor Dal 500g", price: 60, unit: "500g", available: true } },
    ]);
    mockBuildCartItems.mockReturnValue([{ spinId: "spin1", quantity: 1 }]);
    mockUpdateCart.mockResolvedValue(undefined);
    mockGetCart.mockResolvedValue({
      items: [{ spinId: "spin1", name: "Toor Dal", quantity: 1, price: 60 }],
      bill: { itemTotal: 60, deliveryFee: 25, platformFee: 5, total: 90 },
      availablePaymentMethods: [{ type: "COD", label: "Cash on Delivery" }],
    });
  });

  it("builds cart and transitions to order_preview with cart total", async () => {
    const recipeShown: ConversationState = { step: "recipe_shown", recipe_key: "dal tadka", servings: 2 };
    const out = await process(recipeShown, { session_id: "s1", platform: "telegram", user_id: "u1", action_id: "order|dal tadka|2" });
    expect(out.state.step).toBe("order_preview");
    expect(out.state.address_id).toBe("addr1");
    expect(out.state.cart_total).toBe(90);
    expect(out.action_rows.flat().some((a) => a.id.startsWith("confirm"))).toBe(true);
  });

  it("shows no-address message when Swiggy has no saved addresses", async () => {
    mockGetAddresses.mockResolvedValue([]);
    const recipeShown: ConversationState = { step: "recipe_shown", recipe_key: "dal tadka", servings: 2 };
    const out = await process(recipeShown, { session_id: "s1", platform: "telegram", user_id: "u1", action_id: "order|dal tadka|2" });
    expect(out.state.step).toBe("recipe_shown");
    expect(out.text).toContain("No saved addresses");
  });
});

describe("action: confirm", () => {
  it("calls checkout and transitions to ordered state", async () => {
    mockGetToken.mockReturnValue("valid-token");
    mockCheckout.mockResolvedValue({ orderId: "ORD-99", status: "confirmed", estimatedDeliveryMinutes: 15 });

    const preview: ConversationState = { step: "order_preview", recipe_key: "upma", servings: 2, address_id: "addr1", cart_total: 90 };
    const out = await process(preview, { session_id: "s1", platform: "telegram", user_id: "u1", action_id: "confirm|upma|2" });

    expect(out.state.step).toBe("ordered");
    expect(out.state.order_id).toBe("ORD-99");
    expect(out.text).toContain("ORD-99");
    expect(out.text).toContain("15 mins");
  });

  it("redirects to idle when no token at confirm time", async () => {
    mockGetToken.mockReturnValue(null);
    const preview: ConversationState = { step: "order_preview", recipe_key: "upma", servings: 2 };
    const out = await process(preview, { session_id: "s1", platform: "telegram", user_id: "u1", action_id: "confirm|upma|2" });
    expect(out.state.step).toBe("idle");
  });
});
