import { test, expect, type Page } from '@playwright/test';
import gameSummaryFixture from './fixtures/game-summary.json' with { type: 'json' };
import publicTeamFixture from './fixtures/public-team.json' with { type: 'json' };
import liveStandings from '../fixtures/liveData/standings.json' with { type: 'json' };
import liveSchedule from '../fixtures/liveData/schedule.json' with { type: 'json' };
import liveHeadshots from '../fixtures/liveData/headshots.json' with { type: 'json' };
import { DAILY_ERA_FIRST_DATE } from '../../src/constants/dailyEra';
import { picks, puzzleView, result as capFiveResult } from '../helpers/capFive';

/**
 * One screenshot per route, plus the overlay surfaces that the global
 * `[role="dialog"]` rules used to distort.
 *
 * These routes read live data (ESPN news and leaders from the browser, scores
 * and box scores through /api/scores/*), so it would make every snapshot
 * differ run to run. The network is stubbed with fixed responses; the point
 * of the suite is layout, not content.
 */

const ESPN = 'https://site.api.espn.com/**';
const ESPN_IMAGES = 'https://a.espncdn.com/**';
const LIVE_FILES: Record<string, unknown> = {
    'standings.json': liveStandings,
    'schedule.json': liveSchedule,
    'headshots.json': liveHeadshots,
};
// Arena photos are hotlinked Wikimedia thumbnails. A fixed grey pixel keeps
// the arena tile's layout in the shot without depending on the live image.
const WIKIMEDIA = 'https://*.wikimedia.org/**';
const GREY_PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNoAAAAggCBd81ytgAAAABJRU5ErkJggg==',
    'base64',
);

const DAILY_ERA_HIT = {
    success: true,
    data: {
        hit: true,
        direction: null,
        band: null,
        answer: {
            runLabel: '1995-96 – 1998-99',
            teamName: 'Vancouver Grizzlies',
            franchise: 'MEM',
            shownIdentity: {
                franchise: 'MEM',
                name: 'Vancouver Grizzlies 1995-2000 Home and Road Jersey',
                startYear: 1996,
                mediaId: '31d308_d7be6e06a283493ea15be25ca7e6bd3a',
            },
        },
    },
};

async function stubNetwork(page: Page) {
    await page.route(WIKIMEDIA, (route) =>
        route.fulfill({ status: 200, contentType: 'image/png', body: GREY_PIXEL }),
    );
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
    // Playwright runs routes in the reverse order of registration, so these
    // have to come after the catch-all above to actually take priority over it.
    await page.route('**/api/scores/**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ events: [] }),
        }),
    );
    await page.route('**/api/teams/public/**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(publicTeamFixture),
        }),
    );
    // Daily Era: the same puzzle for every date, numbered by that date as the
    // API does, and every guess is a hit (DAILY_ERA_HIT).
    await page.route('**/api/daily/era/**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(
                route.request().method() === 'POST'
                    ? DAILY_ERA_HIT
                    : {
                          success: true,
                          data: {
                              // Both bare YYYY-MM-DD, so both parse as UTC midnight.
                              puzzleNumber:
                                  Math.round(
                                      (Date.parse(new URL(route.request().url()).pathname.split('/').at(-1)!) -
                                          Date.parse(DAILY_ERA_FIRST_DATE)) /
                                          86_400_000,
                                  ) + 1,
                              puzzleId: 'visual',
                              imageUrl: 'https://visual.invalid/daily-era/visual.webp',
                          },
                      },
            ),
        }),
    );
    // Cap Five: the same pool for every date, and a fixed 412 of 415 reveal.
    await page.route('**/api/daily/cap-five/**', (route) => {
        const date = new URL(route.request().url()).pathname.split('/').at(-1)!;
        const isSubmit = route.request().method() === 'POST';
        const submitted = isSubmit ? (route.request().postDataJSON() as { date: string }).date : date;
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                data: isSubmit ? capFiveResult({ date: submitted }) : { ...puzzleView, date },
            }),
        });
    });
    await page.route('https://visual.invalid/**', (route) =>
        route.fulfill({ status: 200, contentType: 'image/png', body: GREY_PIXEL }),
    );
    // The season files setSeasonContextData writes to the assets CDN.
    await page.route('https://d2s6ea2hcvgd9x.cloudfront.net/live/**', (route) => {
        const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
        if (name.endsWith('.png')) {
            return route.fulfill({ status: 200, contentType: 'image/png', body: GREY_PIXEL });
        }
        const file = LIVE_FILES[name];
        return file
            ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(file) })
            : route.fulfill({ status: 404, body: '' });
    });
}

