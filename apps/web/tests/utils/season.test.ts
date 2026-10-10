import { afterEach, describe, expect, it, vi } from "vitest";
import { currentSeasonEndYear, currentSeasonStartYear } from "@/utils/season";

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
