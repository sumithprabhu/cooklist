# Cooklist — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT SURFACES                          │
│                                                                 │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐  │
│   │   Website   │   │  QR Scan    │   │  Telegram / WhatsApp│  │
│   │  (cooklist  │   │  (recipe    │   │       Bot           │  │
│   │    .in)     │   │   page)     │   │                     │  │
│   └──────┬──────┘   └──────┬──────┘   └──────────┬──────────┘  │
└──────────┼────────────────┼──────────────────────┼─────────────┘
           │                │                      │
           └────────────────┴──────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       ENGINE  (this repo)                       │
│                                                                 │
│   POST /message        ◄── normalised input from any surface   │
│   GET  /health                                                  │
│   GET  /recipes                                                 │
│   GET  /auth/callback  ◄── OAuth redirect from Swiggy          │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │              Conversation State Machine                  │  │
│   │  idle → recipe_shown → order_preview → ordered          │  │
│   │                     ↕ awaiting_auth                      │  │
│   └───────────────────────────┬─────────────────────────────┘  │
│                               │                                 │
│           ┌───────────────────┼───────────────────┐            │
│           ▼                   ▼                   ▼            │
│   ┌───────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│   │   AI Service  │  │ Session Store  │  │  Swiggy Service  │  │
│   │  Groq / Llama │  │ (in-memory /   │  │  Instamart MCP   │  │
│   │  3.3 70B      │  │  Redis)        │  │                  │  │
│   └───────────────┘  └────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
                                   ┌─────────────────────────────┐
                                   │     Swiggy Instamart MCP    │
                                   │     mcp.swiggy.com/im       │
                                   │                             │
                                   │  search_products            │
                                   │  update_cart                │
                                   │  get_cart                   │
                                   │  checkout                   │
                                   └─────────────────────────────┘
```

---

## Order Flow

A complete journey from user input to placed order.

```
User                    Engine                  Groq            Swiggy MCP
 │                        │                      │                  │
 │  "Butter Chicken for 4"│                      │                  │
 │───────────────────────►│                      │                  │
 │                        │  recipe not in store │                  │
 │                        │─────────────────────►│                  │
 │                        │  ingredients JSON    │                  │
 │                        │◄─────────────────────│                  │
 │  ingredients + buttons │                      │                  │
 │◄───────────────────────│                      │                  │
 │                        │                      │                  │
 │  tap "Order all items" │                      │                  │
 │───────────────────────►│                      │                  │
 │                        │── get_addresses ────────────────────►  │
 │                        │◄─ address_id ───────────────────────   │
 │                        │                      │                  │
 │                        │── search_products (×N, parallel) ────► │
 │                        │◄─ matched products ──────────────────   │
 │                        │                      │                  │
 │                        │── update_cart ───────────────────────► │
 │                        │── get_cart ──────────────────────────► │
 │                        │◄─ bill { total, fees } ──────────────   │
 │                        │                      │                  │
 │  cart summary + total  │                      │                  │
 │◄───────────────────────│                      │                  │
 │                        │                      │                  │
 │  tap "Confirm order"   │                      │                  │
 │───────────────────────►│                      │                  │
 │                        │── checkout ──────────────────────────► │
 │                        │◄─ order_id + ETA ────────────────────   │
 │                        │                      │                  │
 │  "Order placed! ORD-xx"│                      │                  │
 │◄───────────────────────│                      │                  │
```

---

## OAuth Flow (Swiggy Login)

```
User                    Engine                          Swiggy Auth
 │                        │                                  │
 │  tap "Order"           │                                  │
 │───────────────────────►│                                  │
 │                        │  no token for user_id            │
 │                        │  generate PKCE verifier+challenge│
 │                        │  store { verifier, state }       │
 │                        │                                  │
 │  login URL             │                                  │
 │◄───────────────────────│                                  │
 │                        │                                  │
 │  opens URL in browser ─────────────────────────────────► │
 │                        │                                  │
 │                        │         phone + OTP on Swiggy    │
 │ ◄──────────────────────────────────── redirect ?code=...  │
 │                        │                                  │
 │  GET /auth/callback    │                                  │
 │  ?code=...&state=...   │                                  │
 │───────────────────────►│                                  │
 │                        │── POST /auth/token ────────────► │
 │                        │◄─ access_token (5 day TTL) ────   │
 │                        │  saveToken(user_id, token)        │
 │                        │                                  │
 │  "You're logged in!"   │                                  │
 │◄───────────────────────│                                  │
