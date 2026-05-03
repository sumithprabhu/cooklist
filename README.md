# Cooklist

Recipe discovery platform with one-click Swiggy Instamart ordering. Users browse dishes, search any recipe, and get all ingredients delivered — from the website, a QR code scan, or a chat message on Telegram and WhatsApp.

## What It Does

**Website** — curated dish directory, recipe search, ingredient lists, add-to-cart in one click.

**QR layer** — food creators embed a QR code in their reels. Viewers scan, land on the recipe page, order ingredients without leaving the moment.

**Chat** — Telegram and WhatsApp users type a recipe name, an AI figures out the ingredients, they tap Order. No app, no website needed.

All three surfaces run on the same engine and call the same Swiggy Instamart MCP tools.

## How the Ordering Flow Works

1. User sends a recipe name
2. Engine checks the hardcoded recipe store — if found, returns instantly
3. If not found, calls Groq (Llama 3.3 70B) to extract ingredients for any recipe
4. User taps Order — engine checks for a valid Swiggy OAuth token
5. No token — PKCE login URL generated and sent to the user
6. After login — get_addresses fetches the user's saved addresses
7. search_products called for each ingredient in parallel
8. update_cart sets the full cart in one call
9. get_cart returns the itemised bill — shown to the user before confirm
10. User confirms — checkout places the order, returns order ID and ETA

See [ARCHITECTURE.md](./ARCHITECTURE.md) for sequence diagrams and the full state machine.

## Platform Adapters

The engine is platform-agnostic. Each chat surface is a thin adapter that translates platform-native messages into a standard API call and maps the response back to platform buttons.

Adapters in progress: Telegram, WhatsApp. The engine is ready — adapters call the same API.

## Swiggy Instamart Integration

Calls the following MCP tools on mcp.swiggy.com/im in order:

| Tool | When |
|---|---|
| get_addresses | After login, to get the user's delivery address |
| search_products | Per ingredient, parallel |
| update_cart | Once, with the full item list |
| get_cart | To fetch the live price before confirming |
| checkout | On user confirmation |

Auth: OAuth 2.1 with PKCE. Tokens stored in-memory with a 5-day TTL matching Swiggy's token spec. No token data is ever written to disk or logged.

Retry strategy: exponential backoff starting at 500ms, doubling to a max of 8s, capped at 5 retries per Swiggy's error handling guidelines.
