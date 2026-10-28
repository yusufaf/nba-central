import { describe, it, expect } from "vitest";
import { countGamesByDay, espnMonth } from "@/utils/calendarGameCounts";

const TODAY = new Date("2026-10-17T16:00Z");
const game = (date: string) => ({ date });

describe("espnMonth", () => {
    it("formats a 1-based month as YYYYMM", () => {
        expect(espnMonth(2026, 1)).toBe("202601");
        expect(espnMonth(2026, 11)).toBe("202611");
    });
});

describe("countGamesByDay", () => {
    it("files a late game under its Eastern day, not the next UTC day", () => {
        const counts = countGamesByDay(
            [game("2026-01-31T17:00Z"), game("2026-02-01T01:30Z")],
            2026, 1, TODAY,
        );
        expect(counts.get("20260131")).toBe(2);
        expect(counts.has("20260201")).toBe(false);
    });

    it("zero-fills every day of a past month with no games", () => {
        const counts = countGamesByDay([], 2026, 7, TODAY);
        expect(counts.size).toBe(31);
        expect([...counts.values()].every((n) => n === 0)).toBe(true);
    });

    it("leaves an unpublished future month out entirely", () => {
        expect(countGamesByDay([], 2027, 6, TODAY).size).toBe(0);
    });

    it("stops a partly published future month at its last game, whatever the event order", () => {
        const counts = countGamesByDay(
            [game("2027-04-11T23:00Z"), game("2027-04-01T23:00Z")],
            2027, 4, TODAY,
        );
        expect(counts.get("20270401")).toBe(1);
        expect(counts.get("20270402")).toBe(0);
        expect(counts.get("20270411")).toBe(1);
        expect(counts.has("20270412")).toBe(false);
        expect(counts.size).toBe(11);
    });

    it("fills the current month through today", () => {
        const counts = countGamesByDay([game("2026-10-03T23:00Z")], 2026, 10, TODAY);
        expect(counts.get("20261003")).toBe(1);
        expect(counts.get("20261017")).toBe(0);
        expect(counts.has("20261018")).toBe(false);
        expect(counts.size).toBe(17);
    });

    it("skips an event with a malformed date and still counts the rest", () => {
        const counts = countGamesByDay(
            [game("TBD"), game("2026-01-31T17:00Z")],
            2026, 1, TODAY,
        );
        expect(counts.get("20260131")).toBe(1);
        expect(counts.size).toBe(31);
    });

    it("takes today as ESPN's Eastern day, not the viewer's local date", () => {
        // Both are Oct 17 Eastern. The first is Oct 16 west of Eastern; the
        // second is Oct 18 in UTC and east of it.
        for (const instant of ["2026-10-17T05:00Z", "2026-10-18T02:00Z"]) {
            const counts = countGamesByDay([], 2026, 10, new Date(instant));
            expect(counts.has("20261017")).toBe(true);
            expect(counts.has("20261018")).toBe(false);
        }
    });

    it("fills the current month through its last scheduled game when that is after today", () => {
        const counts = countGamesByDay([game("2026-10-25T23:00Z")], 2026, 10, TODAY);
        expect(counts.get("20261025")).toBe(1);
        expect(counts.has("20261026")).toBe(false);
        expect(counts.size).toBe(25);
    });
});
