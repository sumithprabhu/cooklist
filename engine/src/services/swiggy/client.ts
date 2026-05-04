/**
 * JSON-RPC MCP client for Swiggy Instamart.
 * Endpoint: POST https://mcp.swiggy.com/im
 *
 * Response envelope: { success: boolean, data: T, message?: string }
 * Retry: exponential backoff 500ms → 8s, max 5 retries.
 */

const IM_ENDPOINT = "https://mcp.swiggy.com/im";

interface SwiggyEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: { message: string };
}

export class SwiggyAuthError extends Error { readonly type = "auth" as const; }
export class SwiggyAPIError extends Error { readonly type = "api" as const; }

let _requestId = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

    if (res.status === 401) throw new SwiggyAuthError("Token expired — re-authenticate");

    if (res.status === 502 || res.status === 503 || res.status === 504) {
      if (attempt < 5) {
        await sleep(delay + Math.random() * 200);
        delay = Math.min(delay * 2, 8000);
        continue;
      }
    }

    const json = await res.json() as {
      result?: { content?: Array<{ text: string }> };
      error?: unknown;
    };

    if (json.error) throw new SwiggyAPIError(`MCP error on ${toolName}: ${JSON.stringify(json.error)}`);

    const text = json.result?.content?.[0]?.text;
    if (!text) throw new SwiggyAPIError(`Empty response from ${toolName}`);

    const envelope = JSON.parse(text) as SwiggyEnvelope<T>;
    if (!envelope.success) {
      throw new SwiggyAPIError(envelope.error?.message ?? `${toolName} returned success=false`);
    }

    return envelope.data;
  }

  throw new SwiggyAPIError(`${toolName} failed after 5 retries`);
}
