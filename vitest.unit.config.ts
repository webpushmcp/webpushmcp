import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/store/*.test.ts"], // Exclude Cloudflare-specific tests
  },
});
