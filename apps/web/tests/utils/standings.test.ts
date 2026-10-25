import { describe, it, expect } from "vitest";
import { formatGamesBehind, formatWinPercent, nextGames } from "@/utils/standings";
import type { GameStatus, ScheduleFile, ScheduleGame } from "@/models/liveData";

const game = (id: string, date: string, home: string, away: string, status: GameStatus = "scheduled"): ScheduleGame => ({
    id,
    date,
    status,
    home: { espnId: home, abbreviation: `T${home}`, score: null },
    away: { espnId: away, abbreviation: `T${away}`, score: null },
});

const schedule = (games: ScheduleGame[]): ScheduleFile => ({
    version: 1,
    generatedAt: "2026-10-26T12:07:00.000Z",
    dates: [],
    games,
});

const NOW = new Date("2026-10-26T20:00:00Z");

describe("nextGames", () => {
    it("picks each team's earliest future scheduled game, home or away", () => {
        const next = nextGames(
            schedule([
                game("late", "2026-10-28T23:00Z", "1", "2"),
                game("soon", "2026-10-27T00:00Z", "1", "3"),
            ]),
            NOW,
        );
        expect(next.get("1")).toEqual({ opponent: "T3", home: true, date: "2026-10-27T00:00Z" });
        expect(next.get("3")).toEqual({ opponent: "T1", home: false, date: "2026-10-27T00:00Z" });
        expect(next.get("2")).toEqual({ opponent: "T1", home: false, date: "2026-10-28T23:00Z" });
    });

    it("skips finals, live and postponed games, and games already started", () => {
        const next = nextGames(
            schedule([
                game("past", "2026-10-26T19:00Z", "1", "2"),
                game("final", "2026-10-27T00:00Z", "1", "2", "final"),
                game("live", "2026-10-27T00:00Z", "1", "2", "live"),
                game("postponed", "2026-10-27T00:00Z", "1", "2", "postponed"),
            ]),
            NOW,
        );
        expect(next.size).toBe(0);
    });

    it("counts a game tipping off exactly now", () => {
        expect(nextGames(schedule([game("now", "2026-10-26T20:00Z", "1", "2")]), NOW).has("1")).toBe(true);
    });

    it("returns nothing without a schedule", () => {
        expect(nextGames(null, NOW).size).toBe(0);
    });
});

describe("formatters", () => {
    it("formats games behind", () => {
        expect(formatGamesBehind(0)).toBe("-");
        expect(formatGamesBehind(1.5)).toBe("1.5");
        expect(formatGamesBehind(3)).toBe("3");
    });

    it("formats win percent the way standings print it", () => {
        expect(formatWinPercent(0.6667)).toBe(".667");
        expect(formatWinPercent(0)).toBe(".000");
        expect(formatWinPercent(1)).toBe("1.000");
    });
});
