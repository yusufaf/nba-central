/**
 * Date helpers. The first half is for machines: ESPN's scoreboard/summary
 * endpoints and the date in the URL. The second half is every date and time
 * the app shows a person, in the format they chose in Settings - pages call
 * these through useDateFormat rather than toLocale*String.
 */

/** ESPN's `dates=YYYYMMDD` query param format - no dashes. */
export const formatDateForEspn = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
};

const ESPN_DAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

/**
 * The YYYYMMDD day ESPN files a game under: its US Eastern calendar date.
 * Empty for a date that doesn't parse.
 */
export const espnGameDay = (date: string | Date): string => {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    const { year, month, day }: Partial<Record<Intl.DateTimeFormatPartTypes, string>> =
        Object.fromEntries(ESPN_DAY_FORMAT.formatToParts(d).map((p) => [p.type, p.value]));
    if (!year || !month || !day) return "";
    return `${year}${month}${day}`;
};

const ESPN_WEEKDAY_FORMAT = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
});

/**
 * The short weekday ESPN files a game under ("Mon"), from the same Eastern
 * date. Empty for a date that doesn't parse.
 */
export const espnGameWeekday = (date: string | Date): string => {
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? "" : ESPN_WEEKDAY_FORMAT.format(d);
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

const requireIsoDate = (value: string): Date => {
    const date = parseIsoDate(value);
    if (!date) throw new Error(`Not a YYYY-MM-DD date: ${value}`);
    return date;
};

/** The YYYY-MM-DD `days` calendar days after `value` (before, if negative). */
export const addDays = (value: string, days: number): string => {
    const date = requireIsoDate(value);
    return toIsoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
};

/**
 * Whole calendar days from `from` to `to`, negative if `to` is earlier.
 * Measured between UTC midnights of the two local dates, so a DST change in
 * between can't leave an hour over.
 */
export const daysBetween = (from: string, to: string): number => {
    const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return (utc(requireIsoDate(to)) - utc(requireIsoDate(from))) / 86_400_000;
};

export const isSameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

export type DateFormat = "auto" | "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY";
export type TimeFormat = "auto" | "12h" | "24h";
type NumericDateFormat = Exclude<DateFormat, "auto">;

/**
 * Each place the app shows a date, by how it looked before date formats
 * were a setting - which is what "auto" still shows:
 * - long: the Scores header, always en-US ("Wednesday, October 1, 2026")
 * - medium: My Teams and the News fallback, browser locale ("Oct 1, 2026")
 * - short: the public team page, browser locale default ("10/1/2026")
 */
export type DateStyle = "long" | "medium" | "short";

type DateInput = Date | string | number;

const AUTO_DATE: Record<DateStyle, { locale?: string; options: Intl.DateTimeFormatOptions }> = {
    long: {
        locale: "en-US",
        options: { weekday: "long", year: "numeric", month: "long", day: "numeric" },
    },
    medium: { options: { month: "short", day: "numeric", year: "numeric" } },
    short: { options: {} },
};

// The weekday stays a word in every format, in English like the rest of the app.
const weekday = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long" });

// h23, not hour12: false - some engines write the hour after midnight as 24.
const hourCycle = (format: TimeFormat): Intl.DateTimeFormatOptions =>
    format === "auto" ? {} : { hourCycle: format === "12h" ? "h12" : "h23" };

export const formatNumericDate = (d: Date, format: NumericDateFormat): string => {
    const year = String(d.getFullYear());
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    if (format === "YYYY-MM-DD") return `${year}-${month}-${day}`;
    if (format === "DD/MM/YYYY") return `${day}/${month}/${year}`;
    return `${month}/${day}/${year}`;
};

export const formatDate = (input: DateInput, style: DateStyle, format: DateFormat): string => {
    const d = new Date(input);
    if (format === "auto") {
        const { locale, options } = AUTO_DATE[style];
        return d.toLocaleDateString(locale, options);
    }
    const numeric = formatNumericDate(d, format);
    return style === "long" ? `${weekday(d)}, ${numeric}` : numeric;
};

/**
 * A time of day, e.g. a game's tip-off. "auto" is the score card's old
 * browser-locale time; 12h/24h keep the locale but force its clock.
 * `locale` is for tests - the app always passes the browser's.
 */
export const formatTime = (input: DateInput, format: TimeFormat, locale?: string): string =>
    new Date(input).toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
        ...hourCycle(format),
    });

/** The game page header: the long date and the time, en-US like before. */
export const formatDateTime = (
    input: DateInput,
    dateFormat: DateFormat,
    timeFormat: TimeFormat,
): string => {
    const d = new Date(input);
    const time: Intl.DateTimeFormatOptions = {
        hour: "numeric",
        minute: "2-digit",
        ...hourCycle(timeFormat),
    };
    if (dateFormat === "auto") {
        return d.toLocaleDateString("en-US", { ...AUTO_DATE.long.options, ...time });
    }
    return `${formatDate(d, "long", dateFormat)}, ${d.toLocaleTimeString("en-US", time)}`;
};
