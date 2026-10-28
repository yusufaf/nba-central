import type { ESPNEvent } from "@/models/types";
import { isSameDay } from "@/utils/date";

// A day that isn't the viewer's local today is still polled while one of its
// games is on or within a day of tip-off, so a viewer east of ET after local
// midnight, or one watching a late game on "yesterday", stays live. A game
// still "pre" hours after its start is stuck or postponed, not live.
export const POLL_LOOKAHEAD_MS = 24 * 3_600_000;
export const POLL_STUCK_MS = 6 * 3_600_000;

/** Whether the scoreboard for `forDate` should keep refreshing. */
export const shouldPollScoreboard = (events: ESPNEvent[], forDate: Date, now: Date): boolean => {
    const today = isSameDay(forDate, now);
    return events.some((event) => {
        const type = event.competitions?.[0]?.status?.type;
        if (!type || type.completed) return false;
        if (type.state === "in" || today) return true;
        const start = Date.parse(event.date);
        return (
            Number.isFinite(start) &&
            start - now.getTime() <= POLL_LOOKAHEAD_MS &&
            now.getTime() - start <= POLL_STUCK_MS
        );
    });
};
