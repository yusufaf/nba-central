import { describe, it, expect } from "vitest";
import { currentSeasonEndYear, currentSeasonStartYear } from "utilities/season";
// apps/web keeps its own copy of the season rollover (the two packages share
// no code), so this is the check that they haven't drifted apart.
import {
	currentSeasonEndYear as webCurrentSeasonEndYear,
	currentSeasonStartYear as webCurrentSeasonStartYear,
} from "../../../web/src/utils/season";

describe("currentSeasonStartYear", () => {
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
});

describe("currentSeasonEndYear", () => {
	it("stays in the current calendar year before the season tips off in October", () => {
		expect(currentSeasonEndYear(new Date(2026, 8, 5))).toBe(2026); // Sept 5, 2026
	});

	it("rolls over to next calendar year once the new season has started", () => {
		expect(currentSeasonEndYear(new Date(2026, 9, 15))).toBe(2027); // Oct 15, 2026
	});

	it("is the year the season ends in across the boundaries", () => {
		expect(currentSeasonEndYear(new Date(2026, 8, 30, 23, 59, 59))).toBe(2026);
		expect(currentSeasonEndYear(new Date(2026, 9, 1, 0, 0, 0))).toBe(2027);
		expect(currentSeasonEndYear(new Date(2027, 0, 1))).toBe(2027);
	});
});

describe("season helpers", () => {
	it("agree with the copy apps/web filters coaches with", () => {
		const dates = [
			new Date(2026, 8, 30, 23, 59, 59),
			new Date(2026, 9, 1, 0, 0, 0),
			new Date(2026, 11, 31),
			new Date(2027, 0, 1),
			new Date(2027, 5, 15),
			new Date(2027, 8, 30),
		];
		for (const d of dates) {
			expect(currentSeasonStartYear(d)).toBe(webCurrentSeasonStartYear(d));
			expect(currentSeasonEndYear(d)).toBe(webCurrentSeasonEndYear(d));
		}
	});
});
