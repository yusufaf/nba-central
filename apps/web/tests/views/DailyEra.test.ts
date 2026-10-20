import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';

vi.mock('@/network/api', () => ({
    dailyEraApi: { getPuzzle: vi.fn(), guess: vi.fn() },
}));
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
// No real crop fetch or html-to-image render from the share block.
vi.mock('@/components/DailyEra/dailyEraCard', () => ({
    renderDailyEraCard: vi.fn(async () => new Blob(['x'], { type: 'image/png' })),
}));

import { dailyEraApi } from '@/network/api';
import DailyEra from '@/views/DailyEra.vue';
import DailyEraShare from '@/components/DailyEra/DailyEraShare.vue';
import { dailyEraPuzzleNumber, readDailyEraGame, writeDailyEraGame, type DailyEraGuess } from '@/utils/dailyEra';

const puzzleFor = (day: string) => {
    const n = dailyEraPuzzleNumber(day);
    return { puzzleNumber: n, puzzleId: `p${n}`, imageUrl: `https://cdn/daily-era/p${n}.webp` };
};
const puzzle = puzzleFor('2026-11-06');
const answer = {
    runLabel: '2002-03 – 2004-05',
    teamName: 'New Jersey Nets',
    franchise: 'BRK',
    shownIdentity: { franchise: 'BRK', name: 'Nets', startYear: 2003, mediaId: 'unknown' },
};

const getPuzzle = vi.mocked(dailyEraApi.getPuzzle);
const guessApi = vi.mocked(dailyEraApi.guess);

let wrapper: VueWrapper | null = null;
let router: Router;

const mountPage = async (path = '/daily') => {
    router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/daily', name: 'dailyEra', component: DailyEra },
            { path: '/teambuilder', component: { template: '<div />' } },
        ],
    });
    await router.push(path);
    await router.isReady();
    wrapper = mount(DailyEra, {
        global: {
            plugins: [router],
            stubs: { PageShell: { template: '<div><slot /></div>' }, RouterLink: RouterLinkStub },
        },
    });
    await flushPromises();
    return wrapper;
};

const clickText = async (w: VueWrapper, text: string) => {
    const button = w.findAll('button').find((b) => b.text() === text);
    if (!button) throw new Error(`No button "${text}"`);
    await button.trigger('click');
    await flushPromises();
};

const missGuess: DailyEraGuess = { season: 1960, hit: false, direction: 'later', band: 'far' };
const hitGuess: DailyEraGuess = { season: 1996, hit: true, direction: null, band: null };
const lostGuesses = [1960, 1970, 1980, 1990].map((season) => ({ ...missGuess, season }));
const seed = (day: string, guesses: DailyEraGuess[], archive = false) =>
    writeDailyEraGame(day, {
        puzzleId: puzzleFor(day).puzzleId,
        puzzleNumber: puzzleFor(day).puzzleNumber,
        guesses,
        answer: guesses.at(-1)?.hit || guesses.length === 4 ? answer : null,
        archive,
    });

const winOneGuess = async (w: VueWrapper) => {
    guessApi.mockResolvedValueOnce({ success: true, data: { hit: true, direction: null, band: null, answer } });
    await clickText(w, '1990s');
    await clickText(w, '1995-96');
    await w.find('[data-testid="guess-button"]').trigger('click');
    await flushPromises();
};

const statText = (w: VueWrapper, name: string) => w.find(`[data-testid="stat-${name}"]`).text();
const archiveLinks = (w: VueWrapper) =>
    w.findAllComponents(RouterLinkStub).filter((l) => l.attributes('data-testid') === 'archive-day');
