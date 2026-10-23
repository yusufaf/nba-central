import { describe, it, expect } from "vitest";
import {
	buildCapFivePuzzle,
	capFivePuzzleNumber,
	chooseCap,
	eligiblePlayers,
	lineupSums,
	parseCapFivePuzzle,
	publishDates,
	scoreLineup,
	selectPool,
	solveOptimal,
	toPuzzleView,
} from "../../utilities/cap-five";
import { formatIsoDate, parseIsoDate, playableDays } from "../../utilities/daily-era";
import { mulberry32, seedFromString } from "../../utilities/seeded-random";
import {
	CAP_FIVE_FIRST_DATE,
	type CapFiveCandidate,
	type CapFivePuzzle,
} from "../../models/cap-five";

type Rating = { rating: number; ratingSource: string; positions?: string[] };

// 15 players per band, so every band can fill its slots, plus the cases the
// filter must drop.
const BANDS = [
	{ min: 90, max: 99 },
	{ min: 80, max: 89 },
	{ min: 70, max: 79 },
	{ min: 65, max: 69 },
];
const players: { id: string; first_name: string; last_name: string }[] = [];
const ratings: Record<string, Rating> = {};
const SOURCES = ["current", "all-time", "classic-peak"];
BANDS.forEach((band, b) => {
	for (let i = 0; i < 15; i++) {
		const id = `p${b}${String(i).padStart(2, "0")}`;
		players.push({ id, first_name: `First${i}`, last_name: `Band${b}Last${String.fromCharCode(65 + i)}` });
		ratings[id] = {
			rating: band.min + (i % (band.max - band.min + 1)),
			ratingSource: SOURCES[i % 3],
			positions: [["PG", "SG", "SF", "PF", "C"][i % 5]],
		};
	}
});
players.push(
	{ id: "jonesbo01", first_name: "Bobby", last_name: "Jones" },
	{ id: "jonesbo02", first_name: "Bobby", last_name: "Jones" },
	{ id: "westbru01", first_name: "Russell", last_name: "Westbrook" },
	{ id: "nopos01", first_name: "No", last_name: "Positions" },
	{ id: "unrated01", first_name: "Un", last_name: "Rated" },
);
ratings.jonesbo01 = { rating: 90, ratingSource: "all-time", positions: ["PF"] };
ratings.jonesbo02 = { rating: 70, ratingSource: "classic-peak", positions: ["PF"] };
ratings.westbru01 = { rating: 42, ratingSource: "current", positions: ["PG"] };
ratings.nopos01 = { rating: 80, ratingSource: "current", positions: [] };

const meta = { gameVersion: "2K27", ratingsGenerated: "2026-10-17T00:00:00.000Z" };
const eligible = eligiblePlayers(players, ratings);
const noon = (date: string) => Date.parse(`${date}T12:00:00Z`);

const candidate = (id: string, rating: number): CapFiveCandidate => ({
	id,
	name: `Player ${id}`,
	positions: ["SF"],
	rating,
	ratingSource: "current",
});

describe("seeded random", () => {
	it("repeats for the same date and differs for another", () => {
		const draw = (s: string) => {
			const random = mulberry32(seedFromString(s));
			return [random(), random(), random()];
		};
		expect(draw("cap-five:2026-10-22")).toEqual(draw("cap-five:2026-10-22"));
		expect(draw("cap-five:2026-10-23")).not.toEqual(draw("cap-five:2026-10-22"));
	});
});

describe("eligiblePlayers", () => {
	it("keeps rated players from 65 up with positions and a unique name", () => {
		const ids = eligible.map((p) => p.id);
		expect(ids).toHaveLength(60);
		for (const dropped of ["jonesbo01", "jonesbo02", "westbru01", "nopos01", "unrated01"]) {
			expect(ids).not.toContain(dropped);
		}
	});

	it("doesn't depend on input order", () => {
		const shuffled = [...players].reverse();
		expect(eligiblePlayers(shuffled, ratings)).toEqual(eligible);
	});

	it("drops a name shared once accents are folded", () => {
		const out = eligiblePlayers(
			[
				{ id: "a", first_name: "Nikola", last_name: "Jokić" },
				{ id: "b", first_name: "Nikola", last_name: "Jokic" },
			],
			{ a: { rating: 98, ratingSource: "current", positions: ["C"] }, b: { rating: 70, ratingSource: "classic-peak", positions: ["C"] } },
		);
		expect(out).toEqual([]);
	});

	it("keeps diacritics in the shown name", () => {
		const out = eligiblePlayers([{ id: "a", first_name: "Nikola", last_name: "Jokić" }], {
			a: { rating: 98, ratingSource: "current", positions: ["C"] },
		});
		expect(out[0].name).toBe("Nikola Jokić");
	});
});

