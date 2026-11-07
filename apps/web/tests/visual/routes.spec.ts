import { test, expect, type Page } from '@playwright/test';
import gameSummaryFixture from './fixtures/game-summary.json' with { type: 'json' };
import publicTeamFixture from './fixtures/public-team.json' with { type: 'json' };
import liveStandings from '../fixtures/liveData/standings.json' with { type: 'json' };
import liveSchedule from '../fixtures/liveData/schedule.json' with { type: 'json' };
import liveHeadshots from '../fixtures/liveData/headshots.json' with { type: 'json' };
import liveInjuries from '../fixtures/liveData/injuries.json' with { type: 'json' };
import teamSeasonsIndex from '../fixtures/liveData/team-seasons-index.json' with { type: 'json' };
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
    // Dated 2026-10-26, so it's stale (no badges) unless a test fixes the clock.
    'injuries.json': liveInjuries,
    // live/team-seasons/index.json; current.json 404s, as before opening night.
    'index.json': teamSeasonsIndex,
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

test('teambuilder card shows a cached injury with ESPN cut', async ({ page }) => {
    // An hour after the fixture's generatedAt, inside its 12-hour window.
    await page.clock.setFixedTime(new Date('2026-10-26T13:00:00Z'));
    await stubNetwork(page);
    await cutEspn(page);
    // Registered after stubNetwork, so it wins for this team.
    await page.route('**/api/teams/public/injury-team', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ...publicTeamFixture,
                data: {
                    ...publicTeamFixture.data,
                    teamUUID: 'injury-team',
                    title: 'Injury Check',
                    playerCount: 1,
                    roster: [
                        {
                            slot: 1,
                            player: {
                                id: 'jamesle01',
                                fullName: 'LeBron James',
                                first_name: 'LeBron',
                                last_name: 'James',
                                position: 'SF',
                                team: { full_name: 'Los Angeles Lakers', abbreviation: 'LAL' },
                            },
                        },
                    ],
                },
            }),
        }),
    );
    await page.goto('/teambuilder?remix=injury-team');
    await settle(page);

    const badge = page.locator('.injury-badge').first();
    await expect(badge).toBeVisible();
    // Not getByText('Out'): the badge also holds a screen-reader prefix.
    await expect(badge).toContainText('Out');
    const card = page.locator('.player-card-wrapper').first();
    await expect(card).toHaveScreenshot('teambuilder-injury-card.png');

    await card.locator('.main-content').click();
    await expect(card.locator('.injury-notice')).toBeVisible();
    await expect(card).toHaveScreenshot('teambuilder-injury-card-back.png');
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

