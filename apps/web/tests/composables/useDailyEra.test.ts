import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effectScope } from 'vue';

vi.mock('@/network/api', () => ({
    dailyEraApi: { getPuzzle: vi.fn(), guess: vi.fn() },
}));
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));

import { toast } from 'vue-sonner';
import { dailyEraApi } from '@/network/api';
import { track } from '@/lib/analytics';
import { useDailyEra } from '@/composables/useDailyEra';
import {
    DAILY_ERA_STORAGE_KEY,
    readDailyEraGame,
    writeDailyEraGame,
    type StoredDailyEraGame,
} from '@/utils/dailyEra';

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

describe('useDailyEra streaks and archive', () => {
    const TODAY = '2026-11-06';
    const hitGuess = { season: 1996, hit: true, direction: null, band: null };
    const missGuess = { season: 1960, hit: false, direction: 'later', band: 'far' } as const;
    const seed = (day: string, guesses: StoredDailyEraGame['guesses'], archive?: boolean) =>
        writeDailyEraGame(day, {
            puzzleId: puzzle.puzzleId,
            puzzleNumber: puzzle.puzzleNumber,
            guesses,
            answer: null,
            ...(archive === undefined ? {} : { archive }),
        });
    const play = async (day: string) => {
        const game = useDailyEra();
        await game.load(day);
        return game;
    };

    beforeEach(() => vi.setSystemTime(new Date(2026, 10, 6, 12)));
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('plays an earlier day as an archive game', async () => {
        const game = await play('2026-11-01');
        guessApi.mockResolvedValueOnce(hit);
        await game.guess(1996);
        expect(readDailyEraGame('2026-11-01')?.archive).toBe(true);
        expect(game.stats.value).toMatchObject({ played: 1, wins: 1, currentStreak: 0 });
    });

    it("counts today's game toward the streak", async () => {
        const game = await play(TODAY);
        guessApi.mockResolvedValueOnce(hit);
        await game.guess(1996);
        expect(readDailyEraGame(TODAY)?.archive).toBe(false);
        expect(game.stats.value.currentStreak).toBe(1);
    });

    it("makes an earlier day's game finished later an archive game", async () => {
        seed('2026-11-04', [hitGuess], false);
        seed('2026-11-05', [missGuess], false);
        seed(TODAY, [hitGuess], false);
        const game = await play('2026-11-05');
        expect(game.archive.value).toBe(true);

        guessApi.mockResolvedValueOnce(hit);
        await game.guess(1996);
        expect(readDailyEraGame('2026-11-05')?.archive).toBe(true);
        expect(game.stats.value.currentStreak).toBe(1);
    });

    it('keeps a resumed archive game archive', async () => {
        seed('2026-11-05', [missGuess], true);
        expect((await play('2026-11-05')).archive.value).toBe(true);
    });

    it('keeps a game finished on its own day daily when reopened later', async () => {
        seed('2026-11-05', [hitGuess], false);
        seed('2026-11-04', [hitGuess]);
        expect((await play('2026-11-05')).archive.value).toBe(false);
        expect((await play('2026-11-04')).archive.value).toBe(false);
    });

    it("makes today's game archive when a guess comes after midnight", async () => {
        vi.setSystemTime(new Date(2026, 10, 6, 23, 59));
        const game = await play(TODAY);
        expect(game.archive.value).toBe(false);

        vi.setSystemTime(new Date(2026, 10, 7, 0, 1));
        guessApi.mockResolvedValueOnce(hit);
        await game.guess(1996);
        expect(readDailyEraGame(TODAY)?.archive).toBe(true);
        expect(game.today.value).toBe('2026-11-07');
        expect(game.stats.value.currentStreak).toBe(0);
    });

    it('keeps a guess sent before midnight on its day when the answer lands after', async () => {
        vi.setSystemTime(new Date(2026, 10, 6, 23, 59, 59));
        const game = await play(TODAY);
        guessApi.mockImplementationOnce(async () => {
            vi.setSystemTime(new Date(2026, 10, 7, 0, 0, 1));
            return hit;
        });
        await game.guess(1996);
        expect(readDailyEraGame(TODAY)?.archive).toBe(false);
        expect(game.today.value).toBe('2026-11-07');
        expect(game.stats.value.currentStreak).toBe(1);
    });

    it('rolls over at local midnight and stops when its scope does', async () => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
        vi.setSystemTime(new Date(2026, 10, 6, 23, 59));
        const scope = effectScope();
        const game = scope.run(() => useDailyEra())!;
        await game.load(TODAY);

        vi.advanceTimersByTime(2 * 60_000);
        expect(game.today.value).toBe('2026-11-07');
        expect(game.date.value).toBe(TODAY);

        scope.stop();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('reads stored games when the puzzle is unavailable', async () => {
        seed('2026-11-05', [hitGuess], false);
        getPuzzle.mockResolvedValueOnce({ success: false, error: 'nope' });
        const game = await play(TODAY);
        expect(game.status.value).toBe('unavailable');
        expect(game.games.value['2026-11-05']).toBeDefined();
    });

    it('updates stats after a guess without a reload', async () => {
        seed('2026-11-05', [hitGuess], false);
        const game = await play(TODAY);
        expect(game.stats.value.currentStreak).toBe(1);
        guessApi.mockResolvedValueOnce(hit);
        await game.guess(1996);
        expect(game.stats.value.currentStreak).toBe(2);
    });

    it('keeps the streak in memory when storage is blocked', async () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        const game = await play(TODAY);
        guessApi.mockResolvedValueOnce(hit);
        await game.guess(1996);
        expect(game.status.value).toBe('won');
        expect(game.stats.value.currentStreak).toBe(1);

        await game.load('2026-11-05');
        await game.load(TODAY);
        expect(game.status.value).toBe('won');
        expect(game.stats.value.currentStreak).toBe(1);
    });

    it("keeps memory's newer guesses over an older stored copy when writes fail", async () => {
        seed(TODAY, [missGuess], false);
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota');
        });
        const game = await play(TODAY);
        guessApi.mockResolvedValueOnce(hit);
        await game.guess(1996);

        await game.load('2026-11-05');
        await game.load(TODAY);
        expect(game.status.value).toBe('won');
        expect(game.guesses.value).toHaveLength(2);
    });

    it('resumes guesses another tab made during the request', async () => {
        getPuzzle.mockImplementationOnce(async () => {
            seed(TODAY, [missGuess], false);
            return { success: true, data: puzzle };
        });
        const game = await play(TODAY);
        expect(game.guesses.value).toHaveLength(1);
    });
});

