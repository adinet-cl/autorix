import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@autorix/core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "@autorix/storage": path.resolve(__dirname, "packages/storage/src/index.ts"),
      "@autorix/nestjs": path.resolve(
        __dirname,
        "packages/nestjs/src/index.ts"
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["**/src/**/*.spec.ts", "**/tests/**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
    },
  },
});
