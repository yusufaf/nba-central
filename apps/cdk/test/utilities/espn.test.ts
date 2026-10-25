import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
	HEADSHOT_REFRESH_SECONDS,
	HEADSHOT_RETRY_SECONDS,
	MIN_MATCHED_ATHLETES,
	headshotsShrinkReason,
	parseRoster,
	parseScoreboardDay,
	parseStandings,
	pickHeadshotsToMirror,
	scheduleDates,
	scheduleShrinkReason,
} from "utilities/espn";
import type {
	HeadshotEntry,
	ScheduleFile,
	ScheduleGame,
	StandingsFile,
} from "models/live-data";

// Trimmed copies of real ESPN responses (fetched 2026-10-25), keeping only
// the fields the parsers read.
const fixture = (name: string): any =>
	JSON.parse(
		readFileSync(path.join(__dirname, "../fixtures/espn", name), "utf8"),
	);

const GENERATED = "2026-10-25T12:07:00.000Z";

const standings = (): StandingsFile => {
	const parsed = parseStandings(fixture("standings.json"), GENERATED);
	if (!parsed.ok) throw new Error(parsed.error);
	return parsed.value;
};

describe("parseStandings", () => {
	it("parses the real standings into East/West sorted by seed", () => {
		const file = standings();
		expect(file.version).toBe(1);
		expect(file.generatedAt).toBe(GENERATED);
		expect(file.season).toEqual({ year: 2027, displayName: "2026-27" });
		expect(file.conferences.map((c) => c.name)).toEqual(["East", "West"]);
		for (const { teams } of file.conferences) {
			expect(teams).toHaveLength(15);
			expect(teams.map((t) => t.seed)).toEqual(
				[...teams.map((t) => t.seed)].sort((a, b) => a - b),
			);
		}
		const bucks = file.conferences[0].teams.find((t) => t.abbreviation === "MIL");
		expect(bucks).toMatchObject({
			espnId: "15",
			name: "Milwaukee Bucks",
			wins: 0,
			losses: 3,
			winPercent: 0,
			gamesBehind: 3,
			streak: "L3",
			home: "0-1",
		});
		expect(bucks?.lastTen).toMatch(/^\d+-\d+$/);
	});

	it("reads '-' games behind as 0", () => {
		for (const { teams } of standings().conferences) {
			expect(teams.filter((t) => t.gamesBehind === 0).length).toBeGreaterThan(0);
		}
	});

	it("rejects standings missing a conference", () => {
		const body = fixture("standings.json");
		body.children = body.children.slice(0, 1);
		expect(parseStandings(body, GENERATED).ok).toBe(false);
		expect(parseStandings({ children: [] }, GENERATED).ok).toBe(false);
		expect(parseStandings("<html>", GENERATED).ok).toBe(false);
	});

	it("rejects a conference with 14 teams", () => {
		const body = fixture("standings.json");
		body.children[1].standings.entries.pop();
		const parsed = parseStandings(body, GENERATED);
		expect(parsed).toEqual({ ok: false, error: expect.stringContaining("West") });
	});

	it("rejects a non-numeric win total", () => {
		const body = fixture("standings.json");
		const wins = body.children[0].standings.entries[0].stats.find(
			(s: any) => s.type === "wins",
		);
		wins.value = "zero";
		expect(parseStandings(body, GENERATED).ok).toBe(false);
	});

	it("tied seeds sort by win percent, then name (not rejected)", () => {
		const body = fixture("standings.json");
		for (const entry of body.children[0].standings.entries) {
			entry.stats.find((s: any) => s.type === "playoffseed").value = 1;
		}
		const parsed = parseStandings(body, GENERATED);
		if (!parsed.ok) throw new Error(parsed.error);
		const east = parsed.value.conferences[0].teams;
		for (let i = 1; i < east.length; i++) {
			const [a, b] = [east[i - 1], east[i]];
			expect(
				a.winPercent > b.winPercent ||
					(a.winPercent === b.winPercent && a.name <= b.name),
			).toBe(true);
		}
	});
});

