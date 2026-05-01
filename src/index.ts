import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { PushSubscriptionStore } from "./store/durable-object";
import { buildPushPayload } from "@block65/webcrypto-web-push";

export { PushSubscriptionStore };

/**
 * Factory to create a fresh MCP server instance for each request.
 * This prevents "Already connected to a transport" errors in stateless environments.
 */
function createMcpServer(env: Env) {
  const server = new McpServer({
    name: "webpush-native-mcp",
    version: "1.0.0",
  });

  server.tool(
    "send_notification",
    "Send a browser push notification to a registered client",
    {
      clientId: z.string().describe("Unique client ID from subscription page"),
      title: z.string().max(200).describe("Notification title"),
      body: z.string().max(4000).describe("Notification body text"),
      url: z.string().url().optional().describe("URL to open on click"),
    },
    async ({ clientId, title, body, url }) => {
      const stub = env.PUSH_STORE.get(env.PUSH_STORE.idFromName(clientId));
      const sub = await stub.getSubscription(clientId);
      if (!sub) return { content: [{ type: "text", text: `Client ${clientId} not found` }], isError: true };

      try {
        const message = await buildPushPayload(
          {
            data: JSON.stringify({ 
              title, 
              body, 
              data: { url: url || "/" } 
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
            content: [{ type: "text", text: `Push service error: ${res.status} ${resText}` }], 
            isError: true 
          };
        }
        
        return { 
          content: [{ 
            type: "text", 
            text: `Notification sent to ${clientId}. Service response: ${res.status} ${resText || "(no body)"}` 
          }] 
        };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  return server;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Standard MCP JSON-RPC over HTTP
    if (url.pathname === "/mcp") {
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
        enableJsonResponse: true
      });

      const server = createMcpServer(env);
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