describe("selectPool", () => {
	const pool = (date: string) => selectPool(eligible, mulberry32(seedFromString(`cap-five:${date}`)));

	it("draws 2/4/4/2 across the rating bands", () => {
		const ratingsOf = pool("2026-10-22").map((p) => p.rating);
		expect(ratingsOf).toHaveLength(12);
		const inBand = (min: number, max: number) => ratingsOf.filter((r) => r >= min && r <= max).length;
		expect([inBand(90, 99), inBand(80, 89), inBand(70, 79), inBand(65, 69)]).toEqual([2, 4, 4, 2]);
	});

	it("is the same for a date and lists players by last name", () => {
		const once = pool("2026-10-22");
		expect(pool("2026-10-22")).toEqual(once);
		expect(pool("2026-10-23")).not.toEqual(once);
		const lastNames = once.map((p) => p.name.split(" ").slice(1).join(" ").toLowerCase());
		expect(lastNames).toEqual([...lastNames].sort());
	});

	it("returns candidates without the sort key", () => {
		expect(Object.keys(pool("2026-10-22")[0]).sort()).toEqual(["id", "name", "positions", "rating", "ratingSource"]);
	});

	it("throws when a band is short", () => {
		const thin = eligible.filter((p) => p.rating < 90 || p.id === eligible.find((q) => q.rating >= 90)!.id);
		expect(() => selectPool(thin, mulberry32(1))).toThrow();
	});
});

describe("lineupSums and chooseCap", () => {
	it("sums every five-player lineup", () => {
		expect(lineupSums([1, 2, 3, 4, 5, 6])).toHaveLength(6);
		expect(lineupSums(Array(12).fill(1))).toHaveLength(792);
	});

	it("picks a reachable cap below the top five's total", () => {
		for (let i = 0; i < 200; i++) {
			const date = formatIsoDate(parseIsoDate("2026-10-22")! + i);
			const random = mulberry32(seedFromString(`cap-five:${date}`));
			const pool = selectPool(eligible, random);
			const sums = lineupSums(pool.map((p) => p.rating));
			const cap = chooseCap(pool, random);
			expect(sums).toContain(cap);
			expect(cap).toBeLessThan(Math.max(...sums));
		}
	});
});

describe("solveOptimal", () => {
	it("finds the best total under the cap, the first lineup and how many reach it", () => {
		const pool = [90, 85, 80, 75, 70, 68, 66].map((r, i) => candidate("abcdefg"[i], r));
		expect(solveOptimal(pool, 380)).toEqual({ total: 379, lineup: ["a", "b", "e", "f", "g"], count: 2 });
	});
});

describe("buildCapFivePuzzle", () => {
	it("freezes a valid puzzle whose optimal is the cap", () => {
		const puzzle = buildCapFivePuzzle("2026-10-22", eligible, meta);
		expect(puzzle.optimal.total).toBe(puzzle.cap);
		expect(puzzle.puzzleNumber).toBe(1);
		expect(parseCapFivePuzzle(JSON.parse(JSON.stringify(puzzle)))).toEqual(puzzle);
		expect(buildCapFivePuzzle("2026-10-22", eligible, meta)).toEqual(puzzle);
	});

	it("doesn't depend on which dates were built before, or change the players", () => {
		const before = structuredClone(eligible);
		buildCapFivePuzzle("2026-10-22", eligible, meta);
		const afterA = buildCapFivePuzzle("2026-10-23", eligible, meta);
		expect(afterA).toEqual(buildCapFivePuzzle("2026-10-23", eligiblePlayers(players, ratings), meta));
		expect(eligible).toEqual(before);
	});
});

describe("capFivePuzzleNumber", () => {
	it("counts from the first date", () => {
		expect(capFivePuzzleNumber(CAP_FIVE_FIRST_DATE)).toBe(1);
		expect(capFivePuzzleNumber(formatIsoDate(parseIsoDate(CAP_FIVE_FIRST_DATE)! + 9))).toBe(10);
	});
});

