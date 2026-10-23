import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { capFiveApi } from "@/network/api";
import { track } from "@/lib/analytics";
import { CAP_FIVE_LINEUP_SIZE } from "@/constants/capFive";
import {
    capFiveGrade,
    capFiveStats,
    readCapFiveGames,
    writeCapFiveGame,
    type StoredCapFiveGame,
} from "@/utils/capFive";
import { toIsoDate } from "@/utils/date";
import type { CapFivePuzzleView, CapFiveResult, SubmitCapFiveResponse } from "@/models/api";

export type CapFiveStatus = "loading" | "picking" | "submitted" | "unavailable" | "expired" | "error";

const statusOf = (err: unknown): number | undefined =>
    (err as { response?: { status?: number } } | null)?.response?.status;

/**
 * One day's Cap Five game: the pool, the picks and, once locked in, the
 * reveal. A day is played once: a stored result is shown without asking the
 * server again.
 */
export const useCapFive = () => {
    const status = ref<CapFiveStatus>("loading");
    const puzzle = ref<CapFivePuzzleView | null>(null);
    const picks = ref<string[]>([]);
    const result = ref<CapFiveResult | null>(null);
    const archive = ref(false);
    const submitting = ref(false);
    const date = ref("");
    const today = ref("");
    const games = ref<Record<string, StoredCapFiveGame>>({});
    const stats = computed(() => capFiveStats(games.value, today.value));

    // Guards against a load that lands after a newer one.
    let loadSeq = 0;

    const show = (game: StoredCapFiveGame) => {
        result.value = game.result;
        archive.value = game.archive;
        picks.value = [...game.result.picks];
        status.value = "submitted";
    };

    const load = async (day: string) => {
        const seq = ++loadSeq;
        status.value = "loading";
        puzzle.value = null;
        picks.value = [];
        result.value = null;
        archive.value = false;
        submitting.value = false;
        date.value = day;
        today.value = toIsoDate(new Date());
        games.value = readCapFiveGames();

        const stored = games.value[day];
        if (stored) {
            show(stored);
            track("cap_five_viewed", { puzzleNumber: stored.result.puzzleNumber, state: "finished" });
            return;
        }
        try {
            const res = await capFiveApi.getPuzzle(day);
            if (seq !== loadSeq) return;
            if (!res.success) {
                status.value = "unavailable";
                return;
            }
            puzzle.value = res.data;
            status.value = "picking";
            track("cap_five_viewed", { puzzleNumber: res.data.puzzleNumber, state: "new" });
        } catch (err) {
            if (seq !== loadSeq) return;
            if (statusOf(err) === 410) {
                status.value = "unavailable";
            } else {
                console.error("Failed to load the Cap Five puzzle:", err);
                status.value = "error";
            }
        }
    };

    const toggle = (id: string) => {
        if (status.value !== "picking" || submitting.value) return;
        if (picks.value.includes(id)) picks.value = picks.value.filter((p) => p !== id);
        else if (picks.value.length < CAP_FIVE_LINEUP_SIZE) picks.value = [...picks.value, id];
    };

    /** Resolves true once the lineup is scored and saved. */
    const submit = async (): Promise<boolean> => {
        if (status.value !== "picking" || submitting.value || picks.value.length !== CAP_FIVE_LINEUP_SIZE) {
            return false;
        }
        // Another tab may have locked this day in already: show its result.
        const elsewhere = readCapFiveGames()[date.value];
        if (elsewhere) {
            games.value = { ...games.value, [date.value]: elsewhere };
            show(elsewhere);
            return false;
        }

        submitting.value = true;
        const seq = loadSeq;
        const lockedOn = toIsoDate(new Date());
        let res: SubmitCapFiveResponse | undefined;
        let failure: unknown;
        try {
            res = await capFiveApi.submit({ date: date.value, picks: picks.value });
        } catch (err) {
            failure = err;
        }
        if (seq !== loadSeq) return false;
        submitting.value = false;

        if (!res?.success) {
            if (statusOf(failure) === 410) {
                status.value = "expired";
            } else {
                console.error("Cap Five submit failed:", failure ?? res?.error);
                toast.error("Couldn't submit your lineup. Try again.");
            }
            return false;
        }

        today.value = lockedOn;
        const kept = writeCapFiveGame(date.value, { result: res.data, archive: date.value !== lockedOn });
        games.value = { ...readCapFiveGames(), [date.value]: kept };
        show(kept);
        track("cap_five_submitted", { puzzleNumber: kept.result.puzzleNumber, grade: capFiveGrade(kept.result) });
        return true;
    };

    return { status, puzzle, picks, result, archive, submitting, date, today, games, stats, load, toggle, submit };
};
