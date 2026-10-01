import { describe, it, expect } from "vitest";
import {
    formatDateForEspn,
    toIsoDate,
    parseIsoDate,
    isSameDay,
    formatNumericDate,
    formatDate,
    formatTime,
    formatDateTime,
} from "@/utils/date";

describe("formatDateForEspn", () => {
    it("formats as YYYYMMDD with no separators", () => {
        expect(formatDateForEspn(new Date(2026, 5, 8))).toBe("20260608");
    });

    it("pads single-digit months and days", () => {
        expect(formatDateForEspn(new Date(2026, 0, 5))).toBe("20260105");
    });
});

describe("toIsoDate", () => {
    it("formats as YYYY-MM-DD", () => {
        expect(toIsoDate(new Date(2026, 5, 8))).toBe("2026-06-08");
    });

    it("pads single-digit months and days", () => {
        expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    });
});

describe("parseIsoDate", () => {
    it("round-trips with toIsoDate", () => {
        const original = new Date(2026, 5, 8);
        expect(parseIsoDate(toIsoDate(original))!.getTime()).toBe(original.getTime());
    });

    it("parses as a local date, not UTC", () => {
        // new Date("2026-06-08") parses as UTC midnight and renders as
        // June 7th in any timezone west of Greenwich - this is the bug
        // parseIsoDate exists to avoid.
        const parsed = parseIsoDate("2026-06-08")!;
        expect(parsed.getFullYear()).toBe(2026);
        expect(parsed.getMonth()).toBe(5);
        expect(parsed.getDate()).toBe(8);
    });

    it("returns null for a malformed string", () => {
        expect(parseIsoDate("not-a-date")).toBeNull();
        expect(parseIsoDate("2026/06/08")).toBeNull();
        expect(parseIsoDate("")).toBeNull();
    });

    it("returns null for a calendar date that doesn't exist", () => {
        // Date silently rolls Feb 30 into March - reject rather than
        // silently accepting the wrong day.
        expect(parseIsoDate("2026-02-30")).toBeNull();
    });
});

describe("isSameDay", () => {
    it("is true for the same calendar day at different times", () => {
        expect(
            isSameDay(new Date(2026, 5, 8, 1, 0), new Date(2026, 5, 8, 23, 59)),
        ).toBe(true);
    });

    it("is false across a day boundary", () => {
        expect(isSameDay(new Date(2026, 5, 8), new Date(2026, 5, 9))).toBe(false);
    });
});

// Intl puts a narrow no-break space before AM/PM in recent ICU versions.
const spaces = (s: string) => s.replace(/\s/g, " ");

// Thursday, October 1 2026, 7:30 PM local time.
const evening = new Date(2026, 9, 1, 19, 30);
// Monday, January 5 2026, 12:05 AM local time.
const pastMidnight = new Date(2026, 0, 5, 0, 5);

describe("formatNumericDate", () => {
    it("writes each format with zero-padded days and months", () => {
        expect(formatNumericDate(pastMidnight, "YYYY-MM-DD")).toBe("2026-01-05");
        expect(formatNumericDate(pastMidnight, "DD/MM/YYYY")).toBe("05/01/2026");
        expect(formatNumericDate(pastMidnight, "MM/DD/YYYY")).toBe("01/05/2026");
    });

    it("uses the local calendar day, not UTC", () => {
        expect(formatNumericDate(new Date(2026, 9, 1, 23, 59), "YYYY-MM-DD")).toBe("2026-10-01");
    });
});

describe("formatDate", () => {
    describe("automatic, as each page showed it before the setting", () => {
        it("long: the Scores header, always en-US", () => {
            expect(formatDate(evening, "long", "auto")).toBe(
                evening.toLocaleDateString("en-us", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                }),
            );
            expect(formatDate(evening, "long", "auto")).toBe("Thursday, October 1, 2026");
        });

        it("medium: My Teams and the News fallback, in the browser locale", () => {
            expect(formatDate(evening, "medium", "auto")).toBe(
                evening.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                }),
            );
        });

        it("short: the public team page, the browser locale's default", () => {
            expect(formatDate(evening, "short", "auto")).toBe(evening.toLocaleDateString());
        });

        it("accepts timestamps and ISO strings like the old call sites did", () => {
            const iso = evening.toISOString();
            expect(formatDate(iso, "short", "auto")).toBe(new Date(iso).toLocaleDateString());
            expect(formatDate(evening.getTime(), "medium", "YYYY-MM-DD")).toBe("2026-10-01");
        });
    });

    it("long keeps the weekday and writes the date in the chosen format", () => {
        expect(formatDate(evening, "long", "YYYY-MM-DD")).toBe("Thursday, 2026-10-01");
        expect(formatDate(evening, "long", "DD/MM/YYYY")).toBe("Thursday, 01/10/2026");
        expect(formatDate(evening, "long", "MM/DD/YYYY")).toBe("Thursday, 10/01/2026");
    });

    it("medium and short are just the chosen format", () => {
        for (const style of ["medium", "short"] as const) {
            expect(formatDate(evening, style, "YYYY-MM-DD")).toBe("2026-10-01");
            expect(formatDate(evening, style, "DD/MM/YYYY")).toBe("01/10/2026");
            expect(formatDate(evening, style, "MM/DD/YYYY")).toBe("10/01/2026");
        }
    });
});

describe("formatTime", () => {
    it("automatic is the score card's old browser-locale time", () => {
        expect(formatTime(evening, "auto")).toBe(
            evening.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
        );
    });

    it("12h and 24h override the locale's clock", () => {
        expect(spaces(formatTime(evening, "12h", "en-GB"))).toMatch(/^07:30 pm$/i);
        expect(formatTime(evening, "24h", "en-US")).toBe("19:30");
    });

    it("24h writes the hour after midnight as 00, not 24", () => {
        expect(formatTime(pastMidnight, "24h", "en-US")).toBe("00:05");
    });

    it("12h writes the hour after midnight as 12", () => {
        expect(spaces(formatTime(pastMidnight, "12h", "en-US"))).toBe("12:05 AM");
    });
});

describe("formatDateTime", () => {
    it("automatic is the game header's old en-US date and time", () => {
        expect(formatDateTime(evening, "auto", "auto")).toBe(
            evening.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
            }),
        );
    });

    it("keeps the long date and applies the time format", () => {
        expect(formatDateTime(evening, "auto", "24h")).toBe("Thursday, October 1, 2026 at 19:30");
        expect(spaces(formatDateTime(evening, "auto", "12h"))).toBe(
            "Thursday, October 1, 2026 at 7:30 PM",
        );
    });

    it("writes the weekday, the chosen date format and the time", () => {
        expect(formatDateTime(evening, "DD/MM/YYYY", "24h")).toBe("Thursday, 01/10/2026, 19:30");
        expect(spaces(formatDateTime(evening, "YYYY-MM-DD", "auto"))).toBe(
            "Thursday, 2026-10-01, 7:30 PM",
        );
        expect(spaces(formatDateTime(evening, "MM/DD/YYYY", "12h"))).toBe(
            "Thursday, 10/01/2026, 7:30 PM",
        );
        expect(formatDateTime(pastMidnight, "YYYY-MM-DD", "24h")).toBe("Monday, 2026-01-05, 00:05");
    });
});
