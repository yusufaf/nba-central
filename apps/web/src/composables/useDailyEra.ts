import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { dailyEraApi } from "@/network/api";
import { track } from "@/lib/analytics";
import {
    DAILY_ERA_MAX_ATTEMPTS,
    readDailyEraGame,
    writeDailyEraGame,
    type DailyEraGuess,
} from "@/utils/dailyEra";
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
    const attemptsLeft = computed(() => DAILY_ERA_MAX_ATTEMPTS - guesses.value.length);

    const save = () => {
        if (!puzzle.value) return;
        writeDailyEraGame(date.value, {
            puzzleId: puzzle.value.puzzleId,
            puzzleNumber: puzzle.value.puzzleNumber,
            guesses: guesses.value,
            answer: answer.value,
        });
    };

    const load = async (day: string) => {
        const seq = ++loadSeq;
        submitting.value = false;
        status.value = "loading";
        puzzle.value = null;
        guesses.value = [];
        answer.value = null;
        date.value = day;
        try {
            const res = await dailyEraApi.getPuzzle(day);
            if (seq !== loadSeq) return;
            if (!res.success) {
                status.value = "unavailable";
                return;
            }
            puzzle.value = res.data;
            const stored = readDailyEraGame(day);
            if (stored?.puzzleId === res.data.puzzleId) {
                guesses.value = stored.guesses;
                answer.value = stored.answer;
            }
            const last = guesses.value.at(-1);
            if (last?.hit) status.value = "won";
            else if (guesses.value.length >= DAILY_ERA_MAX_ATTEMPTS) status.value = "lost";
            else status.value = "playing";
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
        save();
        track("daily_era_guessed", { puzzleNumber, attempt, hit: score.hit, band: score.band });
        if (finished) {
            track("daily_era_finished", { puzzleNumber, solved: score.hit, attempts: attempt });
        }
        return true;
    };

    return { status, puzzle, guesses, answer, submitting, attemptsLeft, date, load, guess };
};