/** ESPN unreachable: the page has to work from the cached files alone. */
async function cutEspn(page: Page) {
    // Registered after stubNetwork, so these win over its ESPN stub.
    await page.route(ESPN, (route) => route.abort());
    await page.route(ESPN_IMAGES, (route) => route.abort());
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
    // Before the fixture's first tip-off in every US zone, or Next goes blank;
    // offline proves the page needs nothing from ESPN.
    { path: '/standings', name: 'standings', clock: '2026-10-26T08:00:00', offline: true },
    // Fixed, or the archive's dates would change the screenshot every day.
    { path: '/daily', name: 'daily', clock: '2026-11-06T20:00:00' },
    { path: '/cap-five', name: 'cap-five', clock: '2026-11-06T20:00:00' },
    { path: '/teams', name: 'teams' },
    { path: '/login', name: 'login' },
    { path: '/sign-up', name: 'sign-up' },
    { path: '/t/visual-team', name: 'public-team' },
    { path: '/data-deleted', name: 'data-deleted' },
    { path: '/no-such-page', name: 'not-found' },
];

for (const { path, name, clock, offline } of ROUTES) {
    test(`route ${name}`, async ({ page }) => {
        if (clock) await page.clock.setFixedTime(new Date(clock));
        await stubNetwork(page);
        if (offline) await cutEspn(page);
        await page.goto(path);
        await settle(page);
        await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
    });
}

test('daily reveal', async ({ page }) => {
    // Before the reveal's countdown is rendered, so it reads the same every run.
    await page.clock.setFixedTime(new Date('2026-11-06T20:00:00'));
    await stubNetwork(page);
    // The reveal shows the bundled jersey art from the assets CDN.
    await page.route('https://d2s6ea2hcvgd9x.cloudfront.net/**', (route) =>
        route.fulfill({ status: 200, contentType: 'image/png', body: GREY_PIXEL }),
    );
    await page.goto('/daily');
    await page.getByTestId('guess-button').waitFor();
    // Nine decades must wrap rather than scroll the page sideways on a phone.
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByText('1990s', { exact: true }).click();
    await page.getByRole('button', { name: '1995-96', exact: true }).click();
    await page.getByTestId('guess-button').click();
    await page.getByText('Got it in 1/4').waitFor();
    await page.getByTestId('share-copy').waitFor();
    // The clicks scrolled the page, and a full-page shot taken mid-scroll
    // paints the sticky header halfway down.
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page);
    await expect(page).toHaveScreenshot('daily-reveal.png', { fullPage: true });
});

test('cap-five result', async ({ page }) => {
    // Before the countdown is rendered, so it reads the same every run.
    await page.clock.setFixedTime(new Date('2026-11-06T20:00:00'));
    await stubNetwork(page);
    await page.goto('/cap-five');
    await page.getByTestId('lock-in-button').waitFor();
    const names = new Map(puzzleView.candidates.map((c) => [c.id, c.name]));
    for (const id of picks) {
        await page.getByTestId('cap-five-candidate').filter({ hasText: names.get(id)! }).click();
    }
    await page.getByTestId('lock-in-button').click();
    await page.getByText('412 / 415').waitFor();
    await page.getByTestId('share-copy').waitFor();
    // The clicks scrolled the page, and a full-page shot taken mid-scroll
    // paints the sticky header halfway down.
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page);
    await expect(page).toHaveScreenshot('cap-five-result.png', { fullPage: true });
});

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

// #165: App.vue used to fetch team logos on every page load, invoking a
// Lambda that makes 30 ESPN requests, and nothing read the result.
test('no route requests the team-logos endpoint', async ({ page }) => {
    test.setTimeout(90_000);
    await stubNetwork(page);
    const hits: string[] = [];
    await page.route('**/api/data/get-team-logos', (route) => {
        hits.push(route.request().url());
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    for (const { path } of ROUTES) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
    }
    expect(hits).toEqual([]);
});

// #188: TeamBuilderHeader fetched all 30 team logos from ESPN's API on every
// mount. The Current logo tab now reads a bundled JSON instead.
test('/teambuilder requests nothing from ESPN', async ({ page }) => {
    await stubNetwork(page);
    const espn: string[] = [];
    page.on('request', (request) => {
        const { hostname } = new URL(request.url());
        if (/(^|\.)espn(cdn)?\.com$/.test(hostname)) espn.push(request.url());
    });
    await page.goto('/teambuilder', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    expect(espn).toEqual([]);
});

test('/standings requests no ESPN data', async ({ page }) => {
    await stubNetwork(page);
    const espn: string[] = [];
    page.on('request', (request) => {
        const url = new URL(request.url());
        // Team logos are the app's existing ESPN hotlinks; headshots and
        // every API call must come from our CDN.
        if (url.hostname === 'site.api.espn.com') espn.push(request.url());
        if (url.hostname === 'a.espncdn.com' && url.pathname.includes('/headshots/')) espn.push(request.url());
    });
    await page.goto('/standings', { waitUntil: 'domcontentloaded' });
    await page.getByText('Eastern Conference').waitFor();
    expect(espn).toEqual([]);
});

// #263: /scores, its calendar and /game/:id read /api/scores/* instead of
// ESPN's API. Team logos and headshots are still hotlinked from espncdn.com.
const recordScoresRequests = (page: Page) => {
    const espn: string[] = [];
    const scores: string[] = [];
    page.on('request', (request) => {
        const url = new URL(request.url());
        if (/(^|\.)espn\.com$/.test(url.hostname)) espn.push(request.url());
        if (url.pathname.startsWith('/api/scores/')) scores.push(url.pathname);
    });
    return { espn, scores };
};

test("/scores requests nothing from ESPN's API", async ({ page }) => {
    await stubNetwork(page);
    const { espn, scores } = recordScoresRequests(page);
    // Before goto: the onMounted fetch can finish before goto returns.
    const dayRequest = page.waitForRequest('**/api/scores/day/**');
    await page.goto('/scores', { waitUntil: 'domcontentloaded' });
    await dayRequest;

    const monthRequest = page.waitForRequest('**/api/scores/month/**');
    await page.locator('.gameday-container button').click();
    await monthRequest;

    expect(espn).toEqual([]);
    expect(scores.some((path) => path.startsWith('/api/scores/day/'))).toBe(true);
    expect(scores.some((path) => path.startsWith('/api/scores/month/'))).toBe(true);
});

test("/game/:id requests nothing from ESPN's API", async ({ page }) => {
    await stubNetwork(page);
    await page.route('**/api/scores/game/**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(gameSummaryFixture),
        }),
    );
    const { espn, scores } = recordScoresRequests(page);
    await page.goto('/game/401859965', { waitUntil: 'domcontentloaded' });
    // Rendering the fixture's team proves the summary request already happened.
    await page.getByText('New York Knicks').first().waitFor();

    expect(espn).toEqual([]);
    expect(scores).toContain('/api/scores/game/401859965');
});

