import type { MessageInput, MessageOutput, ConversationState, Action } from "../protocol.js";
import { INITIAL_STATE } from "../protocol.js";
import { findRecipe, listRecipes, registerRecipe, RECIPES } from "../recipes/data.js";
import { scaleIngredients, formatIngredientsMessage } from "../recipes/scaler.js";
import { parseRecipe } from "../services/ai.js";
import { getToken } from "../services/swiggy/token-store.js";
import { generateAuthUrl } from "../services/swiggy/auth.js";
import {
  getAddresses,
  matchIngredients,
  buildCartItems,
  updateCart,
  getCart,
  checkout,
  formatCartSummary,
} from "../services/swiggy/instamart.js";
import { SwiggyAuthError } from "../services/swiggy/client.js";

const DEFAULT_SERVINGS = 2;
const SERVING_OPTIONS = [1, 2, 3, 4, 6, 8];

// ── Action row builders ───────────────────────────────────────────────────────

function recipeActions(recipeKey: string, servings: number): Action[][] {
  return [
    [{ id: `order|${recipeKey}|${servings}`, label: "Order all items" }],
    [
      { id: `servings|${recipeKey}|${servings}`, label: "Change servings" },
      { id: `edit|${recipeKey}|${servings}`, label: "Edit items" },
    ],
    [{ id: "browse", label: "Different recipe" }],
  ];
}

function servingsActions(recipeKey: string): Action[][] {
  const row1 = SERVING_OPTIONS.slice(0, 3).map((n) => ({
    id: `set_servings|${recipeKey}|${n}`,
    label: `${n}`,
  }));
  const row2 = SERVING_OPTIONS.slice(3).map((n) => ({
    id: `set_servings|${recipeKey}|${n}`,
    label: `${n}`,
  }));
  return [row1, row2, [{ id: `back|${recipeKey}|${DEFAULT_SERVINGS}`, label: "Back" }]];
}

function confirmActions(recipeKey: string, servings: number): Action[][] {
  return [
    [
      { id: `confirm|${recipeKey}|${servings}`, label: "Confirm order" },
      { id: `back|${recipeKey}|${servings}`, label: "Cancel" },
    ],
  ];
}

function browseActions(): Action[][] {
  return listRecipes().map((r) => [
    { id: `recipe|${r.key}|${DEFAULT_SERVINGS}`, label: r.display_name },
  ]);
}

// ── Response builders ─────────────────────────────────────────────────────────

function recipeResponse(recipeKey: string, servings: number): { text: string; action_rows: Action[][] } {
  const recipe = RECIPES[recipeKey];
  const scaled = scaleIngredients(recipe.ingredients, servings);
  return {
    text: formatIngredientsMessage(recipe.display_name, scaled, servings),
    action_rows: recipeActions(recipeKey, servings),
  };
}

// ── State machine ─────────────────────────────────────────────────────────────

export async function process(state: ConversationState, input: MessageInput): Promise<MessageOutput> {
  if (input.text) return handleText(state, input.text);

  const actionId = input.action_id!;
  const [action, ...params] = actionId.split("|");

  switch (action) {
    case "browse":
      return { text: "Pick a recipe:", action_rows: browseActions(), state: { ...INITIAL_STATE } };

    case "recipe": {
      const [recipeKey, servingsStr] = params;
      const servings = parseInt(servingsStr, 10) || DEFAULT_SERVINGS;
      const { text, action_rows } = recipeResponse(recipeKey, servings);
      return { text, action_rows, state: { step: "recipe_shown", recipe_key: recipeKey, servings } };
    }

    case "servings": {
      const [recipeKey] = params;
      return {
        text: "How many servings?",
        action_rows: servingsActions(recipeKey),
        state: { step: "awaiting_servings", recipe_key: recipeKey, servings: state.servings },
      };
    }

    case "set_servings": {
      const [recipeKey, servingsStr] = params;
      const servings = Math.max(1, Math.min(20, parseInt(servingsStr, 10)));
      const { text, action_rows } = recipeResponse(recipeKey, servings);
      return { text, action_rows, state: { step: "recipe_shown", recipe_key: recipeKey, servings } };
    }

    case "back": {
      const [recipeKey, servingsStr] = params;
      const servings = parseInt(servingsStr, 10) || DEFAULT_SERVINGS;
      const { text, action_rows } = recipeResponse(recipeKey, servings);
      return { text, action_rows, state: { step: "recipe_shown", recipe_key: recipeKey, servings } };
    }

    case "order":
      return handleOrder(input.user_id, input.session_id, params, state);

    case "confirm":
      return handleConfirm(input.user_id, params, state);

    case "swiggy_login": {
      // User tapped the re-login button
      const [recipeKey, servingsStr] = params;
      const authUrl = generateAuthUrl(input.user_id, input.session_id);
      return {
        text: `Login to Swiggy to continue:\n${authUrl}\n\n_Tap the link, log in, then come back and tap Order again._`,
        action_rows: [[{ id: `order|${recipeKey}|${servingsStr}`, label: "Try ordering again" }]],
        state: { step: "awaiting_auth", recipe_key: recipeKey, servings: parseInt(servingsStr, 10) },
      };
    }

    case "edit":
      return {
        text: "To remove an item, just tell me which one and I'll update the list.",
        action_rows: state.recipe_key
          ? recipeActions(state.recipe_key, state.servings ?? DEFAULT_SERVINGS)
          : [],
        state,
      };

    default:
      return unknownInput(state);
  }
}

// ── Swiggy order flow ─────────────────────────────────────────────────────────

