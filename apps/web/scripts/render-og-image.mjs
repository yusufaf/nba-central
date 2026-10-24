#!/usr/bin/env node
/**
 * Renders every daily game's link-preview image: public/og-image-daily.png
 * from src/components/DailyEra/DailyEraPreviewCard.vue, and
 * public/og-image-cap-five.png from src/components/CapFive/CapFivePreviewCard.vue.
 * Run with `pnpm render:og` after changing a card, and commit the PNG: the
 * card and this script are its source, the PNG is what ships. A new game
 * needs a card, a dev entry under scripts/og/ and a TARGETS row.
 *
 * Starts Vite and screenshots each card from its scripts/og/ page in
 * Chromium, so the image gets the app's real tokens, Inter and icons. The
 * same machine renders the same bytes; another OS rasterises fonts slightly
 * differently, so expect a near-identical file there, not an identical one.
 *
 * If Chromium is missing: `pnpm exec playwright install chromium`.
 */
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TARGETS = [
    { entry: 'scripts/og/daily-era.html', out: fileURLToPath(new URL('../public/og-image-daily.png', import.meta.url)) },
    { entry: 'scripts/og/cap-five.html', out: fileURLToPath(new URL('../public/og-image-cap-five.png', import.meta.url)) },
];

// 127.0.0.1, not localhost: ::1 fails with EACCES on this repo's Windows box.
// Outside Windows' reserved 3100-3199 and test:visual's 5301.
const server = await createServer({
    root: ROOT,
    logLevel: 'warn',
    server: { host: '127.0.0.1', port: 5302, strictPort: true, hmr: false },
});
let browser;
try {
    await server.listen();
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    for (const { entry, out } of TARGETS) {
        await page.goto(new URL(entry, server.resolvedUrls.local[0]).href);
        const card = page.getByTestId('og-card');
        await card.waitFor();

        // fonts.check() would pass with no Inter face at all, so look for a
        // loaded one. The page's own scope has no `document` for ESLint here.
        const interLoaded = await page.evaluate(async () => {
            const fonts = globalThis.document.fonts;
            await fonts.load("700 1em 'Inter Variable'");
            await fonts.ready;
            return [...fonts].some((f) => f.family.replaceAll('"', '') === 'Inter Variable' && f.status === 'loaded');
        });
        if (!interLoaded) throw new Error(`Inter did not load for ${entry}; the image would use a fallback font`);

        await card.screenshot({ path: out, animations: 'disabled' });
        console.log(`Wrote ${out}`);
    }
} catch (err) {
    console.error(err);
    process.exitCode = 1;
} finally {
    await browser?.close();
    await server.close();
}