describe("parseScoreboardDay", () => {
	const day = (name: string): ScheduleGame[] => {
		const parsed = parseScoreboardDay(fixture(name));
		if (!parsed.ok) throw new Error(parsed.error);
		return parsed.value;
	};

	it("parses a scoreboard day; pre-game score is null", () => {
		const games = day("scoreboard-20261026.json");
		expect(games).toHaveLength(9);
		expect(games[0]).toEqual({
			id: "401909868",
			date: "2026-10-26T23:00Z",
			status: "scheduled",
			home: { espnId: "30", abbreviation: "CHA", score: null },
			away: { espnId: "27", abbreviation: "WSH", score: null },
		});
	});

	it("parses an event date without seconds and keeps it verbatim", () => {
		expect(day("scoreboard-20261026.json").map((g) => g.date)).toContain(
			"2026-10-27T00:30Z",
		);
	});

	it("maps post to final with numeric scores", () => {
		const finals = day("scoreboard-20250111.json").filter((g) => g.status === "final");
		expect(finals).toHaveLength(4);
		for (const game of finals) {
			expect(game.home.score).toEqual(expect.any(Number));
			expect(game.home.score! + game.away.score!).toBeGreaterThan(0);
		}
	});

	it("maps a postponed game (state post, STATUS_POSTPONED, score '0') to postponed", () => {
		expect(
			day("scoreboard-20250111.json").filter((g) => g.status === "postponed"),
		).toHaveLength(3);
	});

	it("maps in to live", () => {
		const body = fixture("scoreboard-20261026.json");
		body.events[0].competitions[0].status.type = { name: "STATUS_IN_PROGRESS", state: "in" };
		body.events[0].competitions[0].competitors[0].score = "54";
		const parsed = parseScoreboardDay(body);
		if (!parsed.ok) throw new Error(parsed.error);
		expect(parsed.value[0]).toMatchObject({ status: "live", home: { score: 54 } });
	});

	it("accepts an empty day", () => {
		expect(parseScoreboardDay({ events: [] })).toEqual({ ok: true, value: [] });
	});

	it("rejects an event without a home team", () => {
		const body = fixture("scoreboard-20261026.json");
		body.events[2].competitions[0].competitors[0].homeAway = "away";
		expect(parseScoreboardDay(body).ok).toBe(false);
	});

	it("rejects a bad date and a non-numeric score", () => {
		const badDate = fixture("scoreboard-20261026.json");
		badDate.events[0].date = "Monday";
		expect(parseScoreboardDay(badDate).ok).toBe(false);

		const badScore = fixture("scoreboard-20250111.json");
		const final = badScore.events.find(
			(e: any) => e.competitions[0].status.type.name === "STATUS_FINAL",
		);
		final.competitions[0].competitors[0].score = "n/a";
		expect(parseScoreboardDay(badScore).ok).toBe(false);
	});

	it("rejects a body without events", () => {
		expect(parseScoreboardDay({}).ok).toBe(false);
	});
});

describe("parseRoster", () => {
	it("parses a roster; flags missing headshot", () => {
		const body = fixture("roster-13.json");
		delete body.athletes[1].headshot;
		const parsed = parseRoster(body, "LAL");
		if (!parsed.ok) throw new Error(parsed.error);
		expect(parsed.value).toHaveLength(5);
		expect(parsed.value[0]).toEqual({
			espnId: "5113969",
			name: "Cameron Carr",
			heightInches: 77,
			team: "LAL",
			hasHeadshot: true,
		});
		expect(parsed.value[1].hasHeadshot).toBe(false);
	});

	it("rejects an empty roster or an athlete without an id", () => {
		expect(parseRoster({ athletes: [] }, "LAL").ok).toBe(false);
		const body = fixture("roster-13.json");
		delete body.athletes[0].id;
		expect(parseRoster(body, "LAL").ok).toBe(false);
	});

	it("reads a missing height as null", () => {
		const body = fixture("roster-13.json");
		delete body.athletes[0].height;
		const parsed = parseRoster(body, "LAL");
		if (!parsed.ok) throw new Error(parsed.error);
		expect(parsed.value[0].heightInches).toBeNull();
	});
});

describe("scheduleDates", () => {
	it("uses the ET date", () => {
		// 03:00Z on the 25th is still the 24th in New York.
		expect(scheduleDates(new Date("2026-10-25T03:00:00Z"))).toEqual([
			"20261023", "20261024", "20261025", "20261026",
			"20261027", "20261028", "20261029", "20261030",
		]);
	});

	it("returns 8 distinct consecutive dates across both DST changes", () => {
		expect(scheduleDates(new Date("2026-11-02T04:30:00Z"))).toEqual([
			"20261031", "20261101", "20261102", "20261103",
			"20261104", "20261105", "20261106", "20261107",
		]);
		expect(scheduleDates(new Date("2027-03-14T04:30:00Z"))).toEqual([
			"20270312", "20270313", "20270314", "20270315",
			"20270316", "20270317", "20270318", "20270319",
		]);
		expect(scheduleDates(new Date("2027-03-15T04:30:00Z"))).toEqual([
			"20270314", "20270315", "20270316", "20270317",
			"20270318", "20270319", "20270320", "20270321",
		]);
	});

	it("crosses a month and a year", () => {
		expect(scheduleDates(new Date("2026-12-30T17:00:00Z"), 0, 3)).toEqual([
			"20261230", "20261231", "20270101", "20270102",
		]);
	});
});

