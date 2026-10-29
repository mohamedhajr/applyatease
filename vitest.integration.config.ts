import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "./services/api/test/setup.integration.ts",
    include: ["services/**/test/*.integration.test.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
