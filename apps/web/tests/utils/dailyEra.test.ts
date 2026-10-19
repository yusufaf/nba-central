import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    archiveDays,
    dailyEraPuzzleNumber,
    dailyEraStats,
    formatCountdown,
    gameOutcome,
    isArchiveDay,
    nextPuzzleAt,
    readDailyEraGame,
    readDailyEraGames,
    seasonDecades,
    seasonLabel,
    writeDailyEraGame,
    type DailyEraGuess,
    type StoredDailyEraGame,
} from '@/utils/dailyEra';

describe('seasonLabel', () => {
    it('labels a season by its start and end years', () => {
        expect(seasonLabel(1947)).toBe('1946-47');
        expect(seasonLabel(2000)).toBe('1999-00');
        expect(seasonLabel(2027)).toBe('2026-27');
    });
});

describe('seasonDecades', () => {
    it('groups every season since 1946-47 by the decade it starts in', () => {
        const decades = seasonDecades(new Date(2026, 9, 16));
        expect(decades).toHaveLength(9);
        expect(decades[0]).toEqual({ label: '1940s', seasons: [1947, 1948, 1949, 1950] });
        expect(decades.find((d) => d.label === '1990s')?.seasons).toEqual([
            1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000,
        ]);
        expect(decades.at(-1)?.label).toBe('2020s');
        expect(decades.at(-1)?.seasons.at(-1)).toBe(2027);
        expect(decades.flatMap((d) => d.seasons)).toHaveLength(81);
    });

    it('stops at the current season before the Oct 1 rollover', () => {
        expect(seasonDecades(new Date(2026, 8, 30)).flatMap((d) => d.seasons)).toHaveLength(80);
    });
});

describe('nextPuzzleAt', () => {
    it("is the local midnight that ends the puzzle's day", () => {
        expect(nextPuzzleAt('2026-10-16').getTime()).toBe(new Date(2026, 9, 17).getTime());
        expect(nextPuzzleAt('2026-12-31').getTime()).toBe(new Date(2027, 0, 1).getTime());
        expect(
            nextPuzzleAt('2026-10-16').getTime() - new Date(2026, 9, 16, 23, 59, 30).getTime(),
        ).toBe(30_000);
    });

    it('throws on a malformed day', () => {
        expect(() => nextPuzzleAt('nope')).toThrow();
    });
});

describe('formatCountdown', () => {
    it('formats H:MM:SS and clamps at zero', () => {
        expect(formatCountdown(3_723_000)).toBe('1:02:03');
        expect(formatCountdown(-5)).toBe('0:00:00');
    });
});

describe('daily era storage', () => {
    const game: StoredDailyEraGame = {
        puzzleId: 'p1',
        puzzleNumber: 12,
        guesses: [{ season: 1996, hit: false, direction: 'later', band: 'near' }],
        answer: null,
    };

    beforeEach(() => localStorage.clear());
    afterEach(() => vi.restoreAllMocks());

    it('round-trips a game and keeps other dates', () => {
        writeDailyEraGame('2026-10-16', game);
        writeDailyEraGame('2026-10-17', { ...game, puzzleId: 'p2' });
        expect(readDailyEraGame('2026-10-16')).toEqual(game);
        expect(readDailyEraGame('2026-10-17')?.puzzleId).toBe('p2');
        expect(readDailyEraGame('2026-10-18')).toBeNull();
    });

    it('survives storage that throws', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('denied');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('denied');
        });
        expect(() => writeDailyEraGame('2026-10-16', game)).not.toThrow();
        expect(readDailyEraGame('2026-10-16')).toBeNull();
    });

    it('ignores corrupt JSON, another version and a malformed game', () => {
        localStorage.setItem('nba-central:daily-era', '{not json');
        expect(readDailyEraGame('2026-10-16')).toBeNull();

        localStorage.setItem(
            'nba-central:daily-era',
            JSON.stringify({ version: 2, games: { '2026-10-16': game } }),
        );
        expect(readDailyEraGame('2026-10-16')).toBeNull();

        localStorage.setItem(
            'nba-central:daily-era',
            JSON.stringify({ version: 1, games: { '2026-10-16': { puzzleId: 'p1', guesses: [{ season: '1996' }] } } }),
        );
        expect(readDailyEraGame('2026-10-16')).toBeNull();
    });

    it("never overwrites a newer version's store", () => {
        const newer = JSON.stringify({ version: 2, games: { '2026-10-15': { streak: 9 } } });
        localStorage.setItem('nba-central:daily-era', newer);
        writeDailyEraGame('2026-10-16', game);
        expect(localStorage.getItem('nba-central:daily-era')).toBe(newer);
    });

    it.each([
        ['garbage', '{not json'],
        ['an empty string', ''],
        ['null', 'null'],
        ['an older version', JSON.stringify({ version: 0, games: {} })],
        ['games as an array', JSON.stringify({ version: 1, games: [] })],
    ])('replaces %s with a fresh store', (_, raw) => {
        localStorage.setItem('nba-central:daily-era', raw);
        writeDailyEraGame('2026-10-16', game);
        expect(readDailyEraGame('2026-10-16')).toEqual(game);
    });

    it('ignores a game the page could not render', () => {
        const store = (g: unknown) =>
            localStorage.setItem('nba-central:daily-era', JSON.stringify({ version: 1, games: { d: g } }));

        store({ ...game, guesses: [{ season: 1990, hit: false }] });
        expect(readDailyEraGame('d')).toBeNull();

        store({ ...game, guesses: [{ season: 1990, hit: false, direction: 'sideways', band: 'near' }] });
        expect(readDailyEraGame('d')).toBeNull();

        store({ ...game, answer: {} });
        expect(readDailyEraGame('d')).toBeNull();

        const answer = {
            runLabel: '1995-96',
            teamName: 'Vancouver Grizzlies',
            franchise: 'MEM',
            shownIdentity: { franchise: 'MEM', name: 'x', startYear: 1996, mediaId: 'm1' },
        };
        store({ ...game, guesses: [{ season: 1996, hit: true, direction: null, band: null }], answer });
        expect(readDailyEraGame('d')?.answer).toEqual(answer);
    });

    it('round-trips the archive flag and drops a malformed one', () => {
        writeDailyEraGame('2026-10-16', { ...game, archive: true });
        expect(readDailyEraGame('2026-10-16')?.archive).toBe(true);

        localStorage.setItem(
            'nba-central:daily-era',
            JSON.stringify({ version: 1, games: { '2026-10-16': { ...game, archive: 'yes' } } }),
        );
        expect(readDailyEraGame('2026-10-16')).toBeNull();
    });
});

