import { afterEach, describe, expect, it, vi } from "vitest";
import { currentSeasonEndYear, currentSeasonStartYear, latestScheduleDate } from "@/utils/season";

describe("currentSeasonStartYear", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("is still last season on Sep 30", () => {
        expect(currentSeasonStartYear(new Date(2026, 8, 30, 23, 59, 59))).toBe(2025);
    });

    it("rolls over at midnight on Oct 1", () => {
        expect(currentSeasonStartYear(new Date(2026, 9, 1, 0, 0, 0))).toBe(2026);
    });

    it("stays on the same season across New Year", () => {
        expect(currentSeasonStartYear(new Date(2026, 11, 31))).toBe(2026);
        expect(currentSeasonStartYear(new Date(2027, 0, 1))).toBe(2026);
    });

    it("is still that season through the summer", () => {
        expect(currentSeasonStartYear(new Date(2027, 5, 15))).toBe(2026);
    });

    it("defaults to now", () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 9, 15));
        expect(currentSeasonStartYear()).toBe(2026);
    });
});

describe("currentSeasonEndYear", () => {
    it("is the year the season ends in", () => {
        expect(currentSeasonEndYear(new Date(2026, 8, 30, 23, 59, 59))).toBe(2026);
        expect(currentSeasonEndYear(new Date(2026, 9, 1, 0, 0, 0))).toBe(2027);
        expect(currentSeasonEndYear(new Date(2027, 0, 1))).toBe(2027);
    });
});

describe("latestScheduleDate", () => {
    const ymd = (d: Date) => [d.getFullYear(), d.getMonth(), d.getDate()];

    it("is this June 30 during the season", () => {
        expect(ymd(latestScheduleDate(new Date(2027, 0, 15)))).toEqual([2027, 5, 30]);
        expect(ymd(latestScheduleDate(new Date(2026, 9, 10)))).toEqual([2027, 5, 30]);
    });

    it("is still selectable on June 30 itself", () => {
        expect(ymd(latestScheduleDate(new Date(2027, 5, 30, 18)))).toEqual([2027, 5, 30]);
    });

    it("is this June 30 the day before, and across New Year", () => {
        expect(ymd(latestScheduleDate(new Date(2027, 5, 29)))).toEqual([2027, 5, 30]);
        expect(ymd(latestScheduleDate(new Date(2026, 11, 31)))).toEqual([2027, 5, 30]);
        expect(ymd(latestScheduleDate(new Date(2027, 0, 1)))).toEqual([2027, 5, 30]);
    });

    it("treats Jun 30 23:59 as still that day and Jul 1 00:00 as the next", () => {
        expect(ymd(latestScheduleDate(new Date(2027, 5, 30, 23, 59, 59)))).toEqual([2027, 5, 30]);
        expect(ymd(latestScheduleDate(new Date(2027, 6, 1, 0, 0, 0)))).toEqual([2028, 5, 30]);
    });

    it("rolls to next June 30 on Jul 1, before the Oct 1 season rollover", () => {
        expect(ymd(latestScheduleDate(new Date(2027, 6, 1)))).toEqual([2028, 5, 30]);
        expect(ymd(latestScheduleDate(new Date(2026, 8, 30)))).toEqual([2027, 5, 30]);
    });
});
