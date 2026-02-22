import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts", "api/**/*.ts"],
      exclude: ["**/*.test.ts", "src/index.ts", "src/hosted/types.ts"],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 95,
        lines: 90
      }
    }
  }
});
