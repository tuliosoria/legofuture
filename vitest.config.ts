import { defineConfig } from "vitest/config";
import path from "node:path";

// @vitejs/plugin-react installed; vitest esbuild handles TSX natively.

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: [
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
    ],
    environment: "jsdom",
    globals: true,
  },
});
