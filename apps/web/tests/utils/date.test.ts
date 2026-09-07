import { describe, it, expect } from "vitest";
import { formatDateForEspn, toIsoDate, parseIsoDate, isSameDay } from "@/utils/date";

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
