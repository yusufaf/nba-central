import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    formatCountdown,
    nextPuzzleAt,
    readDailyEraGame,
    seasonDecades,
    seasonLabel,
    writeDailyEraGame,
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
});
