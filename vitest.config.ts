import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/test/*.test.ts",
      "apps/**/test/*.test.ts",
      "services/**/test/*.test.ts",
    ],
    exclude: [...configDefaults.exclude, "**/*.integration.test.ts"],
    clearMocks: true,
  },
});
