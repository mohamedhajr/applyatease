import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node26",
    ssr: "src/main.ts",
    rollupOptions: { output: { entryFileNames: "main.js" } },
  },
});
