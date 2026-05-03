# Cooklist

Recipe discovery platform with one-click Swiggy Instamart ordering. Users browse dishes, search any recipe, and get all ingredients delivered — from the website, a QR code scan, or a chat message on Telegram and WhatsApp.

---

## What It Does

**Website** — curated dish directory, recipe search, ingredient lists, add-to-cart in one click.

**QR layer** — food creators embed a QR code in their reels. Viewers scan, land on the recipe page, order ingredients without leaving the moment.

**Chat** — Telegram and WhatsApp users type a recipe name, an AI figures out the ingredients, they tap Order. No app, no website needed.

All three surfaces run on the same engine and call the same Swiggy Instamart MCP tools.

---

## Repository Structure

```
cooklist/
└── engine/                 Core API — all business logic lives here
    └── src/
        ├── index.ts        Server entry point
        ├── app.ts          Fastify app factory (used by server + tests)
        ├── protocol.ts     API contract — request/response types (Zod)
        ├── conversation/
        │   └── engine.ts   Conversation state machine
        ├── recipes/
        │   ├── data.ts     Hardcoded recipe store + alias resolution
        │   └── scaler.ts   Serving size scaler + message formatter
        ├── routes/
        │   ├── message.ts  POST /message, GET /health, GET /recipes
        │   └── auth.ts     GET /auth/callback (OAuth redirect)
        ├── services/
        │   ├── ai.ts       Groq recipe parser (AI fallback)
        │   └── swiggy/
        │       ├── auth.ts         OAuth 2.1 PKCE flow
        │       ├── client.ts       MCP JSON-RPC client
        │       ├── instamart.ts    Instamart tool wrappers
        │       └── token-store.ts  Per-user token storage
        └── session/
            └── store.ts    Conversation session storage
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Groq API key — [console.groq.com](https://console.groq.com)
- Swiggy Builders Club credentials (for Instamart ordering)

### Setup

```bash
cd engine
cp .env.example .env
# fill in your keys (see Environment Variables below)
npm install
npm run dev
```

Server starts on `http://localhost:3000`.

### Verify

```bash
curl http://localhost:3000/health
# {"ok":true}
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port, default `3000` |
| `GROQ_API_KEY` | Yes | Groq API key for AI recipe parsing |
| `SWIGGY_CLIENT_ID` | Yes (ordering) | From Swiggy Builders Club |
| `SWIGGY_CLIENT_SECRET` | Yes (ordering) | From Swiggy Builders Club |
| `SWIGGY_REDIRECT_URI` | No | OAuth callback, default `http://localhost:3000/auth/callback` |

Without Swiggy credentials the engine runs fully — recipe parsing and ingredient extraction work. Ordering requires a valid `client_id`.

---

## API

### POST /message

The single endpoint all surfaces call. Accepts a user message or button tap, returns a response and updated state.

```bash
curl -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "user-123",
    "platform": "telegram",
    "user_id": "u1",
    "text": "Butter Chicken for 4"
  }'
```

```json
{
  "text": "Here's what you need for *Butter Chicken* (4 servings):\n\n• Chicken — 475g\n...",
  "action_rows": [
    [{ "id": "order|butter chicken|4", "label": "Order all items" }],
    [{ "id": "servings|butter chicken|4", "label": "Change servings" }]
  ],
  "state": {
    "step": "recipe_shown",
    "recipe_key": "butter chicken",
    "servings": 4
  }
}
```

`action_rows` is a 2D array of buttons. Each platform adapter maps this to its native UI (Telegram inline keyboards, WhatsApp list messages, Slack Block Kit).

### GET /recipes

Returns all available recipes for building menus.

```bash
curl http://localhost:3000/recipes
```

### GET /auth/callback

OAuth redirect URI. Swiggy sends the user here after login. Exchanges the code for an access token and stores it against the `user_id`.

---

## Testing

```bash
cd engine
npm test
```

64 tests across 6 files. Covers recipe lookup, serving scaling, the full conversation state machine, Swiggy service layer (mocked), and HTTP routes.

```
Test Files  6 passed (6)
Tests       64 passed (64)
Duration    ~4s
```

The AI service tests (`src/services/ai.test.ts`) make real Groq API calls — they require `GROQ_API_KEY` in the environment. All other tests are fully mocked and run offline.

---

## How the Ordering Flow Works

1. User sends a recipe name
2. Engine checks the hardcoded recipe store — if found, returns instantly
3. If not found, calls Groq (Llama 3.3 70B) to extract ingredients for any recipe
4. User taps Order — engine checks for a valid Swiggy OAuth token
5. No token — PKCE login URL generated and sent to the user
6. After login — `get_addresses` fetches the user's saved addresses
7. `search_products` called for each ingredient in parallel
8. `update_cart` sets the full cart in one call
9. `get_cart` returns the itemised bill — shown to the user before confirm
10. User confirms — `checkout` places the order, returns order ID and ETA

See [ARCHITECTURE.md](./ARCHITECTURE.md) for sequence diagrams and the full state machine.

---

## Platform Adapters

The engine is platform-agnostic. Each chat surface is a thin adapter that translates platform-native messages into `POST /message` calls and maps `action_rows` back to platform buttons.

Adapters in progress: Telegram, WhatsApp. The engine is ready — adapters call the same API.

---

## Swiggy Instamart Integration

Calls the following MCP tools on `mcp.swiggy.com/im` in order:

| Tool | When |
|---|---|
| `get_addresses` | After login, to get the user's delivery address |
| `search_products` | Per ingredient, parallel |
| `update_cart` | Once, with the full item list |
| `get_cart` | To fetch the live price before confirming |
| `checkout` | On user confirmation |

Auth: OAuth 2.1 with PKCE. Tokens stored in-memory with a 5-day TTL (matching Swiggy's token spec). No token data is ever written to disk or logged.

Retry strategy: exponential backoff starting at 500ms, doubling to a max of 8s, capped at 5 retries — per Swiggy's error handling guidelines.