const miss: DailyEraGuess = { season: 1990, hit: false, direction: 'later', band: 'far' };
const hitGuess: DailyEraGuess = { season: 1996, hit: true, direction: null, band: null };

const record = (guesses: DailyEraGuess[], opts: { archive?: boolean } = {}): StoredDailyEraGame => ({
    puzzleId: 'p',
    puzzleNumber: 1,
    guesses,
    answer: null,
    ...opts,
});
const won = (attempts = 1, opts: { archive?: boolean } = {}) =>
    record([...Array.from({ length: attempts - 1 }, (_, i) => ({ ...miss, season: 1980 + i })), hitGuess], opts);
const lost = (opts: { archive?: boolean } = {}) =>
    record(Array.from({ length: 4 }, (_, i) => ({ ...miss, season: 1980 + i })), opts);
const inProgress = () => record([miss]);

describe('gameOutcome', () => {
    it('is won on a hit, lost after 4 misses, playing otherwise', () => {
        expect(gameOutcome([])).toBe('playing');
        expect(gameOutcome([miss])).toBe('playing');
        expect(gameOutcome([miss, hitGuess])).toBe('won');
        expect(gameOutcome(lost().guesses)).toBe('lost');
    });
});

describe('dailyEraStats', () => {
    const today = '2026-11-06';

    it('is all zeros with no games', () => {
        expect(dailyEraStats({}, today)).toEqual({
            played: 0,
            wins: 0,
            currentStreak: 0,
            bestStreak: 0,
            distribution: [0, 0, 0, 0],
        });
    });

    it('counts consecutive days won up to today', () => {
        const stats = dailyEraStats({ '2026-11-04': won(), '2026-11-05': won(), '2026-11-06': won() }, today);
        expect(stats.currentStreak).toBe(3);
        expect(stats.bestStreak).toBe(3);
    });

    it("doesn't break the streak before today is played", () => {
        expect(dailyEraStats({ '2026-11-04': won(), '2026-11-05': won() }, today).currentStreak).toBe(2);

        const stats = dailyEraStats({ '2026-11-05': won(), '2026-11-06': inProgress() }, today);
        expect(stats.currentStreak).toBe(1);
        expect(stats.played).toBe(1);
    });

    it('resets on a loss today', () => {
        expect(dailyEraStats({ '2026-11-05': won(), '2026-11-06': lost() }, today)).toMatchObject({
            currentStreak: 0,
            bestStreak: 1,
            played: 2,
            wins: 1,
        });
    });

    it('resets after a missed day', () => {
        expect(dailyEraStats({ '2026-11-04': won(), '2026-11-06': won() }, today)).toMatchObject({
            currentStreak: 1,
            bestStreak: 1,
        });
    });

    it("never lets an archive game extend the streak or fill a gap", () => {
        const stats = dailyEraStats(
            { '2026-11-04': won(), '2026-11-05': won(2, { archive: true }), '2026-11-06': won() },
            today,
        );
        expect(stats).toMatchObject({ currentStreak: 1, bestStreak: 1, played: 3, wins: 3 });
        expect(stats.distribution).toEqual([2, 1, 0, 0]);
    });

    it("never lets an archive loss break the streak", () => {
        const stats = dailyEraStats({ '2026-11-05': lost({ archive: true }), '2026-11-06': won() }, today);
        expect(stats.currentStreak).toBe(1);
        expect(stats.played).toBe(2);
    });

    it('counts a record without the archive flag as daily', () => {
        const legacy = won();
        delete legacy.archive;
        expect(dailyEraStats({ '2026-11-05': legacy, '2026-11-06': won() }, today).currentStreak).toBe(2);
    });

    it('keeps an older, longer run as the best streak', () => {
        const games: Record<string, StoredDailyEraGame> = {
            '2026-11-01': lost(),
            '2026-11-05': won(),
            '2026-11-06': won(),
        };
        for (let d = 27; d <= 31; d++) games[`2026-10-${d}`] = won();
        expect(dailyEraStats(games, today)).toMatchObject({ currentStreak: 2, bestStreak: 5 });
    });

    it('carries a streak across a year boundary', () => {
        expect(dailyEraStats({ '2026-12-31': won(), '2027-01-01': won() }, '2027-01-01').currentStreak).toBe(2);
    });

    it('counts wins by the number of guesses they took', () => {
        const stats = dailyEraStats(
            { '2026-11-03': won(1), '2026-11-04': won(1), '2026-11-05': won(3), '2026-11-06': lost() },
            today,
        );
        expect(stats.distribution).toEqual([2, 0, 1, 0]);
        expect(stats.played).toBe(4);
        expect(stats.wins).toBe(3);
    });

    it("skips a key that isn't a date and an invalid today", () => {
        const games = { d: won(), '2026-11-05': won(), '2026-11-06': won() };
        expect(dailyEraStats(games, today)).toMatchObject({ currentStreak: 2, bestStreak: 2 });
        expect(dailyEraStats(games, '')).toEqual(dailyEraStats({}, today));
    });
});

