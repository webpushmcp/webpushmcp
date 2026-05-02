import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { PushSubscriptionStore } from "./store/durable-object";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { getRateLimitKeys } from "./mcp/rate-limit";

export { PushSubscriptionStore };

/**
 * Factory to create a fresh MCP server instance for each request.
 * If a clientId is provided (from the URL path), the tool requires no clientId argument.
 * If no clientId, the tool accepts it as an explicit parameter (legacy /mcp endpoint).
 */
function createMcpServer(env: Env, boundClientId?: string) {
  const server = new McpServer({
    name: "webpush-native-mcp",
    version: "1.0.0",
  });

  if (boundClientId) {
    // Personalized endpoint: clientId is baked in from the URL — no parameter needed
    server.tool(
      "send_notification",
      "Send a browser push notification to the owner of this MCP endpoint",
      {
        title: z.string().max(200).describe("Notification title"),
        body: z.string().max(4000).describe("Notification body text"),
        url: z.string().url().optional().describe("URL to open when the user clicks the notification"),
      },
      async ({ title, body, url }) => sendPush(env, boundClientId, title, body, url)
    );
  } else {
    // Generic endpoint: clientId must be supplied as a tool argument
    server.tool(
      "send_notification",
      "Send a browser push notification to a registered client",
      {
        clientId: z.string().describe("Unique client ID from the subscription page"),
        title: z.string().max(200).describe("Notification title"),
        body: z.string().max(4000).describe("Notification body text"),
        url: z.string().url().optional().describe("URL to open when the user clicks the notification"),
      },
      async ({ clientId, title, body, url }) => sendPush(env, clientId, title, body, url)
    );
  }

  return server;
}

async function sendPush(
  env: Env,
  clientId: string,
  title: string,
  body: string,
  url?: string
) {
  const stub = env.PUSH_STORE.get(env.PUSH_STORE.idFromName(clientId));
  const sub = await stub.getSubscription(clientId);
  if (!sub) return { content: [{ type: "text" as const, text: `Client ${clientId} not found` }], isError: true };

  try {
    const message = await buildPushPayload(
      {
        data: JSON.stringify({ 
          title, 
          body, 
          data: { url: url || env.BASE_URL || "/" } 
        })
      },
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      },
      {
        subject: env.VAPID_SUBJECT,
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY
      }
    );
    
    const res = await fetch(sub.endpoint, message);
    const resText = await res.text();
    
    if (!res.ok) {
      return { 
        content: [{ type: "text" as const, text: `Push service error: ${res.status} ${resText}` }], 
        isError: true 
      };
    }
    
    return { 
      content: [{ 
        type: "text" as const, 
        text: `Notification sent successfully. Service response: ${res.status}` 
      }] 
    };
  } catch (e: any) {
    return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Layered Rate Limiting:
    // 1. Check IP-based "ceiling" (stops random ID spam from one source)
    // 2. Check ClientID-based limit (ensures user isolation)
    const { ipKey, clientIdKey } = getRateLimitKeys(url, request.headers);
    
    // Always check IP limit
    const ipCheck = await env.RATE_LIMITER.limit({ key: ipKey });
    if (!ipCheck.success) {
      return new Response("Too many requests from this IP", { status: 429, headers: { "Access-Control-Allow-Origin": "*" } });
    }

    // Additionally check ClientID limit if present
    if (clientIdKey) {
      const idCheck = await env.RATE_LIMITER.limit({ key: clientIdKey });
      if (!idCheck.success) {
        return new Response("Too many requests for this client", { status: 429, headers: { "Access-Control-Allow-Origin": "*" } });
      }
    }


    // Personalized MCP endpoint: /mcp/:clientId
    const personalizedMatch = url.pathname.match(/^\/mcp\/([\w-]+)$/);
    const isMcpRequest = url.pathname === "/mcp" || personalizedMatch;

    if (isMcpRequest) {
      const boundClientId = personalizedMatch ? personalizedMatch[1] : undefined;

      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
        enableJsonResponse: true
      });

      const server = createMcpServer(env, boundClientId);
      await server.connect(transport);

      const modifiedRequest = new Request(request, {
        headers: new Headers(request.headers)
      });
      // Always set this to satisfy the transport's strict specification check
      modifiedRequest.headers.set("Accept", "application/json, text/event-stream");

      return transport.handleRequest(modifiedRequest);
    }

    if (url.pathname === "/api/vapid-public-key") {
      return new Response(env.VAPID_PUBLIC_KEY, {
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    if (url.pathname === "/api/subscribe" && request.method === "POST") {
      try {
        const { endpoint, keys } = await request.json() as any;
        const clientId = crypto.randomUUID();
        const stub = env.PUSH_STORE.get(env.PUSH_STORE.idFromName(clientId));
        await stub.saveSubscription(clientId, endpoint, keys.p256dh, keys.auth);
        return new Response(JSON.stringify({ clientId }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (e: any) {
        return new Response(e.message, { status: 400 });
      }
    }

    if (url.pathname.startsWith("/api/subscription/") && request.method === "DELETE") {
      const clientId = url.pathname.split("/").pop()!;
      const stub = env.PUSH_STORE.get(env.PUSH_STORE.idFromName(clientId));
      await stub.deleteSubscription(clientId);
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
    }

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Accept"
        }
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