test('real-team picker with a season chosen', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/teambuilder');
    await settle(page);
    await page.getByTestId('real-team-button').click();
    await page.getByTestId('real-team-franchise').click();
    await page.getByRole('option', { name: 'Chicago Bulls' }).click();
    await page.getByTestId('real-team-season').filter({ hasText: '1996-97' }).click();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toHaveScreenshot('dialog-real-team.png');
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

// The 3D view at ?view=3d (#286). WebGL output differs by GPU, so these check
// behaviour, not pixels.
test.describe('3D team scene', () => {
    const renders = (page: Page) =>
        page.locator('[role="img"][data-render-count]').evaluate((el) => Number(el.getAttribute('data-render-count')));
    const memory = (page: Page) =>
        // Null until the lazy 3D chunk has loaded and set the probe.
        page.evaluate(
            () =>
                (window as unknown as { __scene3dInfo?: () => { geometries: number; textures: number; canvases: number } })
                    .__scene3dInfo?.() ?? null,
        );

    test('renders a frame without errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
        page.on('pageerror', (error) => errors.push(error.message));
        await stubNetwork(page);
        await page.goto('/t/visual-team?view=3d');
        await expect.poll(() => renders(page), { timeout: 15000 }).toBeGreaterThanOrEqual(1);
        // The fixture's five starters, coach and GM, each with a name chip.
        await expect(page.getByTestId('name-chip')).toHaveCount(7, { timeout: 20000 });
        expect(errors).toEqual([]);
    });

    // #289: the share card's 3D team photo is drawn into an sRGB render target.
    // A plain one would read back linear, too dark: mid grey comes out near 55.
    test('offscreen render target writes sRGB', async ({ page }) => {
        test.setTimeout(120000);
        await stubNetwork(page);
        await page.goto('/t/visual-team');
        const pixel = await page.evaluate(async () => {
            const { getSharedRenderer } = await import('/src/three/renderer/shared.ts');
            const { renderToImageData, solidColourProbe } = await import('/src/three/renderer/offscreen.ts');
            const { scene, camera } = solidColourProbe('#808080');
            const image = renderToImageData(getSharedRenderer(), scene, camera, 64, 64);
            const i = (32 * 64 + 32) * 4;
            return Array.from(image.data.slice(i, i + 3));
        });
        for (const channel of pixel) expect(Math.abs(channel - 128)).toBeLessThanOrEqual(3);
    });

    test('3D share card renders under 2 MB', async ({ page }, testInfo) => {
        test.setTimeout(120000);
        await stubNetwork(page);
        await page.goto('/t/visual-team');
        const result = await page.evaluate(async (team) => {
            const { renderTeamCard } = await import('/src/composables/teamCard.ts');
            const { toShareCardProps } = await import('/src/composables/useShareCard.ts');
            const { scenePeople } = await import('/src/components/scene3d/people.ts');
            const starters = team.roster.filter((entry) => entry.slot >= 1 && entry.slot <= 5).sort((a, b) => a.slot - b.slot);
            const card = toShareCardProps({
                title: team.title,
                city: team.city,
                country: team.country,
                logoUrl: team.logoUrl,
                jerseyUrl: team.jerseyUrl,
                username: team.username,
                roster: team.roster,
                arena: team.arena,
            } as never);
            const photo = {
                court: null,
                capacity: null,
                people: scenePeople(starters as never, { coach: team.coach, gm: team.gm } as never),
                jerseyUrl: team.jerseyUrl || undefined,
                teamName: team.title,
            };
            const { png, rendered } = await renderTeamCard('3d', card, photo, { timeoutMs: 60000 });
            if (!png) return { rendered, png: null, mean: 0, spread: 0 };
            // The photo band: under the header, above the name strip.
            const image = new Image();
            image.src = `data:image/png;base64,${png}`;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = 1200;
            canvas.height = 630;
            const context = canvas.getContext('2d')!;
            context.drawImage(image, 0, 0);
            const { data } = context.getImageData(0, 220, 1200, 180);
            const lumas: number[] = [];
            for (let i = 0; i < data.length; i += 4) lumas.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
            const mean = lumas.reduce((a, b) => a + b, 0) / lumas.length;
            const spread = Math.sqrt(lumas.reduce((a, b) => a + (b - mean) ** 2, 0) / lumas.length);
            return { rendered, png, mean, spread };
        }, publicTeamFixture.data);

        expect(result.rendered).toBe('3d');
        const bytes = Buffer.from(result.png!, 'base64');
        await testInfo.attach('3d-share-card', { body: bytes, contentType: 'image/png' });
        expect(bytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        expect(bytes.length).toBeLessThan(2 * 1024 * 1024);
        // Not near-black: the background alone is luma ~12.
        expect(result.mean).toBeGreaterThan(20);
        // Something was drawn, not a flat fill.
        expect(result.spread).toBeGreaterThan(10);
    });

    test('toggling five times keeps one canvas and steady memory', async ({ page }) => {
        // Seven characters are rebuilt on each open, under software WebGL here.
        test.setTimeout(120000);
        await stubNetwork(page);
        // The arena lands after the court is rasterised, a beat after the first
        // frame, so wait for its geometry before comparing.
        const arenaReady = async () => {
            await expect.poll(async () => (await memory(page))?.geometries ?? 0, { timeout: 15000 }).toBeGreaterThan(0);
            // People arrive after the arena; all seven chips mean all are placed.
            await expect(page.getByTestId('name-chip')).toHaveCount(7, { timeout: 20000 });
        };
        await page.goto('/t/visual-team?view=3d');
        await arenaReady();
        const first = await memory(page);
        for (let i = 0; i < 5; i++) {
            await page.getByTestId('view-3d-button').click();
            await expect(page.getByTestId('scene3d-section')).toHaveCount(0);
            await page.getByTestId('view-3d-button').click();
            await arenaReady();
        }
        await expect.poll(() => memory(page)).toEqual(first);
        expect(first?.canvases).toBe(1);
    });

    test('the wheel and vertical swipes over the scene scroll the page', async ({ page }) => {
        await stubNetwork(page);
        await page.goto('/t/visual-team?view=3d');
        await expect.poll(() => renders(page), { timeout: 15000 }).toBeGreaterThanOrEqual(1);
        const canvas = page.locator('[role="img"] canvas');
        await expect(canvas).toHaveCSS('touch-action', 'pan-y');
        const box = (await canvas.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, 300);
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    });

    test('context loss shows paused and recovers', async ({ page }) => {
        await stubNetwork(page);
        await page.goto('/t/visual-team?view=3d');
        await expect.poll(() => renders(page), { timeout: 15000 }).toBeGreaterThanOrEqual(1);
        // A lost context returns null from getExtension, so the extension is
        // kept from before the loss.
        type Probe = { __loseContext?: WEBGL_lose_context | null };
        const lose = (method: 'loseContext' | 'restoreContext') =>
            page.evaluate((m) => {
                const probe = window as unknown as Probe;
                if (!probe.__loseContext) {
                    const canvas = document.querySelector('[role="img"] canvas') as HTMLCanvasElement;
                    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
                    probe.__loseContext = gl?.getExtension('WEBGL_lose_context');
                }
                probe.__loseContext?.[m]();
            }, method);
        await lose('loseContext');
        await expect(page.getByText('3D view paused')).toBeVisible();
        const before = await renders(page);
        await lose('restoreContext');
        await expect(page.getByText('3D view paused')).toHaveCount(0);
        // A restored context recompiles every shader, slow under software WebGL.
        await expect.poll(() => renders(page), { timeout: 20000 }).toBeGreaterThan(before);
    });

    // "View in 3D" from the builder (#288): a sheet over the builder, for the
    // team as it is being edited.
    const sheet = (page: Page) => page.getByRole('dialog', { name: /in 3D/ });
    const openBuilder = async (page: Page) => {
        await stubNetwork(page);
        // The fixture was made for the public page, which needs only fullName;
        // the builder's cards also read first_name and last_name, as every
        // real player has. Registered after stubNetwork, so it wins.
        await page.route('**/api/teams/public/visual-team', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ...publicTeamFixture,
                    data: {
                        ...publicTeamFixture.data,
                        roster: publicTeamFixture.data.roster.map((entry) => {
                            const [first, ...rest] = entry.player.fullName.split(' ');
                            return { ...entry, player: { ...entry.player, first_name: first, last_name: rest.join(' ') } };
                        }),
                    },
                }),
            }),
        );
        await page.goto('/teambuilder?remix=visual-team');
        await settle(page);
    };

    test('builder: opens over the builder and closes back to the button', async ({ page }) => {
        await openBuilder(page);
        const button = page.getByTestId('view-3d-button');
        await button.scrollIntoViewIfNeeded();
        const scrollY = await page.evaluate(() => window.scrollY);
        const url = page.url();
        await button.click();
        await expect(sheet(page)).toBeVisible();
        await expect.poll(() => renders(page), { timeout: 15000 }).toBeGreaterThanOrEqual(1);
        await expect(page.getByTestId('name-chip')).toHaveCount(7, { timeout: 20000 });
        await page.keyboard.press('Escape');
        await expect(sheet(page)).toHaveCount(0);
        await expect(page.locator('[role="img"] canvas')).toHaveCount(0);
        await expect(button).toBeFocused();
        expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
        expect(page.url()).toBe(url);
    });

    test('builder: reflects an unsaved roster change', async ({ page }) => {
        await openBuilder(page);
        await page.locator('.player-card-wrapper').first().locator('button.text-destructive-strong').click();
        await page.getByTestId('view-3d-button').click();
        await expect(page.getByTestId('name-chip')).toHaveCount(6, { timeout: 20000 });
    });

    test('builder: usable at 390px', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openBuilder(page);
        const header = page.locator('.section-header').first();
        expect(await header.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
        await page.getByTestId('view-3d-button').click();
        const dialog = sheet(page);
        await expect(dialog).toBeVisible();
        expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(390);
        expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
        await expect(page.getByTestId('name-chip')).toHaveCount(7, { timeout: 20000 });
        for (const name of ['Team photo', 'Courtside', 'Broadcast', 'Rafters']) {
            await expect(dialog.getByRole('button', { name })).toBeVisible();
        }
        const before = await renders(page);
        await dialog.getByRole('button', { name: 'Broadcast' }).click();
        await expect.poll(() => renders(page)).toBeGreaterThan(before);
    });
});

