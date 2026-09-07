/**
 * Date helpers shared by anything that talks to ESPN's scoreboard/summary
 * endpoints or puts a date in the URL. Lifted out of Scores.vue, which used
 * to hand-roll its own formatDateForEspn/isSameDay - every other date format
 * in the app (NewsCard, GameHeader, ...) is still inline, but the Scores
 * page and its route-query composable both need these.
 */

/** ESPN's `dates=YYYYMMDD` query param format - no dashes. */
export const formatDateForEspn = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
};

/** ISO 8601 calendar date (YYYY-MM-DD), for the ?date= query param. */
export const toIsoDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

/**
 * Parses a YYYY-MM-DD string as a *local* calendar date. Deliberately not
 * `new Date(str)` - the string constructor parses ISO dates as UTC
 * midnight, which renders as the previous day in any timezone west of
 * Greenwich. Returns null for anything that doesn't parse to a real date.
 */
export const parseIsoDate = (value: string): Date | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    // Catches both non-numeric input (NaN propagates) and calendar
    // overflow, e.g. 2026-02-30 - Date silently rolls it into March.
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
};

export const isSameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
