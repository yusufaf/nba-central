import { computed, getCurrentScope, onScopeDispose, ref } from "vue";
import { toast } from "vue-sonner";
import { dailyEraApi } from "@/network/api";
import { track } from "@/lib/analytics";
import {
    DAILY_ERA_MAX_ATTEMPTS,
    dailyEraStats,
    gameOutcome,
    nextPuzzleAt,
    readDailyEraGames,
    writeDailyEraGame,
    type DailyEraGuess,
    type StoredDailyEraGame,
} from "@/utils/dailyEra";
import { toIsoDate } from "@/utils/date";
import type { DailyEraPuzzleView, DailyEraReveal, GuessDailyEraResponse } from "@/models/api";

export type DailyEraStatus =
    | "loading"
    | "playing"
    | "won"
    | "lost"
    | "unavailable"
    | "expired"
    | "error";

const statusOf = (err: unknown): number | undefined =>
    (err as { response?: { status?: number } } | null)?.response?.status;

// Shared across instances, so a load started for yesterday can't land after
// one started for today, and a guess from a page that was left and reopened
// can't write over the game the new page restored.
let loadSeq = 0;

// A day's guesses only grow, so per day the copy with more is the newer one:
// memory when a write failed, storage when another tab played on.
const mergeGames = (
    memory: Record<string, StoredDailyEraGame>,
    stored: Record<string, StoredDailyEraGame>,
): Record<string, StoredDailyEraGame> => {
    const merged = { ...memory };
    for (const [day, game] of Object.entries(stored)) {
        if (!merged[day] || game.guesses.length >= merged[day].guesses.length) merged[day] = game;
    }
    return merged;
};

/**
 * One day's Daily Era game: the puzzle, the guesses so far and, once it's
 * over, the answer. A guess that fails for any reason but 410 costs no
 * attempt - the attempt number counts successful guesses only.
 */
