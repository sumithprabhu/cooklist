/**
 * JSON-RPC MCP client for Swiggy Instamart.
 * Endpoint: POST https://mcp.swiggy.com/im
 *
 * Retry strategy from docs: exponential backoff, start 500ms, double, cap at 8s, max 5 retries.
 */

const IM_ENDPOINT = "https://mcp.swiggy.com/im";

export interface MCPError {
  success: false;
  error: { message: string; reportLink?: string };
}

let _requestId = 0;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function callTool<T>(
  token: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<T> {
  const id = String(++_requestId);
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  });

  let delay = 500;
  for (let attempt = 0; attempt <= 5; attempt++) {
    const res = await fetch(IM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
    });

    // Retryable server errors
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      if (attempt < 5) {
        await sleep(delay + Math.random() * 200);
        delay = Math.min(delay * 2, 8000);
        continue;
      }
    }

    if (res.status === 401) {
      throw new SwiggyAuthError("Token expired or invalid — re-authenticate");
    }

    const json = await res.json() as { result?: { content?: Array<{ text: string }> }; error?: unknown };

    if (json.error) throw new SwiggyAPIError(`MCP error: ${JSON.stringify(json.error)}`);

    // MCP wraps result in content[0].text as JSON string
    const text = json.result?.content?.[0]?.text;
    if (!text) throw new SwiggyAPIError(`Empty response from ${toolName}`);

    const parsed = JSON.parse(text) as T & { success?: boolean; error?: { message: string } };
    if ((parsed as MCPError).success === false) {
      throw new SwiggyAPIError((parsed as MCPError).error.message);
    }

    return parsed;
  }

  throw new SwiggyAPIError(`${toolName} failed after 5 retries`);
}

export class SwiggyAuthError extends Error { readonly type = "auth" as const; }
export class SwiggyAPIError extends Error { readonly type = "api" as const; }
