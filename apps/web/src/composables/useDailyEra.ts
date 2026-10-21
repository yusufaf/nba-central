import { computed, getCurrentScope, onScopeDispose, ref } from "vue";
import { toast } from "vue-sonner";
import { dailyEraApi } from "@/network/api";
import { track } from "@/lib/analytics";
import {
    DAILY_ERA_MAX_ATTEMPTS,
    DAILY_ERA_STORAGE_KEY,
    dailyEraStats,
    gameOutcome,
    isFurtherAlong,
    nextPuzzleAt,
    readDailyEraGames,
    writeDailyEraGames,
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

// A day's game only moves forward, so per day storage wins unless memory is
// strictly further along on the same puzzle - which it is only when a write
// failed. Storage also wins ties and a different puzzle. writeDailyEraGames
// differs there: the game being saved replaces a different stored puzzle.
const mergeGames = (
    memory: Record<string, StoredDailyEraGame>,
    stored: Record<string, StoredDailyEraGame>,
): Record<string, StoredDailyEraGame> => {
    const merged = { ...memory };
    for (const [day, game] of Object.entries(stored)) {
        const held = merged[day];
        if (!held || held.puzzleId !== game.puzzleId || !isFurtherAlong(held, game)) merged[day] = game;
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
    // clean up the timer or the storage listener, so the page only rolls over
    // and follows other tabs while a scope owns them.
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
        // A frozen or bfcache'd tab misses storage events, so it catches up
        // when shown again rather than at its next guess. After rollOver, so
        // resume() judges archive against the new day.
        const onVisibilityChange = () => {
            rollOver();
            if (document.visibilityState === "visible") syncFromStorage();
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        // Another tab's save. A null key is localStorage.clear(): memory keeps its games.
        const onStorage = (event: StorageEvent) => {
            if (event.key === DAILY_ERA_STORAGE_KEY) syncFromStorage();
        };
        window.addEventListener("storage", onStorage);
        onScopeDispose(() => {
            clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("storage", onStorage);
        });
    }

    // Shows a stored game. A finished one keeps the archive flag it was saved
    // with; one still in progress is archive once its day has passed, since
    // its next guess will be.
    const resume = (record: StoredDailyEraGame) => {
        guesses.value = record.guesses;
        answer.value = record.answer;
        status.value = gameOutcome(record.guesses);
        archive.value = (record.archive ?? false) || (date.value !== today.value && status.value === "playing");
    };

    // Takes in what other tabs saved. The open game moves to the stored copy
    // unless this one is further along - but not while a guess is in flight:
    // its save() settles that against storage.
    const syncFromStorage = () => {
        games.value = mergeGames(games.value, readDailyEraGames());
        if (status.value !== "playing" || submitting.value || !puzzle.value) return;
        const stored = games.value[date.value];
        if (stored?.puzzleId === puzzle.value.puzzleId) resume(stored);
    };

    /**
     * `guessedOn` is the local day the guess was sent, not when it was scored:
     * it decides archive. Returns false when storage already held this day at
     * least as far along (another tab played on): the game has moved to that
     * copy and this guess counts for nothing.
     */
    const save = (guessedOn: string): boolean => {
        if (!puzzle.value) return true;
        today.value = toIsoDate(new Date());
        archive.value = archive.value || date.value !== guessedOn;
        const record: StoredDailyEraGame = {
            puzzleId: puzzle.value.puzzleId,
            puzzleNumber: puzzle.value.puzzleNumber,
            guesses: guesses.value,
            answer: answer.value,
            archive: archive.value,
        };
        // Compared before it goes into the ref, which would hand back proxies.
        const written = writeDailyEraGames({ ...games.value, [date.value]: record });
        const kept = written[date.value];
        // In memory even when storage is blocked, so this session's streak shows.
        games.value = { ...written, [date.value]: kept ?? record };
        if (kept && kept !== record) {
            resume(kept);
            return false;
        }
        return true;
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
            if (resumed) resume(resumed);
            else status.value = gameOutcome(guesses.value);
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

    /**
     * Resolves true once the guess is scored, false if it was refused or
     * failed, or another tab got further with this day first.
     */
    const guess = async (season: number): Promise<boolean> => {
        // First, so the checks below see a game another tab played on.
        syncFromStorage();
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
        if (!save(guessedOn)) return false;
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
