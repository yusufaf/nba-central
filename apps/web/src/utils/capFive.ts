import type { CapFiveResult } from "@/models/api";
import { CAP_FIVE_LINEUP_SIZE } from "@/constants/capFive";
import { ratingTier, type RatingTier } from "@/constants/ratings";
import { addDays, parseIsoDate } from "@/utils/date";
import { appUrl } from "@/utils/appUrl";

export interface StoredCapFiveGame {
    result: CapFiveResult;
    /** True when the lineup was locked in after its own local day. */
    archive: boolean;
}

// One record per local date. The first submission wins: a day is played once.
// Streaks are worked out from these records on read, never stored.
export const CAP_FIVE_STORAGE_KEY = "nba-central:cap-five";
const STORAGE_VERSION = 1;

interface StoredCapFive {
    version: typeof STORAGE_VERSION;
    games: Record<string, StoredCapFiveGame>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isCandidate = (value: unknown) =>
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.positions) &&
    typeof value.rating === "number";

// Checks everything the reveal reads, so a hand-edited or half-written record
// is dropped instead of breaking the page for the day.
const isResult = (value: unknown): value is CapFiveResult =>
    isRecord(value) &&
    typeof value.puzzleNumber === "number" &&
    typeof value.date === "string" &&
    typeof value.cap === "number" &&
    typeof value.gameVersion === "string" &&
    typeof value.total === "number" &&
    typeof value.busted === "boolean" &&
    Array.isArray(value.picks) &&
    value.picks.length === CAP_FIVE_LINEUP_SIZE &&
    value.picks.every((id) => typeof id === "string") &&
    isRecord(value.optimal) &&
    typeof value.optimal.total === "number" &&
    typeof value.optimal.count === "number" &&
    Array.isArray(value.optimal.lineup) &&
    value.optimal.lineup.every((id) => typeof id === "string") &&
    Array.isArray(value.candidates) &&
    value.candidates.every(isCandidate);

const isGame = (value: unknown): value is StoredCapFiveGame =>
    isRecord(value) && isResult(value.result) && typeof value.archive === "boolean";

// "newer" is a store written by a later version of the app. It may hold days
// this version can't read, so it is never overwritten. Anything else
// unreadable holds nothing recoverable and is replaced on the next save.
type StoreRead = { kind: "store"; store: StoredCapFive } | { kind: "newer" } | { kind: "none" };

const readStore = (): StoreRead => {
    try {
        const raw = localStorage.getItem(CAP_FIVE_STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (!isRecord(parsed) || typeof parsed.version !== "number") return { kind: "none" };
        if (parsed.version > STORAGE_VERSION) return { kind: "newer" };
        if (parsed.version !== STORAGE_VERSION || !isRecord(parsed.games)) return { kind: "none" };
        return { kind: "store", store: parsed as unknown as StoredCapFive };
    } catch {
        return { kind: "none" };
    }
};

/** Every readable game, by date. A key that isn't a date is dropped. */
export const readCapFiveGames = (): Record<string, StoredCapFiveGame> => {
    const read = readStore();
    if (read.kind !== "store") return {};
    return Object.fromEntries(
        Object.entries(read.store.games).filter(([day, game]) => parseIsoDate(day) !== null && isGame(game)),
    );
};

/**
 * Saves a day's game unless storage already has one (another tab locked in
 * first). Returns the game storage holds for the day afterwards: `game`
 * itself, the other tab's, or `game` again when storage is blocked.
 */
export const writeCapFiveGame = (day: string, game: StoredCapFiveGame): StoredCapFiveGame => {
    const read = readStore();
    if (read.kind === "newer") return game;
    const store: StoredCapFive = read.kind === "store" ? read.store : { version: STORAGE_VERSION, games: {} };
    const stored = store.games[day];
    if (isGame(stored)) return stored;
    store.games[day] = game;
    try {
        localStorage.setItem(CAP_FIVE_STORAGE_KEY, JSON.stringify(store));
    } catch {
        // Private mode or a full quota: the result still shows, it just won't
        // survive a reload.
    }
    return game;
};

export type CapFiveGrade = "perfect" | "close" | "near" | "far" | "bust";

export const capFiveGrade = (result: CapFiveResult): CapFiveGrade => {
    if (result.busted) return "bust";
    const short = result.optimal.total - result.total;
    if (short <= 0) return "perfect";
    if (short <= 5) return "close";
    if (short <= 15) return "near";
    return "far";
};

export interface CapFiveStats {
    played: number;
    perfect: number;
    /** Consecutive local days played on their own day without a bust. */
    currentStreak: number;
    bestStreak: number;
}

export const capFiveStats = (games: Record<string, StoredCapFiveGame>, today: string): CapFiveStats => {
    const stats: CapFiveStats = { played: 0, perfect: 0, currentStreak: 0, bestStreak: 0 };
    if (!parseIsoDate(today)) return stats;

    const streakDays = new Set<string>();
    for (const [day, game] of Object.entries(games)) {
        if (!parseIsoDate(day)) continue;
        stats.played++;
        if (capFiveGrade(game.result) === "perfect") stats.perfect++;
        if (!game.archive && !game.result.busted) streakDays.add(day);
    }

    // An unplayed today doesn't break the streak yet; a bust today does.
    const todayGame = games[today];
    const bustToday = !!todayGame && !todayGame.archive && todayGame.result.busted;
    if (!bustToday) {
        let day = streakDays.has(today) ? today : addDays(today, -1);
        while (streakDays.has(day)) {
            stats.currentStreak++;
            day = addDays(day, -1);
        }
    }

    let run = 0;
    let prev = "";
    for (const day of [...streakDays].sort()) {
        run = prev && addDays(prev, 1) === day ? run + 1 : 1;
        stats.bestStreak = Math.max(stats.bestStreak, run);
        prev = day;
    }
    return stats;
};

// Exhaustive, so a new tier fails to compile here.
const TIER_EMOJI = { elite: "🟨", great: "🟩", good: "🟦", average: "⬜" } satisfies Record<RatingTier, string>;

/** Each pick's rating tier, in pick order: never a name or a number. */
export const capFiveTiers = (result: CapFiveResult): RatingTier[] =>
    result.picks.map((id) => ratingTier(result.candidates.find((c) => c.id === id)?.rating ?? 0));

/**
 * One line, e.g. `Cap Five #12 412/415 🟨🟩🟦🟦⬜ 🔥3 https://…/cap-five`. No
 * names: a friend who hasn't played would see a strong lineup.
 */
export const capFiveShareText = (result: CapFiveResult, streak: number | null, url: string): string => {
    const score = result.busted ? `BUST ${result.total}/${result.cap} cap` : `${result.total}/${result.optimal.total}`;
    const tiles = capFiveTiers(result).map((tier) => TIER_EMOJI[tier]).join("");
    const flame = streak && streak > 0 ? ` 🔥${streak}` : "";
    return `Cap Five #${result.puzzleNumber} ${score} ${tiles}${flame} ${url}`;
};

export const capFiveShareUrl = (): string => appUrl("/cap-five");
