import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    CAP_FIVE_STORAGE_KEY,
    capFiveGrade,
    capFiveShareText,
    capFiveShortName,
    capFiveStats,
    capFiveTiers,
    readCapFiveGames,
    writeCapFiveGame,
    type StoredCapFiveGame,
} from '@/utils/capFive';
import { candidates, result } from '../helpers/capFive';

const game = (over: Partial<StoredCapFiveGame['result']> = {}, archive = false): StoredCapFiveGame => ({
    result: result(over),
    archive,
});

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('storage', () => {
    it('round-trips a game by date', () => {
        expect(writeCapFiveGame('2026-11-02', game())).toEqual(game());
        expect(readCapFiveGames()).toEqual({ '2026-11-02': game() });
    });

    it('keeps the first submission for a day', () => {
        writeCapFiveGame('2026-11-02', game());
        const second = game({ total: 300 });
        expect(writeCapFiveGame('2026-11-02', second)).toEqual(game());
        expect(readCapFiveGames()['2026-11-02'].result.total).toBe(412);
    });

    it('still returns the game when storage is blocked', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });
        expect(writeCapFiveGame('2026-11-02', game())).toEqual(game());
        expect(readCapFiveGames()).toEqual({});
    });

    it('never overwrites a store from a newer version', () => {
        const newer = JSON.stringify({ version: 2, games: { '2026-11-01': { future: true } } });
        localStorage.setItem(CAP_FIVE_STORAGE_KEY, newer);
        writeCapFiveGame('2026-11-02', game());
        expect(localStorage.getItem(CAP_FIVE_STORAGE_KEY)).toBe(newer);
        expect(readCapFiveGames()).toEqual({});
    });

    it('drops a malformed record and a key that is not a date', () => {
        const broken = { ...game(), result: { ...result(), picks: ['c01'] } };
        localStorage.setItem(
            CAP_FIVE_STORAGE_KEY,
            JSON.stringify({ version: 1, games: { '2026-11-01': broken, junk: game(), '2026-11-02': game() } }),
        );
        expect(Object.keys(readCapFiveGames())).toEqual(['2026-11-02']);
    });

    it('replaces garbage on the next save', () => {
        localStorage.setItem(CAP_FIVE_STORAGE_KEY, '{not json');
        writeCapFiveGame('2026-11-02', game());
        expect(readCapFiveGames()).toEqual({ '2026-11-02': game() });
    });
});

describe('capFiveGrade', () => {
    it.each([
        [415, false, 'perfect'],
        [410, false, 'close'],
        [409, false, 'near'],
        [400, false, 'near'],
        [399, false, 'far'],
        [431, true, 'bust'],
    ])('grades %i (busted %s) as %s', (total, busted, grade) => {
        expect(capFiveGrade(result({ total, busted }))).toBe(grade);
    });
});

describe('capFiveStats', () => {
    const today = '2026-11-05';

    it('counts played and perfect games, archive ones included', () => {
        const stats = capFiveStats(
            { '2026-11-03': game({ total: 415 }), '2026-11-04': game({}, true), [today]: game() },
            today,
        );
        expect(stats.played).toBe(3);
        expect(stats.perfect).toBe(1);
    });

    it('streaks consecutive days played on the day without a bust', () => {
        const games = { '2026-11-02': game(), '2026-11-03': game(), '2026-11-04': game(), [today]: game() };
        expect(capFiveStats(games, today)).toMatchObject({ currentStreak: 4, bestStreak: 4 });
    });

    it('keeps yesterday\'s streak while today is unplayed', () => {
        expect(capFiveStats({ '2026-11-03': game(), '2026-11-04': game() }, today).currentStreak).toBe(2);
    });

    it('breaks on a bust, a missed day or an archive game', () => {
        expect(capFiveStats({ '2026-11-04': game(), [today]: game({ busted: true, total: 431 }) }, today))
            .toMatchObject({ currentStreak: 0, bestStreak: 1 });
        expect(capFiveStats({ '2026-11-02': game(), '2026-11-04': game() }, today).currentStreak).toBe(1);
        expect(capFiveStats({ '2026-11-03': game(), '2026-11-04': game({}, true) }, today).currentStreak).toBe(0);
    });
});

describe('share text', () => {
    it('shows the score, one tier per pick and the streak, and no names', () => {
        const text = capFiveShareText(result(), 3, 'https://nba.yusufaf.dev/cap-five');
        expect(text).toBe('Cap Five #12 412/415 🟨🟩🟩🟦⬜ 🔥3 https://nba.yusufaf.dev/cap-five');
        for (const c of candidates) {
            expect(text).not.toContain(c.name);
            expect(text).not.toContain(c.id);
        }
    });

    it('says bust and leaves an empty streak out', () => {
        expect(capFiveShareText(result({ total: 431, busted: true }), 0, 'u')).toBe(
            'Cap Five #12 BUST 431/415 cap 🟨🟩🟩🟦⬜ u',
        );
    });

    it('lists tiers in pick order', () => {
        expect(capFiveTiers(result())).toEqual(['elite', 'great', 'great', 'good', 'average']);
    });
});

describe('capFiveShortName', () => {
    it.each([
        ['Karl-Anthony Towns', 'K. Towns'],
        ['Jaren Jackson Jr.', 'J. Jackson Jr.'],
        ['  Brandon   Ingram ', 'B. Ingram'],
        ['Nenê', 'Nenê'],
        // A decomposed accent, one with no precomposed form, and an astral letter.
        ['Émile Smith', 'É. Smith'],
        ['N̈ame Smith', 'N̈. Smith'],
        ['\u{1D400}lpha Beta', '\u{1D400}. Beta'],
    ])('shortens %s to %s', (name, short) => {
        expect(capFiveShortName(name)).toBe(short);
    });
});
