import type { DailyEraBand, DailyEraDirection, DailyEraReveal, DailyEraScore } from "@/models/api";
import {
    DAILY_ERA_ARCHIVE_DAYS,
    DAILY_ERA_FIRST_DATE,
    DAILY_ERA_MAX_ATTEMPTS,
} from "@/constants/dailyEra";
import { addDays, daysBetween, parseIsoDate } from "@/utils/date";
import { currentSeasonEndYear } from "@/utils/season";

export { DAILY_ERA_MAX_ATTEMPTS };
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
    /**
     * True once any guess in the game was made after its own local day, and
     * never set back. Absent on records from before the archive existed,
     * which were all played on a page that only loaded today, so absent
     * means daily.
     */
    archive?: boolean;
}

// One record per local date, so a reload resumes the day's game rather than
// replaying it. Streaks and stats are worked out from these records on read,
// never stored as counters, so reopening a finished game can't count it twice.
const STORAGE_KEY = "nba-central:daily-era";
const STORAGE_VERSION = 1;

interface StoredDailyEra {
    version: typeof STORAGE_VERSION;
    games: Record<string, StoredDailyEraGame>;
}

// Checks everything GuessList and DailyEraReveal read, so a hand-edited or
// half-written record is dropped instead of breaking the page for the day.
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

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
    value.guesses.length <= DAILY_ERA_MAX_ATTEMPTS &&
    value.guesses.every(isGuess) &&
    (value.answer === null || isReveal(value.answer)) &&
    (value.archive === undefined || typeof value.archive === "boolean");

// "newer" is a store written by a later version of the app (another tab on
// a newer deploy). It may hold days this version can't read, so it is never
// overwritten. Anything else unreadable (garbage, an older version) holds
// nothing recoverable and is replaced on the next save.
type StoreRead = { kind: "store"; store: StoredDailyEra } | { kind: "newer" } | { kind: "none" };

const readStore = (): StoreRead => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (!isRecord(parsed) || typeof parsed.version !== "number") return { kind: "none" };
        if (parsed.version > STORAGE_VERSION) return { kind: "newer" };
        if (parsed.version !== STORAGE_VERSION || !isRecord(parsed.games)) {
            return { kind: "none" };
        }
        return { kind: "store", store: parsed as unknown as StoredDailyEra };
    } catch {
        return { kind: "none" };
    }
};

export const readDailyEraGame = (day: string): StoredDailyEraGame | null => {
    const read = readStore();
    const game = read.kind === "store" ? read.store.games[day] : undefined;
    return isGame(game) ? game : null;
};

export const writeDailyEraGame = (day: string, game: StoredDailyEraGame): void => {
    try {
        const read = readStore();
        if (read.kind === "newer") return;
        const store = read.kind === "store" ? read.store : { version: STORAGE_VERSION, games: {} };
        store.games[day] = game;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
        // Private mode or a full quota: the game still plays, it just won't
        // survive a reload.
    }
};

/** Every readable game, by date. A key that isn't a date is dropped too. */
export const readDailyEraGames = (): Record<string, StoredDailyEraGame> => {
    const read = readStore();
    if (read.kind !== "store") return {};
    return Object.fromEntries(
        Object.entries(read.store.games).filter(
            ([day, game]) => parseIsoDate(day) !== null && isGame(game),
        ),
    );
};

export type DailyEraOutcome = "won" | "lost" | "playing";

export const gameOutcome = (guesses: DailyEraGuess[]): DailyEraOutcome => {
    if (guesses.at(-1)?.hit) return "won";
    if (guesses.length >= DAILY_ERA_MAX_ATTEMPTS) return "lost";
    return "playing";
};

export interface DailyEraStats {
    /** Finished games, archive ones included. */
    played: number;
    wins: number;
    /** Consecutive local days won on their own day. */
    currentStreak: number;
    bestStreak: number;
    /** distribution[i] is the number of wins in i + 1 guesses. */
    distribution: number[];
}

export const dailyEraStats = (
    games: Record<string, StoredDailyEraGame>,
    today: string,
): DailyEraStats => {
    const stats: DailyEraStats = {
        played: 0,
        wins: 0,
        currentStreak: 0,
        bestStreak: 0,
        distribution: Array<number>(DAILY_ERA_MAX_ATTEMPTS).fill(0),
    };
    if (!parseIsoDate(today)) return stats;

    const dailyWins = new Set<string>();
    for (const [day, game] of Object.entries(games)) {
        if (!parseIsoDate(day)) continue;
        const outcome = gameOutcome(game.guesses);
        if (outcome === "playing") continue;
        stats.played++;
        if (outcome !== "won") continue;
        stats.wins++;
        stats.distribution[game.guesses.length - 1]++;
        if (!game.archive) dailyWins.add(day);
    }

    // An unplayed or unfinished today doesn't break the streak yet; a loss does.
    const todayGame = games[today];
    const lostToday = !!todayGame && !todayGame.archive && gameOutcome(todayGame.guesses) === "lost";
    if (!lostToday) {
        let day = dailyWins.has(today) ? today : addDays(today, -1);
        while (dailyWins.has(day)) {
            stats.currentStreak++;
            day = addDays(day, -1);
        }
    }

    let run = 0;
    let prev = "";
    for (const day of [...dailyWins].sort()) {
        run = prev && addDays(prev, 1) === day ? run + 1 : 1;
        stats.bestStreak = Math.max(stats.bestStreak, run);
        prev = day;
    }
    return stats;
};

export const dailyEraPuzzleNumber = (day: string): number =>
    daysBetween(DAILY_ERA_FIRST_DATE, day) + 1;

/** The playable days before today, newest first, never before puzzle #1. */
export const archiveDays = (today: string): string[] => {
    const days: string[] = [];
    for (let i = 1; i <= DAILY_ERA_ARCHIVE_DAYS; i++) {
        const day = addDays(today, -i);
        if (day < DAILY_ERA_FIRST_DATE) break;
        days.push(day);
    }
    return days;
};

export const isArchiveDay = (day: string, today: string): boolean =>
    archiveDays(today).includes(day);
