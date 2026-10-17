import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub, type VueWrapper } from '@vue/test-utils';

vi.mock('@/network/api', () => ({
    dailyEraApi: { getPuzzle: vi.fn(), guess: vi.fn() },
}));
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));

import { dailyEraApi } from '@/network/api';
import DailyEra from '@/views/DailyEra.vue';

const puzzle = { puzzleNumber: 32, puzzleId: 'p32', imageUrl: 'https://cdn/daily-era/p32.webp' };
const answer = {
    runLabel: '2002-03 – 2004-05',
    teamName: 'New Jersey Nets',
    franchise: 'BRK',
    shownIdentity: { franchise: 'BRK', name: 'Nets', startYear: 2003, mediaId: 'unknown' },
};

const getPuzzle = vi.mocked(dailyEraApi.getPuzzle);
const guessApi = vi.mocked(dailyEraApi.guess);

let wrapper: VueWrapper | null = null;

const mountPage = async () => {
    wrapper = mount(DailyEra, {
        global: {
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

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.setSystemTime(new Date(2026, 10, 6, 12));
    getPuzzle.mockResolvedValue({ success: true, data: puzzle });
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.useRealTimers();
});

describe('DailyEra view', () => {
    it("loads today's puzzle", async () => {
        const w = await mountPage();
        expect(getPuzzle).toHaveBeenCalledWith('2026-11-06');
        expect(w.text()).toContain('Daily #32');
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

        expect(guessApi).toHaveBeenLastCalledWith({ puzzleId: 'p32', season: 2004, attempt: 2 });
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
        expect(w.text()).toContain('Daily #32');
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
