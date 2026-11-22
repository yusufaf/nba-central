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
      // 135 occurrences remain here. Each needs a real type chosen by
      // hand, so they are tracked in #43 rather than blocking the lint
      // gate this config finally makes runnable.
      // src/models/, src/network/, src/stores/, tests/stores/, and
      // useTeamPersistence.ts are already at zero and ratcheted to "error"
      // below - don't undo that by scoping this rule wider than "warn"
      // default for the rest.
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
      "src/stores/**/*.ts",
      "src/composables/useTeamPersistence.ts",
      "tests/stores/**/*.ts",
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

  // three.js is ~180 KB gzipped; it must only ever load behind the lazy 3D
  // component. A later block's no-restricted-imports replaces an earlier
  // one for the same file, so these two never overlap and each lists its
  // whole set. Regexes, not globs: a gitignore-style "three/*" also matches
  // "@/three/...". Relative paths into src/three count too, and so does a
  // direct import of a lazy scene component, which would bundle it eagerly.
  // scripts/check-bundle.mjs backs this up after the build.
  {
    name: "app/three-boundary",
    files: ["src/**/*.{ts,vue}"],
    ignores: ["src/three/**", "src/components/scene3d/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(three|@/three|(\\.{1,2}/)+three)(/|$)",
              message: "3D code stays behind the lazy scene3d component.",
            },
            {
              regex: "(^|/)(TeamScene3D|PersonPreview3D)(\\.vue)?$",
              message: "Use TeamScene3DAsync / PersonPreview3DAsync from @/components/scene3d.",
            },
          ],
        },
      ],
    },
  },
  // index.ts loads the scene components with import(), which this rule never
  // checks; it is in the page's own chunk, so a static import there is
  // exactly the leak to catch.
  {
    name: "app/three-boundary-scene3d",
    files: ["src/components/scene3d/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^three(/|$)",
              message: "Go through the @/three modules.",
            },
            {
              regex: "(^|/)(TeamScene3D|PersonPreview3D)(\\.vue)?$",
              message: "Load scene components with import() in index.ts.",
            },
          ],
        },
      ],
    },
  },

  // Must stay last: turns off the stylistic rules that would otherwise
  // disagree with .prettierrc.
  skipFormatting,
);