describe('useDailyEra across tabs', () => {
    const m1960 = { season: 1960, hit: false, direction: 'later', band: 'far' } as const;
    const m1970 = { season: 1970, hit: false, direction: 'later', band: 'far' } as const;
    const hit1996 = { season: 1996, hit: true, direction: null, band: null };
    const wonInThree: StoredDailyEraGame = {
        puzzleId: 'p1',
        puzzleNumber: 12,
        guesses: [m1960, m1970, hit1996],
        answer,
        archive: false,
    };

    beforeEach(() => vi.setSystemTime(new Date(2026, 9, 16, 12)));
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("keeps another tab's win when a lagging guess lands after it", async () => {
        const game = await loaded();
        guessApi.mockResolvedValueOnce(miss('later', 'far'));
        await game.guess(1960);
        guessApi.mockImplementationOnce(async () => {
            writeDailyEraGame(DAY, wonInThree);
            return miss('later', 'far');
        });

        expect(await game.guess(1980)).toBe(false);
        expect(readDailyEraGame(DAY)).toEqual(wonInThree);
        expect(game.status.value).toBe('won');
        expect(game.guesses.value).toEqual(wonInThree.guesses);
        expect(game.answer.value).toEqual(answer);
        expect(callsTo('daily_era_guessed')).toHaveLength(1);
        expect(callsTo('daily_era_finished')).toEqual([]);
    });

    it('refuses a guess once storage shows another tab finished the day', async () => {
        const game = await loaded();
        writeDailyEraGame(DAY, wonInThree);
        expect(await game.guess(1980)).toBe(false);
        expect(guessApi).not.toHaveBeenCalled();
        expect(game.status.value).toBe('won');
    });

    it('writes back a game that failed to save once storage works', async () => {
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota');
        });
        const game = await loaded();
        guessApi.mockResolvedValueOnce(hit);
        await game.guess(1996);
        setItem.mockRestore();

        getPuzzle.mockResolvedValueOnce({ success: true, data: { ...puzzle, puzzleNumber: 11, puzzleId: 'p0' } });
        await game.load('2026-10-15');
        guessApi.mockResolvedValueOnce(miss('later', 'far'));
        await game.guess(1960);
        expect(readDailyEraGame(DAY)?.guesses).toEqual([{ season: 1996, hit: true, direction: null, band: null }]);
        expect(readDailyEraGame('2026-10-15')).not.toBeNull();
    });

    const inScope = async () => {
        const scope = effectScope();
        const game = scope.run(() => useDailyEra())!;
        await game.load(DAY);
        return { scope, game };
    };
    const otherTabSaved = (key: string | null = DAILY_ERA_STORAGE_KEY) =>
        window.dispatchEvent(new StorageEvent('storage', { key }));

    it("moves to another tab's finished game on a storage event", async () => {
        const { scope, game } = await inScope();
        writeDailyEraGame(DAY, wonInThree);
        otherTabSaved();

        expect(game.status.value).toBe('won');
        expect(game.answer.value).toEqual(answer);
        expect(game.guesses.value).toHaveLength(3);
        expect(game.stats.value.played).toBe(1);
        expect(await game.guess(1980)).toBe(false);
        expect(guessApi).not.toHaveBeenCalled();
        scope.stop();
    });

    it('ignores other keys and stops listening with its scope', async () => {
        const { scope, game } = await inScope();
        writeDailyEraGame(DAY, wonInThree);
        otherTabSaved('other');
        expect(game.status.value).toBe('playing');

        scope.stop();
        otherTabSaved();
        expect(game.status.value).toBe('playing');
    });

    it('leaves a guess in flight to settle against storage', async () => {
        const { scope, game } = await inScope();
        let resolve!: (value: ReturnType<typeof miss>) => void;
        guessApi.mockReturnValueOnce(new Promise((r) => (resolve = r)) as never);
        const pending = game.guess(1980);

        writeDailyEraGame(DAY, { ...wonInThree, guesses: [m1960, m1970], answer: null });
        otherTabSaved();
        expect(game.guesses.value).toEqual([]);
        expect(game.status.value).toBe('playing');

        resolve(miss('later', 'far'));
        expect(await pending).toBe(false);
        expect(game.guesses.value).toEqual([m1960, m1970]);
        expect(readDailyEraGame(DAY)?.guesses).toHaveLength(2);
        scope.stop();
    });
});