export const useDailyEra = () => {
    const status = ref<DailyEraStatus>("loading");
    const puzzle = ref<DailyEraPuzzleView | null>(null);
    const guesses = ref<DailyEraGuess[]>([]);
    const answer = ref<DailyEraReveal | null>(null);
    const submitting = ref(false);
    const date = ref("");
    // The local day: set by load() and each guess, and moved on at local
    // midnight while the page is open.
    const today = ref("");
    // Whether this game counts as an archive game: see StoredDailyEraGame.
    const archive = ref(false);
    const games = ref<Record<string, StoredDailyEraGame>>({});
    const attemptsLeft = computed(() => DAILY_ERA_MAX_ATTEMPTS - guesses.value.length);
    const stats = computed(() => dailyEraStats(games.value, today.value));

    // Outside an effect scope, as in most unit tests, nothing would ever
    // clean up the timer, so the page only rolls over while a scope owns it.
    if (getCurrentScope()) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        // An open page moves on to the new day at local midnight, so a game
        // finished before it shares as that day's archive game. A timer
        // alone misses midnight in a hidden, throttled tab, hence the
        // visibility check. The wait is capped at a minute because timers
        // can stop counting while the machine sleeps, and a tab that stays
        // visible through sleep gets no visibility event.
        const rollOver = () => {
            const now = toIsoDate(new Date());
            if (today.value) today.value = now;
            clearTimeout(timer);
            timer = setTimeout(rollOver, Math.min(nextPuzzleAt(now).getTime() - Date.now(), 60_000));
        };
        rollOver();
        document.addEventListener("visibilitychange", rollOver);
        onScopeDispose(() => {
            clearTimeout(timer);
            document.removeEventListener("visibilitychange", rollOver);
        });
    }

    /** `guessedOn` is the local day the guess was sent, not when it was scored: it decides archive. */
    const save = (guessedOn: string) => {
        if (!puzzle.value) return;
        today.value = toIsoDate(new Date());
        archive.value = archive.value || date.value !== guessedOn;
        const record: StoredDailyEraGame = {
            puzzleId: puzzle.value.puzzleId,
            puzzleNumber: puzzle.value.puzzleNumber,
            guesses: guesses.value,
            answer: answer.value,
            archive: archive.value,
        };
        writeDailyEraGame(date.value, record);
        // In memory too, so blocked storage still shows this session's streak.
        games.value = { ...games.value, [date.value]: record };
    };

    const load = async (day: string) => {
        const seq = ++loadSeq;
        submitting.value = false;
        status.value = "loading";
        puzzle.value = null;
        guesses.value = [];
        answer.value = null;
        date.value = day;
        today.value = toIsoDate(new Date());
        archive.value = day !== today.value;
        // Before the request, so the archive shows stored results even when
        // this day's puzzle is unavailable.
        games.value = mergeGames(games.value, readDailyEraGames());
        try {
            const res = await dailyEraApi.getPuzzle(day);
            if (seq !== loadSeq) return;
            if (!res.success) {
                status.value = "unavailable";
                return;
            }
            puzzle.value = res.data;
            // Again, in case another tab played this day during the request.
            games.value = mergeGames(games.value, readDailyEraGames());
            const stored = games.value[day];
            const resumed = stored?.puzzleId === res.data.puzzleId ? stored : undefined;
            if (resumed) {
                guesses.value = resumed.guesses;
                answer.value = resumed.answer;
            }
            status.value = gameOutcome(guesses.value);
            // A finished game keeps the flag it was saved with. One still in
            // progress is archive once its day has passed, since its next
            // guess will be.
            if (resumed) {
                archive.value = (resumed.archive ?? false) || (archive.value && status.value === "playing");
            }
            track("daily_era_viewed", {
                puzzleNumber: res.data.puzzleNumber,
                state:
                    status.value === "playing"
                        ? guesses.value.length ? "in-progress" : "new"
                        : "finished",
            });
        } catch (err) {
            if (seq !== loadSeq) return;
            if (statusOf(err) === 410) {
                status.value = "unavailable";
            } else {
                console.error("Failed to load the Daily Era puzzle:", err);
                status.value = "error";
            }
        }
    };

    /** Resolves true once the guess is scored, false if it was refused or failed. */
    const guess = async (season: number): Promise<boolean> => {
        if (
            status.value !== "playing" ||
            submitting.value ||
            !puzzle.value ||
            guesses.value.some((g) => g.season === season)
        ) {
            return false;
        }
        // Set before the first await, so a second tap in the same tick is refused.
        submitting.value = true;
        const seq = loadSeq;
        const { puzzleId, puzzleNumber } = puzzle.value;
        const attempt = guesses.value.length + 1;
        const guessedOn = toIsoDate(new Date());

        let res: GuessDailyEraResponse | undefined;
        let failure: unknown;
        try {
            res = await dailyEraApi.guess({ puzzleId, season, attempt });
        } catch (err) {
            failure = err;
        }
        // A load() while this was in flight, even of the same day and even
        // on a remounted page, rebuilt the game; this answer belongs to the
        // one it replaced. load() has already reset `submitting`.
        if (seq !== loadSeq) return false;
        submitting.value = false;

        if (!res?.success) {
            if (statusOf(failure) === 410) {
                status.value = "expired";
            } else {
                console.error("Daily Era guess failed:", failure ?? res?.error);
                toast.error("Couldn't check that guess. Try again.");
            }
            return false;
        }

        const { answer: revealed, ...score } = res.data;
        guesses.value = [...guesses.value, { season, ...score }];
        const finished = score.hit || attempt === DAILY_ERA_MAX_ATTEMPTS;
        if (finished) {
            status.value = score.hit ? "won" : "lost";
            answer.value = revealed ?? null;
        }
        save(guessedOn);
        track("daily_era_guessed", { puzzleNumber, attempt, hit: score.hit, band: score.band });
        if (finished) {
            track("daily_era_finished", { puzzleNumber, solved: score.hit, attempts: attempt });
        }
        return true;
    };

    return {
        status,
        puzzle,
        guesses,
        answer,
        submitting,
        attemptsLeft,
        date,
        today,
        archive,
        games,
        stats,
        load,
        guess,
    };
};
