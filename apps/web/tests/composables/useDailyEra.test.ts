import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/network/api', () => ({
    dailyEraApi: { getPuzzle: vi.fn(), guess: vi.fn() },
}));
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));

import { toast } from 'vue-sonner';
import { dailyEraApi } from '@/network/api';
import { track } from '@/lib/analytics';
import { useDailyEra } from '@/composables/useDailyEra';
import { readDailyEraGame } from '@/utils/dailyEra';

const DAY = '2026-10-16';
const puzzle = { puzzleNumber: 12, puzzleId: 'p1', imageUrl: 'https://cdn/x.webp' };
const answer = {
    runLabel: '1995-96 – 1998-99',
    teamName: 'Vancouver Grizzlies',
    franchise: 'MEM',
    shownIdentity: { franchise: 'MEM', name: 'Grizzlies', startYear: 1996, mediaId: 'm1' },
};
const miss = (direction: 'earlier' | 'later', band: 'close' | 'near' | 'far', withAnswer = false) => ({
    success: true as const,
    data: { hit: false as const, direction, band, ...(withAnswer ? { answer } : {}) },
});
const hit = { success: true as const, data: { hit: true as const, direction: null, band: null, answer } };

const getPuzzle = vi.mocked(dailyEraApi.getPuzzle);
const guessApi = vi.mocked(dailyEraApi.guess);
const callsTo = (event: string) => vi.mocked(track).mock.calls.filter(([name]) => name === event);

const loaded = async () => {
    const game = useDailyEra();
    await game.load(DAY);
    return game;
};

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getPuzzle.mockResolvedValue({ success: true, data: puzzle });
});

describe('useDailyEra load', () => {
    it("loads the day's puzzle and reports a new view", async () => {
        const game = await loaded();
        expect(getPuzzle).toHaveBeenCalledWith(DAY);
        expect(game.status.value).toBe('playing');
        expect(game.puzzle.value).toEqual(puzzle);
        expect(game.attemptsLeft.value).toBe(4);
        expect(callsTo('daily_era_viewed')).toEqual([
            ['daily_era_viewed', { puzzleNumber: 12, state: 'new' }],
        ]);
    });

    it('maps a 410, a refusal and other failures', async () => {
        getPuzzle.mockRejectedValueOnce({ response: { status: 410 } });
        expect((await loaded()).status.value).toBe('unavailable');

        vi.spyOn(console, 'error').mockImplementationOnce(() => {});
        getPuzzle.mockRejectedValueOnce({ response: { status: 500 } });
        expect((await loaded()).status.value).toBe('error');

        getPuzzle.mockResolvedValueOnce({ success: false, error: 'nope' });
        expect((await loaded()).status.value).toBe('unavailable');
    });
});