async function handleOrder(
  userId: string,
  sessionId: string,
  params: string[],
  state: ConversationState
): Promise<MessageOutput> {
  const [recipeKey, servingsStr] = params;
  const servings = parseInt(servingsStr, 10) || DEFAULT_SERVINGS;
  const recipe = RECIPES[recipeKey];

  const token = getToken(userId);
  if (!token) {
    const authUrl = generateAuthUrl(userId, sessionId);
    return {
      text: `You need to log in to Swiggy first.\n\n[Tap here to login](${authUrl})\n\nOnce done, come back and tap Order again.`,
      action_rows: [[{ id: `swiggy_login|${recipeKey}|${servings}`, label: "Login to Swiggy" }]],
      state: { step: "awaiting_auth", recipe_key: recipeKey, servings },
    };
  }

  try {
    // Get delivery address (auto-select first)
    const addresses = await getAddresses(token);
    if (addresses.length === 0) {
      return {
        text: "No saved addresses found on your Swiggy account. Add one in the Swiggy app first.",
        action_rows: recipeActions(recipeKey, servings),
        state: { step: "recipe_shown", recipe_key: recipeKey, servings },
      };
    }
    const addressId = addresses[0].address_id;

    // Search all ingredients in parallel
    const scaled = scaleIngredients(recipe.ingredients, servings);
    const matches = await matchIngredients(token, scaled, addressId);

    // Split found vs not found
    const outOfStock = matches.filter((m) => !m.product).map((m) => m.ingredient_name);
    const cartItems = buildCartItems(matches);

    if (cartItems.length === 0) {
      return {
        text: "None of the ingredients are currently available on Instamart. Try again later.",
        action_rows: recipeActions(recipeKey, servings),
        state: { step: "recipe_shown", recipe_key: recipeKey, servings },
      };
    }

    // Build cart and fetch price
    await updateCart(token, cartItems);
    const cart = await getCart(token);
    const summary = formatCartSummary(cart, outOfStock);

    return {
      text: `${summary}\n\nPlace this order?`,
      action_rows: confirmActions(recipeKey, servings),
      state: {
        step: "order_preview",
        recipe_key: recipeKey,
        servings,
        address_id: addressId,
        cart_total: cart.bill.total,
      },
    };
  } catch (err) {
    if (err instanceof SwiggyAuthError) {
      const authUrl = generateAuthUrl(userId, sessionId);
      return {
        text: `Your Swiggy session expired. [Login again](${authUrl}) and tap Order.`,
        action_rows: [[{ id: `order|${recipeKey}|${servings}`, label: "Try again" }]],
        state: { step: "awaiting_auth", recipe_key: recipeKey, servings },
      };
    }
    return {
      text: "Something went wrong connecting to Swiggy. Please try again.",
      action_rows: recipeActions(recipeKey, servings),
      state: { step: "recipe_shown", recipe_key: recipeKey, servings },
    };
  }
}

async function handleConfirm(
  userId: string,
  params: string[],
  state: ConversationState
): Promise<MessageOutput> {
  const [recipeKey, servingsStr] = params;
  const servings = parseInt(servingsStr, 10) || DEFAULT_SERVINGS;
  const recipe = RECIPES[recipeKey];

  const token = getToken(userId);
  if (!token || !state.address_id) {
    return {
      text: "Session lost. Please start over.",
      action_rows: browseActions(),
      state: { ...INITIAL_STATE },
    };
  }

  try {
    const order = await checkout(token, state.address_id);
    const eta = order.estimated_delivery_minutes
      ? ` Arriving in ~${order.estimated_delivery_minutes} mins.`
      : "";

    return {
      text: `Order placed for *${recipe.display_name}*!\n\nOrder ID: \`${order.order_id}\`${eta}`,
      action_rows: [],
      state: { step: "ordered", recipe_key: recipeKey, servings, order_id: order.order_id },
    };
  } catch (err) {
    if (err instanceof SwiggyAuthError) {
      return {
        text: "Your Swiggy session expired. Please log in again.",
        action_rows: recipeActions(recipeKey, servings),
        state: { step: "recipe_shown", recipe_key: recipeKey, servings },
      };
    }
    return {
      text: "Checkout failed. Please try again.",
      action_rows: confirmActions(recipeKey, servings),
      state,
    };
  }
}

// ── Text handler ──────────────────────────────────────────────────────────────

async function handleText(state: ConversationState, text: string): Promise<MessageOutput> {
  let servings = DEFAULT_SERVINGS;
  let query = text;

  for (const word of ["for", "feeds", "serves"]) {
    const idx = text.toLowerCase().indexOf(` ${word} `);
    if (idx !== -1) {
      query = text.slice(0, idx);
      const rest = text.slice(idx + word.length + 2).trim();
      const parsed = parseInt(rest, 10);
      if (!isNaN(parsed)) servings = Math.max(1, Math.min(20, parsed));
      break;
    }
  }

  const [recipeKey] = findRecipe(query);
  if (recipeKey) {
    const { text: msg, action_rows } = recipeResponse(recipeKey, servings);
    return { text: msg, action_rows, state: { step: "recipe_shown", recipe_key: recipeKey, servings } };
  }

  const aiResult = await parseRecipe(query);
  if (aiResult) {
    registerRecipe(aiResult.key, aiResult.recipe);
    const { text: msg, action_rows } = recipeResponse(aiResult.key, servings);
    return { text: msg, action_rows, state: { step: "recipe_shown", recipe_key: aiResult.key, servings } };
  }

  return {
    text: "I couldn't find that recipe. Try a different name or pick from the list:",
    action_rows: browseActions(),
    state: { ...INITIAL_STATE },
  };
}

function unknownInput(state: ConversationState): MessageOutput {
  return {
    text: "I didn't understand that. Try typing a recipe name or tap a button.",
    action_rows: state.recipe_key
      ? recipeActions(state.recipe_key, state.servings ?? DEFAULT_SERVINGS)
      : browseActions(),
    state,
  };
}