describe("parseCapFivePuzzle", () => {
	const good = buildCapFivePuzzle("2026-10-22", eligible, meta);
	const broken = (change: (p: CapFivePuzzle) => void) => {
		const copy = structuredClone(good);
		change(copy);
		return copy;
	};

	it.each([
		["a wrong version", (p: CapFivePuzzle) => ((p as { version: number }).version = 2)],
		["a bad date", (p: CapFivePuzzle) => (p.date = "2026-02-30")],
		["11 candidates", (p: CapFivePuzzle) => p.candidates.pop()],
		["a duplicate id", (p: CapFivePuzzle) => (p.candidates[1].id = p.candidates[0].id)],
		["a fractional rating", (p: CapFivePuzzle) => (p.candidates[0].rating = 80.5)],
		["a rating over 99", (p: CapFivePuzzle) => (p.candidates[0].rating = 100)],
		["positions that aren't strings", (p: CapFivePuzzle) => ((p.candidates[0] as { positions: unknown }).positions = [1])],
		["a fractional cap", (p: CapFivePuzzle) => (p.cap = 400.5)],
		["an optimal over the cap", (p: CapFivePuzzle) => (p.optimal.total = p.cap + 1)],
		["an optimal lineup of 4", (p: CapFivePuzzle) => p.optimal.lineup.pop()],
		["an optimal lineup that doesn't add up", (p: CapFivePuzzle) => (p.optimal.total -= 1)],
		["an optimal from outside the pool", (p: CapFivePuzzle) => (p.optimal.lineup[0] = "nobody")],
		["a zero count", (p: CapFivePuzzle) => (p.optimal.count = 0)],
	])("rejects %s", (_, change) => {
		expect(() => parseCapFivePuzzle(broken(change))).toThrow();
	});

	it("rejects something that isn't a puzzle", () => {
		expect(() => parseCapFivePuzzle(null)).toThrow();
		expect(() => parseCapFivePuzzle([])).toThrow();
	});
});

describe("toPuzzleView", () => {
	it("never carries a rating or the optimal", () => {
		const view = toPuzzleView(buildCapFivePuzzle("2026-10-22", eligible, meta));
		const json = JSON.stringify(view);
		for (const secret of ['"rating"', '"ratingSource"', '"optimal"']) expect(json).not.toContain(secret);
		expect(view.candidates).toHaveLength(12);
		expect(Object.keys(view.candidates[0]).sort()).toEqual(["era", "id", "name", "positions"]);
		expect(new Set(view.candidates.map((c) => c.era))).toEqual(new Set(["current", "legend"]));
	});
});

describe("scoreLineup", () => {
	const puzzle = buildCapFivePuzzle("2026-10-22", eligible, meta);
	const ids = puzzle.candidates.map((c) => c.id);
	const ratingOf = (id: string) => puzzle.candidates.find((c) => c.id === id)!.rating;

	it("scores a lineup and reveals the puzzle", () => {
		const result = scoreLineup(puzzle, puzzle.optimal.lineup)!;
		expect(result.total).toBe(puzzle.cap);
		expect(result.busted).toBe(false);
		expect(result.optimal).toEqual(puzzle.optimal);
		expect(result.candidates).toEqual(puzzle.candidates);
		expect(result.picks).toEqual(puzzle.optimal.lineup);
	});

	it("busts over the cap", () => {
		const topFive = [...ids].sort((a, b) => ratingOf(b) - ratingOf(a)).slice(0, 5);
		const result = scoreLineup(puzzle, topFive)!;
		expect(result.total).toBeGreaterThan(puzzle.cap);
		expect(result.busted).toBe(true);
	});

	it.each([
		["four picks", ids.slice(0, 4)],
		["a duplicate pick", [ids[0], ids[0], ids[1], ids[2], ids[3]]],
		["an unknown id", [...ids.slice(0, 4), "nobody"]],
		["a number", [1, 2, 3, 4, 5]],
		["not an array", "abc"],
	])("refuses %s", (_, picks) => {
		expect(scoreLineup(puzzle, picks)).toBeNull();
	});
});

describe("publishDates", () => {
	it("is empty before the first date's window", () => {
		expect(publishDates(noon("2026-10-22"), "2030-01-01")).toEqual([]);
	});

	it("starts at the first date on launch day", () => {
		const now = noon(CAP_FIVE_FIRST_DATE);
		const dates = publishDates(now);
		expect(dates[0]).toBe(CAP_FIVE_FIRST_DATE);
		expect(dates.at(-1)).toBe(formatIsoDate(playableDays(now).last + 7));
	});

	it("covers the whole window plus a week ahead, one date each", () => {
		const now = noon(formatIsoDate(parseIsoDate(CAP_FIVE_FIRST_DATE)! + 60));
		const { first, last } = playableDays(now);
		const dates = publishDates(now);
		expect(dates).toHaveLength(last + 7 - first + 1);
		expect(dates[0]).toBe(formatIsoDate(first));
		expect(dates.at(-1)).toBe(formatIsoDate(last + 7));
		dates.forEach((date, i) => expect(parseIsoDate(date)).toBe(first + i));
	});
});
