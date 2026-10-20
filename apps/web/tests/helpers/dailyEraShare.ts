import { seasonLabel, type DailyEraGuess, type StoredDailyEraGame } from '@/utils/dailyEra';

type Direction = 'earlier' | 'later';
export const far = (season: number, direction: Direction): DailyEraGuess => ({ season, hit: false, band: 'far', direction });
export const near = (season: number, direction: Direction): DailyEraGuess => ({ season, hit: false, band: 'near', direction });
export const close = (season: number, direction: Direction): DailyEraGuess => ({ season, hit: false, band: 'close', direction });
export const hit = (season: number): DailyEraGuess => ({ season, hit: true, band: null, direction: null });

/** A finished game holding everything a share must never show: the answer and the seasons guessed. */
export const solvedGame: StoredDailyEraGame = {
    puzzleId: 'p12',
    puzzleNumber: 12,
    guesses: [far(1958, 'later'), close(1975, 'later'), hit(1989)],
    answer: {
        runLabel: '1988-89 – 1990-91',
        teamName: 'Vancouver Grizzlies',
        franchise: 'MEM',
        shownIdentity: { franchise: 'MEM', name: 'Grizzlies', startYear: 1996, mediaId: 'm1' },
    },
};

/** Every string that would give the answer away. */
export const secretsOf = (game: StoredDailyEraGame): string[] => [
    game.answer!.runLabel,
    game.answer!.teamName,
    game.answer!.franchise,
    game.answer!.shownIdentity.name,
    String(game.answer!.shownIdentity.startYear),
    ...game.guesses.flatMap((g) => [seasonLabel(g.season), String(g.season), String(g.season - 1)]),
];
