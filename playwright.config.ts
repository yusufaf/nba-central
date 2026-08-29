import { defineConfig, devices } from '@playwright/test';

/**
 * Visual regression for the design system.
 *
 * Screenshots catch what the token layer and `pnpm check:styles` cannot:
 * spacing rhythm, alignment drift and hierarchy. Those are exactly the failures
 * that made this UI look broken while every individual value was defensible.
 *
 * Baselines are platform-specific because font rasterisation differs, so they
 * are generated and compared in a container. See `pnpm test:visual`.
 */
const PORT = 3101;

export default defineConfig({
    testDir: './tests/visual',
    // Screenshots are the assertion, so a flaky retry hides real drift.
    retries: 0,
    fullyParallel: true,
    reporter: process.env.CI ? 'github' : 'list',
    // projectName and platform both matter: desktop and mobile render the same
    // route differently, and font rasterisation differs per OS. Without them,
    // one project silently overwrites the other's baselines.
    snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}-{platform}/{arg}{ext}',

    use: {
        // A dedicated port, not the 3000 the normal dev server uses. Another
        // worktree's server on 3000 will otherwise be reused and silently
        // screenshot the wrong branch.
        baseURL: `http://127.0.0.1:${PORT}`,
        colorScheme: 'dark',
        screenshot: 'only-on-failure',
    },

    expect: {
        toHaveScreenshot: {
            // Anti-aliasing moves a few pixels between runs; a real layout
            // change moves far more than this.
            maxDiffPixelRatio: 0.01,
            animations: 'disabled',
        },
    },

    projects: [
        {
            name: 'desktop',
            use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
        },
        {
            name: 'mobile',
            use: { ...devices['Pixel 7'] },
        },
    ],

    webServer: {
        command: `pnpm exec vite --port ${PORT} --strictPort --host 127.0.0.1`,
        url: `http://127.0.0.1:${PORT}`,
        // Never reuse. A server already listening on a shared port is not
        // necessarily this worktree, and a stale one yields screenshots that
        // are confidently wrong — which is exactly what happened once.
        reuseExistingServer: false,
        timeout: 120_000,
    },
});