test('route boxscore', async ({ page }) => {
    // /game/:id was missing from ROUTES entirely - the box score's line
    // score, DNP rows and stat-tab typography all shipped unreviewed
    // because no baseline ever rendered them. The shared scores stub above
    // returns { events: [] }, which is fine for every other route but
    // renders the box score's own empty state - override it with a real
    // captured summary response for this game's specific URL.
    await stubNetwork(page);
    await page.route('**/api/scores/game/**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(gameSummaryFixture),
        }),
    );
    await page.goto('/game/401859965');
    await settle(page);
    await expect(page).toHaveScreenshot('boxscore.png', { fullPage: true });
});

test('route boxscore, team stats and advanced tabs', async ({ page }) => {
    // Team Stats and Advanced only render behind a tab click, so the route
    // screenshot above never exercises them - that's exactly why their
    // typography (and, briefly during this fix, a missing SectionHeading
    // import that silently rendered as an unstyled <sectionheading> tag)
    // went unreviewed. Same fixture as the route boxscore test.
    await stubNetwork(page);
    await page.route('**/api/scores/game/**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(gameSummaryFixture),
        }),
    );
    await page.goto('/game/401859965');
    await settle(page);

    await page.getByRole('tab', { name: /team stats/i }).click();
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('boxscore-team-stats.png', { fullPage: true });

    await page.getByRole('tab', { name: /advanced/i }).click();
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('boxscore-advanced.png', { fullPage: true });
});

test('route boxscore play-by-play big swings', async ({ page }) => {
    // The Big swings filter and its badges only show behind two clicks.
    await stubNetwork(page);
    await page.route('**/api/scores/game/**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(gameSummaryFixture),
        }),
    );
    await page.goto('/game/401859965');
    await settle(page);

    await page.getByRole('tab', { name: /play-by-play/i }).click();
    await page.getByRole('button', { name: /big swings/i }).click();
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('boxscore-big-swings.png', { fullPage: true });
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

// The baselines above run in dark (colorScheme in playwright.config.ts, and
// Theme defaults to System). These are the same surfaces in the light theme.
test.describe('light theme', () => {
    test.use({ colorScheme: 'light' });

    for (const { path, name, clock, offline } of ROUTES) {
        test(`route ${name}`, async ({ page }) => {
            if (clock) await page.clock.setFixedTime(new Date(clock));
            await stubNetwork(page);
            if (offline) await cutEspn(page);
            await page.goto(path);
            await settle(page);
            await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
            await expect(page).toHaveScreenshot(`light-${name}.png`, { fullPage: true });
        });
    }

    test('route boxscore', async ({ page }) => {
        await stubNetwork(page);
        await page.route('**/api/scores/game/**', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(gameSummaryFixture),
            }),
        );
        await page.goto('/game/401859965');
        await settle(page);
        await expect(page).toHaveScreenshot('light-boxscore.png', { fullPage: true });
    });

    test('add player sheet', async ({ page }) => {
        await stubNetwork(page);
        await page.goto('/teambuilder');
        await settle(page);
        await page.getByRole('button', { name: /add player/i }).first().click();
        const sheet = page.locator('[role="dialog"]').first();
        await expect(sheet).toBeVisible();
        await expect(sheet).toHaveScreenshot('light-sheet-add-player.png');
    });
});
