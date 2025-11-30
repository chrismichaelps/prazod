import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules",
        "dist",
        "**/*.test.ts",
        "**/*.config.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "~/domain": resolve(__dirname, "./src/domain"),
      "~/services": resolve(__dirname, "./src/services"),
      "~/adapters": resolve(__dirname, "./src/adapters"),
      "~/cli": resolve(__dirname, "./src/cli"),
      "~": resolve(__dirname, "./src"),
    },
  },
});