```

---

## Conversation State Machine

```
                    ┌──────┐
              ┌────►│ idle │◄─────────────────────┐
              │     └──┬───┘                      │
              │        │ text: recipe name         │
              │        ▼                           │
              │  ┌─────────────┐                  │
              │  │recipe_shown │◄──────────────┐  │
              │  └──────┬──────┘               │  │
              │         │                      │  │
              │    ┌────┴──────────────┐       │  │
              │    │                   │       │  │
              │    ▼                   ▼       │  │
              │  action:           action:     │  │
              │  servings          order       │  │
              │    │                   │       │  │
              │    ▼                   │       │  │
              │ ┌──────────────┐       │       │  │
              │ │awaiting_     │       │       │  │
              │ │servings      │       │       │  │
              │ └──────┬───────┘       │       │  │
              │        │ set_servings  │       │  │
              │        └──────────────►┘       │  │
              │                        │       │  │
              │               no token │       │  │
              │                   ▼    │       │  │
              │          ┌─────────────┴─┐     │  │
              │          │ awaiting_auth  │     │  │
              │          └───────────────┘     │  │
              │                        │       │  │
              │               has token│       │  │
              │                   ▼            │  │
              │          ┌──────────────┐      │  │
              │          │order_preview │      │  │
              │          └──────┬───────┘      │  │
              │                 │              │  │
              │           ┌─────┴──────┐       │  │
              │           │            │       │  │
              │           ▼            ▼       │  │
              │        confirm       cancel    │  │
              │           │            └───────┘  │
              │           ▼                       │
              │      ┌─────────┐                  │
              └──────│ ordered │──────────────────┘
                     └─────────┘
```

---

## Service Layer

### AI Service (`src/services/ai.ts`)

Handles recipe parsing for any dish not in the hardcoded store.

- Model: Llama 3.3 70B via Groq
- Input: free-text recipe name
- Output: structured ingredient list (name, qty, unit, category) for 1 serving
- In-memory cache: repeat queries skip the API call entirely
- Graceful fallback: if Groq fails, engine shows the browse list

### Swiggy Service (`src/services/swiggy/`)

| File | Responsibility |
|---|---|
| `auth.ts` | OAuth 2.1 PKCE — generate auth URL, exchange code for token |
| `client.ts` | JSON-RPC MCP client with exponential backoff (500ms → 8s, 5 retries) |
| `instamart.ts` | Tool wrappers: get_addresses, search_products, update_cart, get_cart, checkout |
| `token-store.ts` | Per-user token storage, 5-day TTL |

### Session Store (`src/session/store.ts`)

Stateless REST API with server-side session state keyed by `session_id`. In-memory with 30-min TTL. Swap to Redis for multi-instance deployments.

---

## API Contract

All surfaces speak the same protocol to the engine.

### POST /message

```
Request
{
  session_id: string       // stable ID per user per platform
  platform: "telegram" | "whatsapp" | "slack" | "web"
  user_id: string          // used for token lookup
  text?: string            // what the user typed
  action_id?: string       // button the user tapped
}

Response
{
  text: string             // message to show the user (markdown)
  action_rows: Action[][]  // 2D array of buttons (rows × buttons)
  state: ConversationState // persisted by engine between turns
}
```

`action_rows` is a 2D array so adapters can map it directly to platform-native UI — Telegram inline keyboards, WhatsApp list messages, Slack Block Kit — without the engine knowing which platform it's talking to.

---

## Environment Variables

```
PORT                    Server port (default 3000)
GROQ_API_KEY            Groq API key for recipe parsing
SWIGGY_CLIENT_ID        From Swiggy Builders Club
SWIGGY_CLIENT_SECRET    From Swiggy Builders Club
SWIGGY_REDIRECT_URI     OAuth callback URL (default http://localhost:3000/auth/callback)
```