describe('readDailyEraGames', () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => vi.restoreAllMocks());

    it('returns only valid games under date keys', () => {
        localStorage.setItem(
            'nba-central:daily-era',
            JSON.stringify({
                version: 1,
                games: { d: won(), '2026-11-05': won(), '2026-11-06': { puzzleId: 'p', guesses: 'x' } },
            }),
        );
        expect(Object.keys(readDailyEraGames())).toEqual(['2026-11-05']);
    });

    it('drops a game with more guesses than a game allows', () => {
        writeDailyEraGame('2026-11-05', won(5));
        writeDailyEraGame('2026-11-06', won(4));
        expect(Object.keys(readDailyEraGames())).toEqual(['2026-11-06']);
        expect(readDailyEraGame('2026-11-05')).toBeNull();
    });

    it('is empty when storage throws or a newer version wrote it', () => {
        localStorage.setItem('nba-central:daily-era', JSON.stringify({ version: 2, games: { '2026-11-05': won() } }));
        expect(readDailyEraGames()).toEqual({});

        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('denied');
        });
        expect(readDailyEraGames()).toEqual({});
    });
});

describe('dailyEraPuzzleNumber', () => {
    it('numbers puzzles from the first date', () => {
        expect(dailyEraPuzzleNumber('2026-10-05')).toBe(1);
        expect(dailyEraPuzzleNumber('2026-11-06')).toBe(33);
    });
});

describe('archiveDays', () => {
    it('lists the 30 days before today, newest first', () => {
        const days = archiveDays('2026-11-06');
        expect(days).toHaveLength(30);
        expect(days[0]).toBe('2026-11-05');
        expect(days.at(-1)).toBe('2026-10-07');
    });

    it('stops at the first puzzle', () => {
        const days = archiveDays('2026-10-18');
        expect(days).toHaveLength(13);
        expect(days.at(-1)).toBe('2026-10-05');
        expect(archiveDays('2026-10-05')).toEqual([]);
    });

    it('knows which days are in the archive', () => {
        expect(isArchiveDay('2026-11-05', '2026-11-06')).toBe(true);
        expect(isArchiveDay('2026-10-07', '2026-11-06')).toBe(true);
        for (const day of ['2026-11-06', '2026-11-07', '2026-10-06', 'junk']) {
            expect(isArchiveDay(day, '2026-11-06')).toBe(false);
        }
    });
});
