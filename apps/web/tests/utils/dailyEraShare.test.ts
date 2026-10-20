import { describe, it, expect } from 'vitest';
import {
    dailyEraShareResult,
    dailyEraShareText,
    dailyEraShareUrl,
    shareTiles,
} from '@/utils/dailyEraShare';
import { close, far, hit, near, secretsOf, solvedGame } from '../helpers/dailyEraShare';

const URL = 'https://nba.example/daily';

describe('dailyEraShareText', () => {
    it('formats a win like the spec', () => {
        const result = dailyEraShareResult(
            { puzzleNumber: 12, guesses: [far(1960, 'later'), close(1990, 'earlier'), hit(1988)] },
            5,
        );
        expect(dailyEraShareText(result, URL)).toBe(`Which Era? #12 3/4 🔥5 ⬛⬆️ 🟨⬇️ 🟩 ${URL}`);
    });

    it('uses X for a loss and leaves a zero streak out', () => {
        const result = dailyEraShareResult(
            {
                puzzleNumber: 7,
                guesses: [far(1960, 'later'), near(1980, 'later'), close(1990, 'earlier'), close(1987, 'later')],
            },
            0,
        );
        expect(result.streak).toBeNull();
        expect(dailyEraShareText(result, URL)).toBe(`Which Era? #7 X/4 ⬛⬆️ 🟧⬆️ 🟨⬇️ 🟨⬆️ ${URL}`);
    });

    it('leaves the streak out when given null', () => {
        const result = dailyEraShareResult({ puzzleNumber: 3, guesses: [hit(2001)] }, null);
        expect(result.streak).toBeNull();
        expect(dailyEraShareText(result, URL)).toBe(`Which Era? #3 1/4 🟩 ${URL}`);
    });

    it('never includes the answer or a guessed season', () => {
        const text = dailyEraShareText(dailyEraShareResult(solvedGame, 3), URL);
        for (const secret of secretsOf(solvedGame)) expect(text).not.toContain(secret);
        for (const tile of shareTiles(solvedGame.guesses)) expect(Object.keys(tile)).not.toContain('season');
    });
});

describe('dailyEraShareUrl', () => {
    it("links today's puzzle, or an archive game's own date", () => {
        expect(dailyEraShareUrl('2026-10-20', false)).toMatch(/\/daily$/);
        expect(dailyEraShareUrl('2026-10-12', true)).toMatch(/\/daily\?date=2026-10-12$/);
    });
});