const todayLink = (w: VueWrapper) => w.find('[data-testid="today-link"]');

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.setSystemTime(new Date(2026, 10, 6, 12));
    getPuzzle.mockImplementation(async (day: string) => ({ success: true, data: puzzleFor(day) }));
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('DailyEra view', () => {
    it("loads today's puzzle", async () => {
        const w = await mountPage();
        expect(getPuzzle).toHaveBeenCalledWith('2026-11-06');
        expect(todayLink(w).exists()).toBe(false);
        expect(w.text()).toContain('Daily #33');
        expect(w.find('img[alt="Today\'s mystery jersey"]').attributes('src')).toBe(puzzle.imageUrl);
        expect(w.find('[data-testid="guess-button"]').attributes('disabled')).toBeDefined();
    });

    it('plays a miss then a hit through to the reveal', async () => {
        const w = await mountPage();
        guessApi
            .mockResolvedValueOnce({ success: true, data: { hit: false, direction: 'later', band: 'near' } })
            .mockResolvedValueOnce({ success: true, data: { hit: true, direction: null, band: null, answer } });

        await clickText(w, '1990s');
        await clickText(w, '1995-96');
        expect(w.find('[data-testid="guess-button"]').text()).toBe('Guess 1995-96');
        await w.find('[data-testid="guess-button"]').trigger('click');
        await flushPromises();

        const rows = w.findAll('[data-testid="guess-row"]');
        expect(rows).toHaveLength(1);
        expect(rows[0]!.text()).toContain('1995-96');
        expect(rows[0]!.text()).toContain('Within 10 seasons');
        expect(rows[0]!.text()).toContain('Later');
        expect(w.findAll('[data-testid="guess-slot"]')).toHaveLength(3);
        expect(w.text()).toContain('3 of 4 guesses left');
        expect(w.find('[data-testid="guess-button"]').text()).toBe('Pick a season');

        await clickText(w, '2000s');
        await clickText(w, '2003-04');
        await w.find('[data-testid="guess-button"]').trigger('click');
        await flushPromises();

        expect(guessApi).toHaveBeenLastCalledWith({ puzzleId: 'p33', season: 2004, attempt: 2 });
        expect(w.text()).toContain('Got it in 2/4');
        expect(w.text()).toContain('2002-03 – 2004-05');
        expect(w.text()).toContain('New Jersey Nets');
        expect(w.find('[data-testid="guess-button"]').exists()).toBe(false);
    });

    it('keeps the pick after a failed guess so a retry is one tap', async () => {
        vi.spyOn(console, 'error').mockImplementationOnce(() => {});
        const w = await mountPage();
        guessApi
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce({ success: true, data: { hit: false, direction: 'later', band: 'far' } });
        await clickText(w, '1985-86');
        await w.find('[data-testid="guess-button"]').trigger('click');
        await flushPromises();
        expect(w.find('[data-testid="guess-button"]').text()).toBe('Guess 1985-86');

        await w.find('[data-testid="guess-button"]').trigger('click');
        await flushPromises();
        expect(w.findAll('[data-testid="guess-row"]')).toHaveLength(1);
        expect(w.find('[data-testid="guess-button"]').text()).toBe('Pick a season');
    });

    it('says there is no puzzle on a 410', async () => {
        getPuzzle.mockRejectedValueOnce({ response: { status: 410 } });
        const w = await mountPage();
        expect(w.text()).toContain('No puzzle today. Check back tomorrow.');
    });

    it('retries after a failed load', async () => {
        vi.spyOn(console, 'error').mockImplementationOnce(() => {});
        getPuzzle.mockRejectedValueOnce({ response: { status: 500 } });
        const w = await mountPage();
        expect(w.text()).toContain("Couldn't load today's puzzle.");
        await clickText(w, 'Try again');
        expect(getPuzzle).toHaveBeenCalledTimes(2);
        expect(w.text()).toContain('Daily #33');
    });

    it('stops a puzzle that expired mid-game', async () => {
        const w = await mountPage();
        guessApi.mockRejectedValueOnce({ response: { status: 410 } });
        await clickText(w, '1985-86');
        await w.find('[data-testid="guess-button"]').trigger('click');
        await flushPromises();

        expect(w.text()).toContain('This puzzle is no longer playable.');
        expect(w.find('[aria-label="Decade"]').exists()).toBe(false);
        await clickText(w, "Play today's puzzle");
        expect(getPuzzle).toHaveBeenCalledTimes(2);
    });
});

describe('DailyEra streaks', () => {
    it('keeps the streak across a reload', async () => {
        seed('2026-11-04', [hitGuess]);
        seed('2026-11-05', [hitGuess]);
        const w = await mountPage();
        await winOneGuess(w);
        expect(statText(w, 'streak')).toBe('3');
        expect(statText(w, 'best')).toBe('3');

        w.unmount();
        guessApi.mockClear();
        const again = await mountPage();
        expect(again.text()).toContain('Got it in 1/4');
        expect(guessApi).not.toHaveBeenCalled();
        expect(statText(again, 'streak')).toBe('3');
    });

    it('resets the streak after a missed day', async () => {
        seed('2026-11-04', [hitGuess]);
        const w = await mountPage();
        await winOneGuess(w);
        expect(statText(w, 'streak')).toBe('1');
    });
});

