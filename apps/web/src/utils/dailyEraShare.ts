import type { DailyEraBand, DailyEraDirection, DailyEraScore } from "@/models/api";
import { DAILY_ERA_MAX_ATTEMPTS } from "@/utils/dailyEra";
import { appUrl } from "@/utils/appUrl";

// Only what a guess scored, never its season: a shared result must not give
// the answer away.
export type DailyEraShareTile =
    | { hit: true }
    | { hit: false; band: DailyEraBand; direction: DailyEraDirection };

export interface DailyEraShareResult {
    puzzleNumber: number;
    solved: boolean;
    attempts: number;
    tiles: DailyEraShareTile[];
    /** Null leaves the streak out. */
    streak: number | null;
}

// Exhaustive, so a new band fails to compile here.
const BAND_EMOJI = { close: "🟨", near: "🟧", far: "⬛" } satisfies Record<DailyEraBand, string>;
const DIRECTION_EMOJI = { later: "⬆️", earlier: "⬇️" } satisfies Record<DailyEraDirection, string>;

export const shareTiles = (guesses: readonly DailyEraScore[]): DailyEraShareTile[] =>
    guesses.map((g) => (g.hit ? { hit: true } : { hit: false, band: g.band, direction: g.direction }));

/** Takes the whole game on purpose: only the scores get through. */
export const dailyEraShareResult = (
    game: { puzzleNumber: number; guesses: readonly DailyEraScore[] },
    streak: number | null,
): DailyEraShareResult => ({
    puzzleNumber: game.puzzleNumber,
    solved: game.guesses.at(-1)?.hit === true,
    attempts: game.guesses.length,
    tiles: shareTiles(game.guesses),
    streak: streak && streak > 0 ? streak : null,
});

export const tileEmoji = (tile: DailyEraShareTile): string =>
    tile.hit ? "🟩" : BAND_EMOJI[tile.band] + DIRECTION_EMOJI[tile.direction];

/** One line, e.g. `Which Era? #12 3/4 🔥5 ⬛⬆️ 🟨⬇️ 🟩 https://…/daily`. */
export const dailyEraShareText = (result: DailyEraShareResult, url: string): string => {
    const score = `${result.solved ? result.attempts : "X"}/${DAILY_ERA_MAX_ATTEMPTS}`;
    const streak = result.streak ? ` 🔥${result.streak}` : "";
    return `Which Era? #${result.puzzleNumber} ${score}${streak} ${result.tiles.map(tileEmoji).join(" ")} ${url}`;
};

// An archive result links its own date, so a friend gets the same puzzle.
export const dailyEraShareUrl = (date: string, archive: boolean): string =>
    appUrl(archive ? `/daily?date=${date}` : "/daily");
