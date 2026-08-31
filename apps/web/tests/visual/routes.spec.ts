import { test, expect, type Page } from '@playwright/test';

/**
 * One screenshot per route, plus the overlay surfaces that the global
 * `[role="dialog"]` rules used to distort.
 *
 * These routes call ESPN directly from the browser, so live data would make
 * every snapshot differ run to run. The network is stubbed with fixed
 * responses; the point of the suite is layout, not content.
 */

const ESPN = 'https://site.api.espn.com/**';

async function stubNetwork(page: Page) {
    await page.route(ESPN, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ events: [], articles: [], leaders: [] }),
        }),
    );
    await page.route('**/api/**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
        }),
    );
}

/** Hides anything whose content is inherently unstable, then waits for paint. */
async function settle(page: Page) {
    // The hero clip would land on a different frame every run. Its stream also
    // means the page never reaches networkidle, so do not wait for that.
    await page.addStyleTag({
        content: `
            video { visibility: hidden !important; }
            .typewriter, [data-testid="typewriter"] { visibility: hidden !important; }
            *, *::before, *::after { transition: none !important; animation: none !important; }
        `,
    });
    await page.waitForLoadState('load');
    await page.evaluate(() => document.fonts.ready);
    // Vue renders after mount; one frame is enough once fonts have resolved.
    await page.waitForTimeout(300);
}

const ROUTES = [
    { path: '/', name: 'home' },
    { path: '/teambuilder', name: 'teambuilder' },
    { path: '/scores', name: 'scores' },
    { path: '/news', name: 'news' },
    { path: '/teams', name: 'teams' },
    { path: '/login', name: 'login' },
    { path: '/sign-up', name: 'sign-up' },
];

for (const { path, name } of ROUTES) {
    test(`route ${name}`, async ({ page }) => {
        await stubNetwork(page);
        await page.goto(path);
        await settle(page);
        await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
    });
}

test('page shell width is consistent across routes', async ({ page }) => {
    // Visits every route in one test, so it needs more than the per-test default.
    test.setTimeout(90_000);
    await stubNetwork(page);
    const widths = new Map<string, string>();

    for (const { path, name } of ROUTES) {
        // domcontentloaded, not load: the hero video keeps load pending.
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(200);
        // Read the DOM directly: a locator would retry for its full timeout on
        // the routes that legitimately have no shell (home and the auth pages).
        const max = await page.evaluate(() => {
            const el = document.querySelector('.page-shell');
            return el ? getComputedStyle(el).maxWidth : null;
        });
        if (max) widths.set(name, max);
    }

    // Every shell must resolve to one of the two container tokens, never to a
    // width a view invented for itself.
    const allowed = new Set(['1440px', '1200px', 'none']);
    for (const [route, width] of widths) {
        expect(allowed, `${route} uses an off-system container width`).toContain(width);
    }
});

test('no Tailwind class on a rendered page failed to compile', async ({ page }) => {
    test.setTimeout(90_000);
    await stubNetwork(page);
    for (const { path } of ROUTES) {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(200);
        const dead = await page.evaluate(() =>
            [...document.querySelectorAll('[class]')]
                .flatMap((el) => [...el.classList])
                .filter((c) => /-\d*\.?\d+rem$/.test(c) && !c.includes('[')),
        );
        expect(dead, `${path} has classes that emit no CSS`).toEqual([]);
    }
});

test('dialog and popover do not share modal sizing', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/teambuilder');
    await settle(page);

    await page.getByRole('button', { name: /add player/i }).first().click();
    const sheet = page.locator('[role="dialog"]').first();
    await expect(sheet).toBeVisible();

    // A control inside an overlay keeps its own variant metrics. The global
    // rule this replaced forced 0.75rem/2rem onto every button in a dialog.
    const padding = await sheet
        .getByRole('button')
        .first()
        .evaluate((el) => getComputedStyle(el).padding);
    expect(padding).not.toBe('12px 32px');

    await expect(sheet).toHaveScreenshot('sheet-add-player.png');
});
