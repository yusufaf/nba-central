import { describe, it, expect } from "vitest";
import {
	formatIsoDate,
	isPlayableDay,
	lastPlayableSeason,
	parseIsoDate,
	playableDays,
	puzzleForDate,
	puzzleMaxAge,
	revealFor,
	scoreGuess,
} from "../../utilities/daily-era";
import type { DailyEraPuzzle } from "../../models/daily-era";

const at = (iso: string) => Date.parse(iso);
const day = (iso: string) => parseIsoDate(iso)!;

const identity = (mediaId: string) => ({ franchise: "OKC", name: "Seattle SuperSonics 1995-1997 Home", startYear: 1996, mediaId });

const puzzle = (n: number): DailyEraPuzzle => ({
	puzzleId: `puzzle${n}`,
	imageKey: `daily-era/image${n}.webp`,
	answerSeasons: [1996],
	runLabel: "1995-96",
	franchise: "OKC",
	teamName: "Seattle SuperSonics",
	identities: [identity(`31d308_${n}`)],
	shownIdentity: identity(`31d308_${n}`),
});

describe("parseIsoDate / formatIsoDate", () => {
	it("round-trips a calendar date as a UTC day number", () => {
		expect(formatIsoDate(day("2026-10-05"))).toBe("2026-10-05");
		expect(day("2026-10-06") - day("2026-10-05")).toBe(1);
	});

	it.each(["2026-02-30", "2026-1-5", "guess", "", "2026-13-01"])("rejects %j", (value) => {
		expect(parseIsoDate(value)).toBeNull();
	});
});

describe("playableDays", () => {
	it("spans date(now-12h) - 30 .. date(now+14h)", () => {
		const { first, last } = playableDays(at("2026-11-06T00:00:00Z"));
		expect(formatIsoDate(first)).toBe("2026-10-06");
		expect(formatIsoDate(last)).toBe("2026-11-06");
	});

	it("opens the next day once it is midnight in UTC+14", () => {
		expect(formatIsoDate(playableDays(at("2026-11-06T09:59:59.999Z")).last)).toBe("2026-11-06");
		expect(formatIsoDate(playableDays(at("2026-11-06T10:00:00Z")).last)).toBe("2026-11-07");
	});
});

describe("isPlayableDay", () => {
	it("closes a day once it has left every time zone's 30-day archive", () => {
		expect(isPlayableDay(day("2026-10-06"), at("2026-11-06T11:59:59.999Z"))).toBe(true);
		expect(isPlayableDay(day("2026-10-06"), at("2026-11-06T12:00:00Z"))).toBe(false);
	});

	it("has already closed puzzle #1 on launch day", () => {
		expect(isPlayableDay(day("2026-10-05"), at("2026-11-06T00:00:00Z"))).toBe(false);
	});
});

describe("lastPlayableSeason", () => {
	// Season end years: 2026-27 is 2027. Holds in any TZ the tests run in.
	it("moves to the new season once Oct 1 has started anywhere", () => {
		expect(lastPlayableSeason(at("2026-09-30T09:59:59Z"))).toBe(2026);
		expect(lastPlayableSeason(at("2026-09-30T10:00:00Z"))).toBe(2027);
	});
});

describe("puzzleForDate", () => {
	const list = [puzzle(1), puzzle(2), puzzle(3)];
	const now = at("2026-10-07T12:00:00Z");
	const lookup = (date: string) => puzzleForDate(list, date, now, "2026-10-05");

	it("maps a date to its list position", () => {
		expect(lookup("2026-10-05")).toMatchObject({ ok: true, puzzleNumber: 1, puzzle: list[0] });
		expect(lookup("2026-10-07")).toMatchObject({ ok: true, puzzleNumber: 3, puzzle: list[2], day: day("2026-10-07") });
	});

	it("refuses a date before puzzle #1", () => {
		expect(lookup("2026-10-04")).toEqual({ ok: false, reason: "not-playable" });
	});

	it("refuses a playable date past the end of the list", () => {
		expect(lookup("2026-10-08")).toEqual({ ok: false, reason: "not-playable" });
	});

	it("refuses a date outside the window", () => {
		expect(lookup("2026-10-10")).toEqual({ ok: false, reason: "not-playable" });
	});

	it("refuses a malformed date", () => {
		expect(lookup("bad")).toEqual({ ok: false, reason: "invalid-date" });
	});
});

describe("puzzleMaxAge", () => {
	it("caps at an hour", () => {
		expect(puzzleMaxAge(day("2026-11-06"), at("2026-11-06T00:00:00Z"))).toBe(3600);
	});

	it("never outlives the day's playable window", () => {
		expect(puzzleMaxAge(day("2026-10-06"), at("2026-11-06T11:30:00Z"))).toBe(1800);
	});

	it("is 0 at or after the window closes", () => {
		expect(puzzleMaxAge(day("2026-10-06"), at("2026-11-06T12:00:00Z"))).toBe(0);
		expect(puzzleMaxAge(day("2026-10-06"), at("2026-11-07T00:00:00Z"))).toBe(0);
	});
});

describe("scoreGuess", () => {
	it("hits any answer season", () => {
		expect(scoreGuess([1996], 1996)).toEqual({ hit: true, direction: null, band: null });
	});

	it.each([
		[1994, "later", "close"],
		[1999, "earlier", "close"],
		[2000, "earlier", "near"],
		[1986, "later", "near"],
		[1985, "later", "far"],
	])("scores %i against [1996] as %s/%s", (season, direction, band) => {
		expect(scoreGuess([1996], season)).toEqual({ hit: false, direction, band });
	});

	it("breaks a tie toward the earlier answer", () => {
		expect(scoreGuess([1996, 1998], 1997)).toEqual({ hit: false, direction: "earlier", band: "close" });
	});

	it("keeps the earlier answer on a tie whatever the input order", () => {
		expect(scoreGuess([1998, 1996], 1997)).toEqual({ hit: false, direction: "earlier", band: "close" });
	});

	it("measures against the nearest answer", () => {
		expect(scoreGuess([1990, 2005], 2003)).toEqual({ hit: false, direction: "later", band: "close" });
	});
});

describe("revealFor", () => {
	it("returns only the reveal fields", () => {
		expect(Object.keys(revealFor(puzzle(1))).sort()).toEqual([
			"franchise",
			"runLabel",
			"shownIdentity",
			"teamName",
		]);
	});
});
