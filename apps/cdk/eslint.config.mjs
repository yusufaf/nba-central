import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    // Flat config does not read .gitignore, which is what covers these.
    name: "cdk/files-to-ignore",
    ignores: ["cdk.out/**", ".cdk.staging/**", "dist/**", "coverage/**"],
  },
  {
    name: "cdk/files-to-lint",
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    // Stacks, Lambda handlers and the refresh scripts all run on Node. This
    // was globals.browser, which left `process` and `Buffer` undeclared.
    languageOptions: { globals: globals.node },
  },
  tseslint.configs.recommended,
  {
    name: "cdk/rule-tuning",
    rules: {
      // 116 pre-existing occurrences, several of them in scraper code where
      // the upstream payload genuinely is unknown. Tracked in #43.
      "@typescript-eslint/no-explicit-any": "warn",

      // Matches apps/web: a leading underscore marks a binding deliberately
      // discarded.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);
