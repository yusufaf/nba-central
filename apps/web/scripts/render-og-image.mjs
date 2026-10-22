#!/usr/bin/env node
/**
 * Renders /daily's link-preview image, public/og-image-daily.png, from
 * src/components/DailyEra/DailyEraPreviewCard.vue. Run with
 * `pnpm render:og` after changing the card, and commit the PNG: the card
 * and this script are its source, the PNG is what ships.
 *
 * Starts Vite on scripts/og/daily-era.html and screenshots the card in
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
const OUT = fileURLToPath(new URL('../public/og-image-daily.png', import.meta.url));

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
    const url = new URL('scripts/og/daily-era.html', server.resolvedUrls.local[0]).href;

    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.goto(url);
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
    if (!interLoaded) throw new Error('Inter did not load; the image would use a fallback font');

    await card.screenshot({ path: OUT, animations: 'disabled' });
    console.log(`Wrote ${OUT}`);
} catch (err) {
    console.error(err);
    process.exitCode = 1;
} finally {
    await browser?.close();
    await server.close();
}
