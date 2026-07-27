import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

// Test-only config kept separate from vite.config.ts so the dev proxy/build
// settings don't leak into test runs.
export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    test: {
        environment: "jsdom",
        globals: true,
        include: ["tests/**/*.test.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            include: ["src/**"],
        },
    },
});