describe('DailyEra archive', () => {
    it('lists the 30 days before today with their results', async () => {
        seed('2026-11-05', [missGuess, hitGuess]);
        seed('2026-11-04', lostGuesses);
        seed('2026-11-03', [missGuess]);
        const w = await mountPage();

        const links = archiveLinks(w);
        expect(links).toHaveLength(30);
        expect(links[0]!.props('to')).toEqual({ name: 'dailyEra', query: { date: '2026-11-05' } });
        expect(links.at(-1)!.props('to')).toEqual({ name: 'dailyEra', query: { date: '2026-10-07' } });
        expect(links[0]!.text()).toContain('#32');
        expect(links.at(-1)!.text()).toContain('#3');
        expect(links[0]!.text()).toContain('Solved 2/4');
        expect(links[1]!.text()).toContain('Missed');
        expect(links[2]!.text()).toContain('In progress');
        expect(links[3]!.text()).toContain('Play');
    });

    it('plays an archive date from the query', async () => {
        const w = await mountPage('/daily?date=2026-11-01');
        expect(getPuzzle).toHaveBeenCalledWith('2026-11-01');
        expect(w.text()).toContain('Daily #28');
        expect(w.text()).toContain('Nov 1, 2026');
        expect(todayLink(w).exists()).toBe(true);

        await winOneGuess(w);
        expect(w.find('[aria-labelledby="daily-era-stats-heading"]').text()).toContain(
            "Archive games don't count toward your streak.",
        );
        expect(statText(w, 'streak')).toBe('0');

        await clickText(w, "Play today's puzzle");
        expect(router.currentRoute.value.query.date).toBeUndefined();
        expect(getPuzzle).toHaveBeenLastCalledWith('2026-11-06');
    });

    it("links back to today's puzzle mid-game", async () => {
        const w = await mountPage('/daily?date=2026-11-01');
        const link = w.findAllComponents(RouterLinkStub).find((l) => l.attributes('data-testid') === 'today-link');
        expect(link?.props('to')).toEqual({ name: 'dailyEra' });
    });

    it("goes to the new day's puzzle once a game runs past midnight", async () => {
        vi.setSystemTime(new Date(2026, 10, 6, 23, 59));
        const w = await mountPage();
        vi.setSystemTime(new Date(2026, 10, 7, 0, 1));
        await winOneGuess(w);
        expect(readDailyEraGame('2026-11-06')?.archive).toBe(true);
        const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
        const focus = vi.spyOn(HTMLElement.prototype, 'focus');

        await todayLink(w).trigger('click');
        await flushPromises();
        expect(getPuzzle).toHaveBeenLastCalledWith('2026-11-07');
        expect(todayLink(w).exists()).toBe(false);
        expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
        expect(focus.mock.contexts.at(-1)?.textContent).toBe('Which Era?');
    });

    it.each(['junk', '2026-11-06', '2026-11-07', '2026-10-06'])(
        'rewrites the unplayable date %s to today',
        async (date) => {
            const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
            await mountPage(`/daily?date=${date}`);
            expect(router.currentRoute.value.query.date).toBeUndefined();
            expect(getPuzzle).toHaveBeenCalledTimes(1);
            expect(getPuzzle).toHaveBeenCalledWith('2026-11-06');
            // Still the first load, so the page isn't scrolled or focused.
            expect(scrollTo).not.toHaveBeenCalled();
        },
    );

    it('switches games when the query changes and scrolls back up', async () => {
        const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
        await mountPage();
        expect(scrollTo).not.toHaveBeenCalled();

        await router.push('/daily?date=2026-11-03');
        await flushPromises();
        expect(getPuzzle).toHaveBeenLastCalledWith('2026-11-03');
        expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    });

    it('shows the stored result of a played archive date', async () => {
        seed('2026-11-02', lostGuesses);
        const w = await mountPage('/daily?date=2026-11-02');
        expect(w.text()).toContain('Out of guesses');
        expect(w.find('[data-testid="guess-button"]').exists()).toBe(false);
        expect(guessApi).not.toHaveBeenCalled();
    });

    it("keeps stored results when today's puzzle is unavailable", async () => {
        seed('2026-11-05', [missGuess, hitGuess]);
        getPuzzle.mockResolvedValueOnce({ success: false, error: 'nope' });
        const w = await mountPage();
        expect(w.text()).toContain('No puzzle today');
        expect(archiveLinks(w)[0]!.text()).toContain('Solved 2/4');
    });
});

describe('DailyEra share', () => {
    const shareProps = (w: VueWrapper) => w.findComponent(DailyEraShare).props();

    it("offers today's finished game with the streak", async () => {
        seed('2026-11-05', [hitGuess]);
        const w = await mountPage();
        expect(w.find('[data-testid="share-copy"]').exists()).toBe(false);

        await winOneGuess(w);
        expect(w.find('[data-testid="share-copy"]').exists()).toBe(true);
        expect(shareProps(w)).toMatchObject({ puzzleNumber: 33, date: '2026-11-06', archive: false, streak: 2 });
    });

    it('shares a finished archive game with its date and no streak', async () => {
        seed('2026-11-06', [hitGuess]);
        seed('2026-11-02', lostGuesses, true);
        const w = await mountPage('/daily?date=2026-11-02');
        expect(shareProps(w)).toMatchObject({ date: '2026-11-02', archive: true, streak: null });
    });

    it('gives an earlier daily game reopened from the archive no streak', async () => {
        seed('2026-11-05', [hitGuess]);
        const w = await mountPage('/daily?date=2026-11-05');
        expect(shareProps(w)).toMatchObject({ archive: true, streak: null });
    });
});
