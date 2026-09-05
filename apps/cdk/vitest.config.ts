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
        // CDK's Template.fromStack(...) synth is CPU-heavy enough that it can
        // miss the 5s default when this package's tests run concurrently with
        // apps/web's (as the pre-commit hook's `pnpm -r test` does) - seen
        // intermittently timing out team-builder-dynamo/-web/-assets-cdn's
        // construct tests, none of which are otherwise slow in isolation.
        testTimeout: 15000,
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            include: ["service/**", "utilities/**", "resources/**"],
        },
    },
});
