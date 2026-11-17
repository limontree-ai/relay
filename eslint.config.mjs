import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "**/test-results/**",
      "**/playwright-report/**",
      "plan/**",
      "spikes/**",
      "**/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["packages/editor-core/src/**"], rules: { "@typescript-eslint/no-explicit-any": "off" } },
  { languageOptions: { globals: { process: "readonly", console: "readonly" } } },
);
