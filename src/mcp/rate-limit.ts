export interface RateLimitKeys {
  ipKey: string;
  clientIdKey?: string;
}

/**
 * Functional helper to determine rate limiting keys.
 * Returns an IP-based key for global protection and an optional
 * clientId-based key for personalized endpoint protection.
 */
export function getRateLimitKeys(url: URL, headers: Headers): RateLimitKeys {
  const ip = headers.get("CF-Connecting-IP") || "anonymous";
  const keys: RateLimitKeys = { ipKey: `ip:${ip}` };

  // Match /mcp/:clientId or /api/subscription/:clientId
  const idMatch = url.pathname.match(/\/(?:mcp|subscription)\/([\w-]+)$/);
  if (idMatch) {
    keys.clientIdKey = `id:${idMatch[1]}`;
  }

  return keys;
}
