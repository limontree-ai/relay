import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      "packages/*/vitest.config.{ts,mts,js,mjs}",
      "apps/*/vitest.config.{ts,mts,js,mjs}",
      { test: { name: "scripts", include: ["scripts/**/*.test.mjs"] } },
    ],
  },
});
