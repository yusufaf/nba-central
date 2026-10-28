import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
	monthGameDates,
	monthMaxAge,
	parseDayParam,
	parseGameIdParam,
	parseMonthParam,
	scoreboardClocks,
	scoresMaxAge,
	summaryClock,
	type GameClock,
} from "../../utilities/scores";
import { etDate } from "../../utilities/espn";

const fixture = (name: string): unknown =>
	JSON.parse(readFileSync(path.join(__dirname, "../fixtures/espn", name), "utf8"));

// 03:30 UTC on Oct 27 is still Oct 26 in New York.
const NOW = new Date("2026-10-27T03:30:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const clock = (state: string | null, offsetMs: number | null): GameClock => ({
	state,
	start: offsetMs === null ? null : NOW.getTime() + offsetMs,
});

describe("parseDayParam", () => {
	it("accepts a real YYYYMMDD date", () => {
		expect(parseDayParam("20261026", NOW)).toBe("20261026");
	});

	it.each(["20261399", "20260230", "2026-10-26", "19991231", "", undefined])(
		"rejects %s",
		(raw) => {
			expect(parseDayParam(raw, NOW)).toBeNull();
		},
	);

	it("allows up to 400 days past today in ET, not UTC", () => {
		const lastDay = etDate(NOW.getTime() + 400 * DAY);
		expect(lastDay).toBe("20271130");
		expect(parseDayParam(lastDay, NOW)).toBe(lastDay);
		expect(parseDayParam("20271201", NOW)).toBeNull();
	});
});

describe("parseMonthParam", () => {
	it("accepts YYYYMM", () => {
		expect(parseMonthParam("202610", NOW)).toBe("202610");
		expect(parseMonthParam("200001", NOW)).toBe("200001");
	});

	it.each(["202613", "202600", "199912", "20261", "202812", undefined])("rejects %s", (raw) => {
		expect(parseMonthParam(raw, NOW)).toBeNull();
	});
});

describe("parseGameIdParam", () => {
	it.each(["401859965", "210115009"])("accepts %s", (raw) => {
		expect(parseGameIdParam(raw)).toBe(raw);
	});

	it.each(["1", "abc", "401859965x", "", undefined])("rejects %s", (raw) => {
		expect(parseGameIdParam(raw)).toBeNull();
	});
});

describe("scoresMaxAge", () => {
	const today = etDate(NOW);
	const yesterday = "20261025";

	it.each<[string, GameClock[], string, number]>([
		["a game in progress", [clock("in", -HOUR)], today, 10],
		["a tip-off 10 minutes away", [clock("pre", 10 * MIN)], today, 10],
		["a delayed tip-off", [clock("pre", -30 * MIN)], today, 10],
		["an unknown state", [clock(null, -HOUR)], today, 10],
		["a game stuck in pre for 7 hours on a past day", [clock("pre", -7 * HOUR)], yesterday, 60],
		["a tip-off 3 hours away", [clock("pre", 3 * HOUR)], today, 60],
		["today, all final", [clock("post", -3 * HOUR)], today, 60],
		["yesterday, all final", [clock("post", -DAY)], yesterday, 86_400],
		["a past day with no games", [], yesterday, 60],
		["a past day with one game not final", [clock("post", -DAY), clock("pre", -2 * DAY)], yesterday, 60],
		["today with no games", [], today, 60],
	])("%s", (_, games, day, maxAge) => {
		expect(scoresMaxAge(games, day, NOW)).toBe(maxAge);
	});
});

describe("monthMaxAge", () => {
	it.each([
		["202609", 100, 86_400],
		["202609", 1, 86_400],
		["202609", 0, 3_600],
		["202610", 100, 3_600],
		["202610", 0, 3_600],
		["202611", 100, 3_600],
	])("%s with %i games", (month, games, maxAge) => {
		expect(monthMaxAge(month, games, NOW)).toBe(maxAge);
	});
});

describe("ESPN body readers", () => {
	it.each([null, "x", [], {}, { events: "x" }])("scoreboardClocks(%j) is null", (body) => {
		expect(scoreboardClocks(body)).toBeNull();
	});

	it.each([null, {}, { header: {} }, { header: { competitions: [] } }])(
		"summaryClock(%j) is null",
		(body) => {
			expect(summaryClock(body)).toBeNull();
		},
	);

	it.each([null, {}, { events: {} }])("monthGameDates(%j) is null", (body) => {
		expect(monthGameDates(body)).toBeNull();
	});

	it("reads a finished past day as settled", () => {
		const clocks = scoreboardClocks(fixture("scoreboard-20250111.json"))!;
		expect(clocks).toHaveLength(7);
		expect(clocks.every((c) => c.state === "post")).toBe(true);
		expect(scoresMaxAge(clocks, "20250111", NOW)).toBe(86_400);
	});

	it("reads games before tip-off", () => {
		const clocks = scoreboardClocks(fixture("scoreboard-20261026.json"))!;
		expect(clocks).toHaveLength(9);
		expect(clocks.every((c) => c.state === "pre" && c.start !== null)).toBe(true);
	});

	it("reads a summary's header", () => {
		expect(
			summaryClock({
				header: {
					competitions: [{ date: "2026-10-26T23:00Z", status: { type: { state: "in" } } }],
				},
			}),
		).toEqual({ state: "in", start: Date.parse("2026-10-26T23:00Z") });
	});

	it("keeps only parseable month dates", () => {
		expect(
			monthGameDates({ events: [{ date: "2026-10-26T23:00Z" }, { date: "nope" }, {}, null] }),
		).toEqual(["2026-10-26T23:00Z"]);
	});
});
