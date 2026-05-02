import { describe, it, expect } from "vitest";
import { getRateLimitKeys } from "./rate-limit";

describe("getRateLimitKeys", () => {
  it("returns both IP and clientId keys for personalized endpoints", () => {
    const url = new URL("http://localhost/mcp/55b335c5-1f1b-4fe9-a2a9-48ef5e67869d");
    const headers = new Headers({ "CF-Connecting-IP": "1.2.3.4" });
    const keys = getRateLimitKeys(url, headers);
    expect(keys.ipKey).toBe("ip:1.2.3.4");
    expect(keys.clientIdKey).toBe("id:55b335c5-1f1b-4fe9-a2a9-48ef5e67869d");
  });

  it("returns only IP key for generic endpoints", () => {
    const url = new URL("http://localhost/api/subscribe");
    const headers = new Headers({ "CF-Connecting-IP": "8.8.8.8" });
    const keys = getRateLimitKeys(url, headers);
    expect(keys.ipKey).toBe("ip:8.8.8.8");
    expect(keys.clientIdKey).toBeUndefined();
  });

  it("handles missing IP with anonymous fallback", () => {
    const url = new URL("http://localhost/mcp");
    const headers = new Headers();
    const keys = getRateLimitKeys(url, headers);
    expect(keys.ipKey).toBe("ip:anonymous");
  });
});