describe('useDailyEra guess', () => {
    it('scores a miss then a hit and finishes once', async () => {
        const game = await loaded();
        guessApi.mockResolvedValueOnce(miss('later', 'close')).mockResolvedValueOnce(hit);

        await game.guess(1993);
        expect(game.guesses.value).toEqual([
            { season: 1993, hit: false, direction: 'later', band: 'close' },
        ]);
        expect(game.status.value).toBe('playing');

        await game.guess(1996);
        expect(game.status.value).toBe('won');
        expect(game.answer.value).toEqual(answer);
        expect(guessApi.mock.calls.map(([p]) => p)).toEqual([
            { puzzleId: 'p1', season: 1993, attempt: 1 },
            { puzzleId: 'p1', season: 1996, attempt: 2 },
        ]);
        expect(callsTo('daily_era_guessed')).toEqual([
            ['daily_era_guessed', { puzzleNumber: 12, attempt: 1, hit: false, band: 'close' }],
            ['daily_era_guessed', { puzzleNumber: 12, attempt: 2, hit: true, band: null }],
        ]);
        expect(callsTo('daily_era_finished')).toEqual([
            ['daily_era_finished', { puzzleNumber: 12, solved: true, attempts: 2 }],
        ]);
    });

    it('loses on the 4th miss with the answer from that response', async () => {
        const game = await loaded();
        guessApi
            .mockResolvedValueOnce(miss('later', 'far'))
            .mockResolvedValueOnce(miss('later', 'near'))
            .mockResolvedValueOnce(miss('earlier', 'close'))
            .mockResolvedValueOnce(miss('earlier', 'close', true));
        for (const season of [1960, 1985, 2000, 1999]) await game.guess(season);

        expect(game.status.value).toBe('lost');
        expect(game.answer.value).toEqual(answer);
        expect(game.attemptsLeft.value).toBe(0);
        expect(callsTo('daily_era_finished')).toEqual([
            ['daily_era_finished', { puzzleNumber: 12, solved: false, attempts: 4 }],
        ]);

        await game.guess(1998);
        expect(guessApi).toHaveBeenCalledTimes(4);
    });

    it('keeps the attempt when a guess fails on the network', async () => {
        vi.spyOn(console, 'error').mockImplementationOnce(() => {});
        const game = await loaded();
        guessApi.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(miss('later', 'far'));

        await game.guess(1960);
        expect(toast.error).toHaveBeenCalled();
        expect(game.guesses.value).toEqual([]);
        expect(game.status.value).toBe('playing');

        await game.guess(1960);
        expect(guessApi.mock.calls[1]![0]).toMatchObject({ attempt: 1 });
    });

    it('drops a score that lands after another day was loaded', async () => {
        const game = await loaded();
        let resolve!: (value: unknown) => void;
        guessApi.mockReturnValueOnce(new Promise((r) => (resolve = r)) as never);
        const pending = game.guess(1960);

        getPuzzle.mockResolvedValueOnce({ success: true, data: { ...puzzle, puzzleId: 'p2' } });
        await game.load('2026-10-17');
        resolve(miss('later', 'far'));

        expect(await pending).toBe(false);
        expect(game.guesses.value).toEqual([]);
        expect(game.status.value).toBe('playing');
    });

    it('drops a score that lands after the same day was reloaded, and frees the picker', async () => {
        const game = await loaded();
        let resolve!: (value: unknown) => void;
        guessApi.mockReturnValueOnce(new Promise((r) => (resolve = r)) as never);
        const pending = game.guess(1960);
        expect(game.submitting.value).toBe(true);

        await game.load(DAY);
        expect(game.submitting.value).toBe(false);
        resolve(miss('later', 'far'));

        expect(await pending).toBe(false);
        expect(game.guesses.value).toEqual([]);
        expect(game.submitting.value).toBe(false);
    });

    it("drops a left page's late guess once a reopened page has loaded", async () => {
        const left = await loaded();
        let resolve!: (value: unknown) => void;
        guessApi.mockReturnValueOnce(new Promise((r) => (resolve = r)) as never);
        const pending = left.guess(1960);

        const reopened = await loaded();
        resolve(miss('later', 'far'));

        expect(await pending).toBe(false);
        expect(readDailyEraGame(DAY)).toBeNull();
        expect(callsTo('daily_era_guessed')).toEqual([]);
        expect(reopened.guesses.value).toEqual([]);
    });

    it('expires on a 410', async () => {
        const game = await loaded();
        guessApi.mockRejectedValueOnce({ response: { status: 410 } });
        await game.guess(1960);
        expect(game.status.value).toBe('expired');
    });

    it('ignores a repeated season and a guess while one is pending', async () => {
        const game = await loaded();
        guessApi.mockResolvedValueOnce(miss('later', 'far'));
        await game.guess(1960);
        await game.guess(1960);
        expect(guessApi).toHaveBeenCalledTimes(1);

        guessApi.mockReturnValueOnce(new Promise(() => {}));
        void game.guess(1970);
        void game.guess(1980);
        expect(guessApi).toHaveBeenCalledTimes(2);
        expect(game.submitting.value).toBe(true);
    });
});

describe('useDailyEra persistence', () => {
    it('restores a finished game without finishing it again', async () => {
        const first = await loaded();
        guessApi.mockResolvedValueOnce(hit);
        await first.guess(1996);
        vi.mocked(track).mockClear();

        const again = await loaded();
        expect(again.status.value).toBe('won');
        expect(again.guesses.value).toHaveLength(1);
        expect(again.answer.value).toEqual(answer);
        expect(callsTo('daily_era_viewed')).toEqual([
            ['daily_era_viewed', { puzzleNumber: 12, state: 'finished' }],
        ]);
        expect(callsTo('daily_era_finished')).toEqual([]);
    });

    it("ignores a stored game for a different puzzle", async () => {
        const first = await loaded();
        guessApi.mockResolvedValueOnce(miss('later', 'far'));
        await first.guess(1960);

        getPuzzle.mockResolvedValueOnce({ success: true, data: { ...puzzle, puzzleId: 'p2' } });
        const again = await loaded();
        expect(again.status.value).toBe('playing');
        expect(again.guesses.value).toEqual([]);
    });
});
