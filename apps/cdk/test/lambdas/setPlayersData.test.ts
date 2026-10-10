import { describe, it, expect } from "vitest";
import { parsePage, activeSeasonEndYear } from "lambdas/setPlayersData/src/setPlayersData";

const row = (id: string, name: string, yearMax: string) =>
	`<tr><th data-stat="player" data-append-csv="${id}"><a>${name}</a></th>` +
	`<td data-stat="pos">F</td><td data-stat="height">6-9</td>` +
	`<td data-stat="weight">220</td><td data-stat="year_max">${yearMax}</td></tr>`;

const page = (...rows: string[]) =>
	`<table id="players"><tbody>` +
	`<tr class="thead"><th>Player</th></tr>${rows.join("")}</tbody></table>`;

const activeOn = (html: string, now: Date) =>
	Object.fromEntries(
		parsePage(html, activeSeasonEndYear(now)).map((p) => [p.id, p.active]),
	);

describe("activeSeasonEndYear", () => {
	it.each([
		["Sep 30", new Date(2026, 8, 30, 23, 59, 59), 2026],
		["Oct 1", new Date(2026, 9, 1), 2026],
		["Oct 10", new Date(2026, 9, 10), 2026],
		["Oct 31 23:59:59", new Date(2026, 9, 31, 23, 59, 59), 2026],
		["Nov 1 00:00", new Date(2026, 10, 1, 0, 0, 0), 2027],
		["Jan 1", new Date(2027, 0, 1), 2027],
		["next Sep 30", new Date(2027, 8, 30), 2027],
	])("%s gives %i", (_label, now, expected) => {
		expect(activeSeasonEndYear(now)).toBe(expected);
	});
});

describe("parsePage active flag", () => {
	const html = page(
		row("curryst01", "Stephen Curry", "2027"),
		row("lastyr01", "Last Year", "2026"),
		row("nomax01", "No Max", ""),
	);

	it("keeps 2025-26 players active through Sep 30", () => {
		expect(activeOn(html, new Date(2026, 8, 30)).lastyr01).toBe(true);
	});

	it("keeps 2025-26 players active through the preseason (#193)", () => {
		for (const now of [
			new Date(2026, 9, 1),
			new Date(2026, 9, 10),
			new Date(2026, 9, 31, 23, 59, 59),
		]) {
			expect(activeOn(html, now).lastyr01).toBe(true);
		}
	});

	it("flips 2025-26 players inactive once the season is underway", () => {
		expect(activeOn(html, new Date(2026, 10, 1)).lastyr01).toBe(false);
	});

	it("marks a player who has played this season active", () => {
		for (const now of [new Date(2026, 9, 21), new Date(2026, 10, 1)]) {
			expect(activeOn(html, now).curryst01).toBe(true);
		}
	});

	it("treats a missing year_max as inactive", () => {
		expect(activeOn(html, new Date(2026, 10, 1)).nomax01).toBe(false);
	});
});
