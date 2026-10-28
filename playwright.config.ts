import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "apps/web/test",
  use: { baseURL: "http://127.0.0.1:4173", browserName: "chromium" },
  webServer: {
    command: "pnpm --filter @applyatease/web preview --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
