import { ref } from "vue";
import { getMonthGames } from "@/network/scores";
import { countGamesByDay } from "@/utils/calendarGameCounts";

/** A v-calendar page; only the fields we read. month is 1-based. */
export interface CalendarPage {
    month?: number;
    year?: number;
}

/**
 * Per-day game counts for the Scores calendar, one /api/scores request per month.
 * A month is only marked loaded once its counts are stored, so a failed
 * request is retried the next time v-calendar reports that page.
 */
export function useCalendarGameCounts(now: () => Date = () => new Date()) {
    const gameCounts = ref<Map<string, number>>(new Map());
    const fetched = new Set<string>();
    const inFlight = new Set<string>();

    const loadMonth = async (year: number, month: number): Promise<void> => {
        const key = `${year}-${month}`;
        if (fetched.has(key) || inFlight.has(key)) return;
        inFlight.add(key);

        try {
            const data = await getMonthGames(year, month);
            for (const [day, count] of countGamesByDay(data.events ?? [], year, month, now())) {
                gameCounts.value.set(day, count);
            }
            fetched.add(key);
        } catch (err) {
            console.error("Failed to fetch calendar game counts", err);
        } finally {
            inFlight.delete(key);
        }
    };

    const loadMonths = async (pages: CalendarPage[] | CalendarPage | null | undefined): Promise<void> => {
        const list = Array.isArray(pages) ? pages : pages ? [pages] : [];
        await Promise.all(
            list
                .filter((page) => page.month && page.year)
                .map((page) => loadMonth(page.year!, page.month!)),
        );
    };

    return { gameCounts, loadMonths };
}
