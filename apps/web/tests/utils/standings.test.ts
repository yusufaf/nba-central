import { describe, it, expect } from "vitest";
import {
    formatGamesBehind,
    formatWinPercent,
    nextGames,
    ordinal,
    recordWinPercent,
    standingsByTeam,
    teamDetailsLines,
} from "@/utils/standings";
import type { GameStatus, ScheduleFile, ScheduleGame, StandingsFile } from "@/models/liveData";
import standingsFixture from "../fixtures/liveData/standings.json";

const standings = standingsByTeam(standingsFixture as StandingsFile);

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

describe("standingsByTeam", () => {
    it("keys every team by its ESPN id, with its conference", () => {
        expect(standings.size).toBe(30);
        expect(standings.get("20")?.conference).toBe("East");
        expect(standings.get("20")?.team.abbreviation).toBe("PHI");
    });
});

describe("ordinal", () => {
    it.each([
        [1, "1st"],
        [2, "2nd"],
        [3, "3rd"],
        [4, "4th"],
        [11, "11th"],
        [12, "12th"],
        [13, "13th"],
        [21, "21st"],
        [22, "22nd"],
        [101, "101st"],
    ])("%i is %s", (n, text) => {
        expect(ordinal(n)).toBe(text);
    });
});

describe("recordWinPercent", () => {
    it.each([
        ["2-0", 1],
        ["1-3", 0.25],
        ["0-0", null],
        ["", null],
        ["x", null],
    ])("%s is %s", (record, pct) => {
        expect(recordWinPercent(record)).toBe(pct);
    });
});

describe("teamDetailsLines", () => {
    it("lists the home team's standing, home record and all", () => {
        expect(teamDetailsLines(standings.get("20")!, "home")).toEqual([
            { text: "1st in Eastern Conference" },
            { text: "Streak: W3", tone: "positive" },
            { text: "Seed: 1", tone: "positive" },
            { text: "Overall Win Pct: 100.0%" },
            { text: "Home Win Pct: 100.0%" },
            { text: "Games Behind 1st: 0" },
        ]);
    });

    it("leaves out a road record with no games yet", () => {
        expect(teamDetailsLines(standings.get("19")!, "away")).toEqual([
            { text: "13th in Eastern Conference" },
            { text: "Streak: L2", tone: "negative" },
            { text: "Seed: 13", tone: "negative" },
            { text: "Overall Win Pct: 0.0%" },
            { text: "Games Behind 1st: 2.5" },
        ]);
    });

    it("leaves out a streak ESPN didn't give", () => {
        const { conference, team } = standings.get("20")!;
        const lines = teamDetailsLines({ conference, team: { ...team, streak: "" } }, "home");
        expect(lines.some((line) => line.text.startsWith("Streak"))).toBe(false);
    });
});
