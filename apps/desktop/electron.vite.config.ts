import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {
    build: {
      externalizeDeps: false,
      rollupOptions: {
        input: {
          main: resolve("src/main/main.ts"),
          worker: resolve("src/worker/main.ts"),
        },
      },
    },
  },
  preload: {
    build: {
      externalizeDeps: false,
      rollupOptions: {
        input: { preload: resolve("src/preload/preload.ts") },
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: {
    root: "src/renderer",
    plugins: [react(), tailwindcss()],
    server: { host: "127.0.0.1", port: 5174, strictPort: true },
    build: { rollupOptions: { input: resolve("src/renderer/index.html") } },
  },
});
