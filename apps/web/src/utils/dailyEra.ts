import type { DailyEraBand, DailyEraDirection, DailyEraReveal, DailyEraScore } from "@/models/api";
import { parseIsoDate } from "@/utils/date";
import { currentSeasonEndYear } from "@/utils/season";

// Mirrors DAILY_ERA_MAX_ATTEMPTS in apps/cdk/models/daily-era.ts.
export const DAILY_ERA_MAX_ATTEMPTS = 4;
// 1946-47, the BAA's first season; the API refuses anything earlier.
export const FIRST_SEASON = 1947;

/** A season by its ending year, as the API takes it: 1996 is "1995-96". */
export const seasonLabel = (endYear: number): string =>
    `${endYear - 1}-${String(endYear % 100).padStart(2, "0")}`;

export interface SeasonDecade {
    label: string;
    seasons: number[];
}

/**
 * Every guessable season, grouped by the decade it starts in: "1990s" is
 * 1990-91 to 1999-00, so end years 1991-2000.
 */
export const seasonDecades = (now: Date = new Date()): SeasonDecade[] => {
    const decades: SeasonDecade[] = [];
    for (let endYear = FIRST_SEASON; endYear <= currentSeasonEndYear(now); endYear++) {
        const label = `${Math.floor((endYear - 1) / 10) * 10}s`;
        const last = decades[decades.length - 1];
        if (last?.label === label) last.seasons.push(endYear);
        else decades.push({ label, seasons: [endYear] });
    }
    return decades;
};

/**
 * The local midnight that ends a puzzle's day (YYYY-MM-DD). Counting down to
 * this, not to "the next midnight from now", is what lets the countdown
 * reach 0: the latter rolls forward a day the moment midnight passes.
 */
export const nextPuzzleAt = (day: string): Date => {
    const date = parseIsoDate(day);
    if (!date) throw new Error(`Not a YYYY-MM-DD date: ${day}`);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
};

/** "H:MM:SS", never negative. */
export const formatCountdown = (ms: number): string => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const seconds = String(total % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
};

export type DailyEraGuess = DailyEraScore & { season: number };

export interface StoredDailyEraGame {
    puzzleId: string;
    puzzleNumber: number;
    guesses: DailyEraGuess[];
    answer: DailyEraReveal | null;
}

// One record per local date, so a reload resumes the day's game rather than
// replaying it. #177 builds streaks and stats on these records.
const STORAGE_KEY = "nba-central:daily-era";
const STORAGE_VERSION = 1;

interface StoredDailyEra {
    version: typeof STORAGE_VERSION;
    games: Record<string, StoredDailyEraGame>;
}

// Checks everything GuessList and DailyEraReveal read, so a hand-edited or
// half-written record is dropped instead of breaking the page for the day.
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

// Exhaustive records, so a new band or direction in models/api.ts fails to
// compile here rather than silently rejecting every stored game using it.
const BANDS: readonly unknown[] = Object.keys({
    close: 0,
    near: 0,
    far: 0,
} satisfies Record<DailyEraBand, 0>);
const DIRECTIONS: readonly unknown[] = Object.keys({
    earlier: 0,
    later: 0,
} satisfies Record<DailyEraDirection, 0>);

const isGuess = (value: unknown): value is DailyEraGuess =>
    isRecord(value) &&
    typeof value.season === "number" &&
    (value.hit === true ||
        (value.hit === false && BANDS.includes(value.band) && DIRECTIONS.includes(value.direction)));

const isReveal = (value: unknown): value is DailyEraReveal =>
    isRecord(value) &&
    typeof value.runLabel === "string" &&
    typeof value.teamName === "string" &&
    isRecord(value.shownIdentity) &&
    typeof value.shownIdentity.mediaId === "string";

const isGame = (value: unknown): value is StoredDailyEraGame =>
    isRecord(value) &&
    typeof value.puzzleId === "string" &&
    Array.isArray(value.guesses) &&
    value.guesses.every(isGuess) &&
    (value.answer === null || isReveal(value.answer));

const readAll = (): StoredDailyEra | null => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<StoredDailyEra>;
        if (parsed?.version !== STORAGE_VERSION || typeof parsed.games !== "object" || !parsed.games) {
            return null;
        }
        return parsed as StoredDailyEra;
    } catch {
        return null;
    }
};

export const readDailyEraGame = (day: string): StoredDailyEraGame | null => {
    const game = readAll()?.games[day];
    return isGame(game) ? game : null;
};

export const writeDailyEraGame = (day: string, game: StoredDailyEraGame): void => {
    try {
        const all = readAll() ?? { version: STORAGE_VERSION, games: {} };
        all.games[day] = game;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
        // Private mode or a full quota: the game still plays, it just won't
        // survive a reload.
    }
};
