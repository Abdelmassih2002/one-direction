import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  plugins: [],
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    pool: "forks",
  },
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
});
