import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["services/**/test/*.integration.test.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
