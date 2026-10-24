import { describe, it, expect } from "vitest";
import {
	PLAYER_STATS_PK,
	SeasonStats,
	servableStats,
	validateCareer,
} from "utilities/player-stats";

const LATEST = 2026;

const season = (year: number, over: Partial<SeasonStats> = {}): SeasonStats => ({
	season: year,
	games_played: 70,
	min: 0,
	fgm: 8,
	fga: 0,
	fg_pct: 0.5,
	fg3m: 0,
	fg3a: 0,
	fg3_pct: 0,
	ftm: 4,
	fta: 0,
	ft_pct: 0,
	oreb: 0,
	dreb: 0,
	reb: 0,
	ast: 0,
	stl: 0,
	blk: 0,
	turnover: 0,
	pf: 0,
	pts: 20,
	...over,
});

const check = (stats: SeasonStats[], active = true) => validateCareer(stats, LATEST, active);

describe("validateCareer", () => {
	it("accepts a valid career, most recent season first", () => {
		expect(check([season(2025), season(2024), season(2023)])).toBeNull();
	});

	it("accepts an empty career for a current player", () => {
		expect(check([])).toBeNull();
	});

	it("rejects an empty career for a retired player", () => {
		expect(check([], false)).toBe("no seasons for a retired player");
	});

	it.each([1945, LATEST + 1])("rejects season %i as out of range", (year) => {
		expect(check([season(year)])).toMatch(/out of range/);
	});

	it("rejects seasons in ascending order", () => {
		expect(check([season(2023), season(2024)])).toMatch(/out of order/);
	});

	it("rejects a duplicate season", () => {
		expect(check([season(2024), season(2024)])).toMatch(/out of order/);
	});

	it.each([-1, NaN, Infinity])("rejects pts of %s", (pts) => {
		expect(check([season(2024, { pts })])).not.toBeNull();
	});

	it("rejects a percentage above 1", () => {
		expect(check([season(2024, { fg_pct: 1.2 })])).toMatch(/fg_pct/);
	});

	it.each([101, 70.5])("rejects games_played of %s", (games_played) => {
		expect(check([season(2024, { games_played })])).toMatch(/games_played/);
	});

	it("rejects points that the made shots don't add up to", () => {
		expect(check([season(2024, { pts: 0 })])).toMatch(/made shots/);
	});

	it("rejects made shots that read as 0 beside real points", () => {
		expect(check([season(2024, { fgm: 0, ftm: 0 })])).toMatch(/made shots/);
	});

	it("accepts columns rounded to 0.1 (LeBron's 2003-04)", () => {
		expect(check([season(2003, { fgm: 7.9, fg3m: 0.8, ftm: 4.4, pts: 20.9 })])).toBeNull();
	});

	it("accepts a pre-1979 season with no 3P, steals, blocks or turnovers", () => {
		const row = season(1965, {
			min: 0,
			fg3m: 0,
			fg3a: 0,
			fg3_pct: 0,
			stl: 0,
			blk: 0,
			turnover: 0,
			oreb: 0,
			dreb: 0,
		});
		expect(check([row], false)).toBeNull();
	});

	it("accepts a Did Not Play season beside a played one", () => {
		const dnp = season(2024, { games_played: 0, fgm: 0, ftm: 0, pts: 0, fg_pct: 0 });
		expect(check([season(2025), dnp])).toBeNull();
	});

	it("rejects a lone Did Not Play season, even for a current player", () => {
		const dnp = season(2026, { games_played: 0, fgm: 0, ftm: 0, pts: 0, fg_pct: 0 });
		expect(check([dnp])).toBe("no season with a game played");
	});

	it("rejects a current player's lone season with games 0 but real stats (a renamed games column)", () => {
		expect(check([season(2025, { games_played: 0 })])).toBe("no season with a game played");
	});

	it("rejects a career with no game played in any season", () => {
		const zero = (year: number) =>
			season(year, { games_played: 0, fgm: 0, ftm: 0, pts: 0, fg_pct: 0 });
		expect(check([zero(2025), zero(2024)])).toBe("no season with a game played");
	});
});

describe("servableStats", () => {
	const stats = [season(2025)];
	const key = { PK: PLAYER_STATS_PK, SK: "jamesle01" };

	it("serves a snapshot item's career", () => {
		expect(servableStats({ ...key, stats, scrapedAt: 1, checkedAt: 1 })).toBe(stats);
	});

	it("serves a legacy cache item however old", () => {
		expect(servableStats({ ...key, stats, freshUntil: 1, ttl: 2 })).toBe(stats);
	});

	it("serves an empty career", () => {
		expect(servableStats({ ...key, stats: [] })).toEqual([]);
	});

	it("has nothing for a legacy failure marker", () => {
		expect(servableStats({ ...key, stats: [], failed: true })).toBeNull();
	});

	it("has nothing for a failure-only item", () => {
		expect(servableStats({ ...key, checkedAt: 1, lastError: "BBRef returned 500" })).toBeNull();
	});

	it("has nothing for a missing item", () => {
		expect(servableStats(undefined)).toBeNull();
	});
});
