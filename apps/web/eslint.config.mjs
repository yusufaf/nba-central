import js from "@eslint/js";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import skipFormatting from "@vue/eslint-config-prettier/skip-formatting";

export default defineConfigWithVueTs(
  {
    // Flat config has no `--ignore-path`, so the generated and reported
    // directories that .gitignore used to cover are listed here instead.
    name: "app/files-to-ignore",
    ignores: [
      "dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "public/**",
    ],
  },
  {
    name: "app/files-to-lint",
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,tsx,vue}"],
  },

  js.configs.recommended,
  pluginVue.configs["flat/essential"],
  vueTsConfigs.recommended,

  {
    name: "app/rule-tuning",
    rules: {
      // 137 occurrences here, 155 more in apps/cdk. Each needs a
      // real type chosen by hand, so they are tracked in #43 rather than
      // blocking the lint gate this config finally makes runnable.
      // src/models/, src/network/, and useTeamPersistence.ts are already at
      // zero and ratcheted to "error" below - don't undo that by scoping
      // this rule wider than "warn" default for the rest.
      "@typescript-eslint/no-explicit-any": "warn",

      // A leading underscore is how this codebase marks a binding it is
      // deliberately discarding — most often the omitted half of a
      // rest-sibling destructure, as in useTeamPersistence's toSnapshot.
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
  {
    // src/components/ui/ is vendored shadcn-vue and src/views/ are route
    // components; single-word names are the convention in both.
    name: "app/single-word-component-names",
    files: ["src/components/ui/**/*.vue", "src/views/**/*.vue"],
    rules: { "vue/multi-word-component-names": "off" },
  },

  {
    // #43's ratchet: these are at zero, so keep them there. Everything
    // else stays "warn" until its own slice lands - see app/rule-tuning.
    name: "app/no-explicit-any-ratchet",
    files: [
      "src/models/**/*.ts",
      "src/network/**/*.ts",
      "src/composables/useTeamPersistence.ts",
    ],
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },

  {
    name: "app/browser-globals",
    files: ["src/**/*.{js,ts,vue}", "tests/**/*.ts"],
    languageOptions: { globals: globals.browser },
  },
  {
    name: "app/node-globals",
    files: ["scripts/**/*.mjs", "*.config.{js,mjs,ts}"],
    languageOptions: { globals: globals.node },
  },

  // Must stay last: turns off the stylistic rules that would otherwise
  // disagree with .prettierrc.
  skipFormatting,
);
