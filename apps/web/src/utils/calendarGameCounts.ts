import { ESPN_SCORES_URL } from "@/constants/constants";
import type { ESPNEvent } from "@/models/types";
import { espnGameDay } from "@/utils/date";

const espnMonth = (year: number, month: number): string =>
    `${year}${String(month).padStart(2, "0")}`;

/**
 * One request for a whole month. ESPN rejects YYYYMMDD-YYYYMMDD ranges with a
 * 400, defaults to 100 events without a limit, and silently returns far fewer
 * above 1000 - the busiest month has ~240.
 */
export const monthScoreboardUrl = (year: number, month: number): string =>
    `${ESPN_SCORES_URL}?dates=${espnMonth(year, month)}&limit=1000`;

/**
 * Games per ESPN day (YYYYMMDD) for one month; `month` is 1-based, like
 * v-calendar pages. A day is only counted, as 0 if need be, up to ESPN's
 * today or the month's last listed game, whichever is later: past that the
 * schedule may not be published yet, so the day is left unknown rather than
 * "0 Games". Events with an unparseable date are skipped.
 */
export const countGamesByDay = (
    events: Pick<ESPNEvent, "date">[],
    year: number,
    month: number,
    today: Date,
): Map<string, number> => {
    const prefix = espnMonth(year, month);
    const games = new Map<string, number>();
    let lastGameDay = "";

    for (const event of events) {
        const day = espnGameDay(event.date);
        if (!day.startsWith(prefix)) continue;
        games.set(day, (games.get(day) ?? 0) + 1);
        // ESPN doesn't return events in date order.
        if (day > lastGameDay) lastGameDay = day;
    }

    const todayKey = espnGameDay(today);
    const knownThrough = todayKey > lastGameDay ? todayKey : lastGameDay;
    const daysInMonth = new Date(year, month, 0).getDate();
    const counts = new Map<string, number>();

    for (let d = 1; d <= daysInMonth; d++) {
        const key = `${prefix}${String(d).padStart(2, "0")}`;
        if (key > knownThrough) break;
        counts.set(key, games.get(key) ?? 0);
    }

    return counts;
};