describe("scheduleShrinkReason", () => {
	const game = (id: number, date: string): ScheduleGame => ({
		id: String(id),
		date,
		status: "scheduled",
		home: { espnId: "1", abbreviation: "ATL", score: null },
		away: { espnId: "2", abbreviation: "BOS", score: null },
	});
	const file = (dates: string[], games: ScheduleGame[]): ScheduleFile => ({
		version: 1,
		generatedAt: GENERATED,
		dates,
		games,
	});
	// 12 games on Oct 26 ET (23:00Z) and 12 on Oct 23 ET.
	const prev = file(
		["20261023", "20261026"],
		[
			...Array.from({ length: 12 }, (_, i) => game(i, "2026-10-26T23:00Z")),
			...Array.from({ length: 12 }, (_, i) => game(100 + i, "2026-10-23T23:00Z")),
		],
	);

	it("allows a first run", () => {
		expect(scheduleShrinkReason(null, file(["20261026"], []))).toBeNull();
	});

	it("ignores rolled-off dates", () => {
		// Oct 23 rolled out of the window; only Oct 26's 12 games count.
		const next = file(
			["20261026"],
			Array.from({ length: 6 }, (_, i) => game(i, "2026-10-26T23:00Z")),
		);
		expect(scheduleShrinkReason(prev, next)).toBeNull();
		expect(scheduleShrinkReason(prev, file(["20261027"], []))).toBeNull();
	});

	it("refuses a halving", () => {
		const next = file(
			["20261026"],
			Array.from({ length: 5 }, (_, i) => game(i, "2026-10-26T23:00Z")),
		);
		expect(scheduleShrinkReason(prev, next)).toMatch(/12/);
	});

	it("allows fewer than 10 prior games to drop", () => {
		const small = file(
			["20261026"],
			Array.from({ length: 9 }, (_, i) => game(i, "2026-10-26T23:00Z")),
		);
		expect(scheduleShrinkReason(small, file(["20261026"], []))).toBeNull();
	});

	it("dates a late game by its ET day, not its UTC day", () => {
		// 02:00Z on the 27th is a 10 PM tip on the 26th in New York.
		const late = file(
			["20261026"],
			Array.from({ length: 12 }, (_, i) => game(i, "2026-10-27T02:00Z")),
		);
		expect(scheduleShrinkReason(late, file(["20261026"], []))).not.toBeNull();
		expect(scheduleShrinkReason(late, file(["20261027"], []))).toBeNull();
	});
});

describe("headshotsShrinkReason", () => {
	it("refuses fewer than the minimum, or below 80% of the previous map", () => {
		expect(headshotsShrinkReason(null, MIN_MATCHED_ATHLETES)).toBeNull();
		expect(headshotsShrinkReason(null, MIN_MATCHED_ATHLETES - 1)).not.toBeNull();
		expect(headshotsShrinkReason(500, 400)).toBeNull();
		expect(headshotsShrinkReason(500, 399)).not.toBeNull();
	});
});

describe("pickHeadshotsToMirror", () => {
	const NOW_S = 1_800_000_000;
	const entry = (overrides: Partial<HeadshotEntry>): HeadshotEntry => ({
		espnId: "1",
		team: "LAL",
		hasHeadshot: true,
		image: null,
		imageAt: null,
		attemptAt: null,
		etag: null,
		...overrides,
	});
	const mirrored = (ageS: number) =>
		entry({ image: "headshots/1.png", imageAt: NOW_S - ageS, attemptAt: NOW_S - ageS });

	it("orders missing before stale and caps", () => {
		const players = {
			stale2: mirrored(HEADSHOT_REFRESH_SECONDS + 10),
			stale1: mirrored(HEADSHOT_REFRESH_SECONDS + 99),
			fresh: mirrored(HEADSHOT_REFRESH_SECONDS - 1),
			missingB: entry({}),
			missingA: entry({}),
		};
		expect(pickHeadshotsToMirror(players, NOW_S, 10)).toEqual([
			"missingA",
			"missingB",
			"stale1",
			"stale2",
		]);
		expect(pickHeadshotsToMirror(players, NOW_S, 3)).toEqual([
			"missingA",
			"missingB",
			"stale1",
		]);
	});

	it("skips hasHeadshot false and a failed attempt under a day old", () => {
		const players = {
			none: entry({ hasHeadshot: false }),
			failedRecently: entry({ attemptAt: NOW_S - HEADSHOT_RETRY_SECONDS + 1 }),
			failedYesterday: entry({ attemptAt: NOW_S - HEADSHOT_RETRY_SECONDS }),
			staleRefreshFailed: {
				...mirrored(HEADSHOT_REFRESH_SECONDS + 10),
				attemptAt: NOW_S - 3600,
			},
		};
		expect(pickHeadshotsToMirror(players, NOW_S, 10)).toEqual(["failedYesterday"]);
	});
});
