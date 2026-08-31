import path from "node:path";
import { defineConfig } from "vitest/config";

// Mirror the tsconfig.json `paths` aliases so source files that import via
// "models/*", "utilities/*", etc. resolve under vitest.
export default defineConfig({
    resolve: {
        alias: {
            models: path.resolve(__dirname, "models"),
            utilities: path.resolve(__dirname, "utilities"),
            resources: path.resolve(__dirname, "resources"),
            lambdas: path.resolve(__dirname, "service/lambdas"),
        },
    },
    test: {
        environment: "node",
        globals: true,
        include: ["test/**/*.test.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            include: ["service/**", "utilities/**", "resources/**"],
        },
    },
});
