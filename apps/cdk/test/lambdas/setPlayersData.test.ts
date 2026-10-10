import { describe, it, expect } from "vitest";
import { parsePage } from "lambdas/setPlayersData/src/setPlayersData";
import { currentSeasonEndYear } from "utilities/season";

const row = (id: string, name: string, yearMax: string) =>
	`<tr><th data-stat="player" data-append-csv="${id}"><a>${name}</a></th>` +
	`<td data-stat="pos">F</td><td data-stat="height">6-9</td>` +
	`<td data-stat="weight">220</td><td data-stat="year_max">${yearMax}</td></tr>`;

const page = (...rows: string[]) =>
	`<table id="players"><tbody>` +
	`<tr class="thead"><th>Player</th></tr>${rows.join("")}</tbody></table>`;

const activeById = (html: string, seasonEndYear: number) =>
	Object.fromEntries(parsePage(html, seasonEndYear).map((p) => [p.id, p.active]));

describe("parsePage active flag", () => {
	const html = page(
		row("curryst01", "Stephen Curry", "2027"),
		row("lastyr01", "Last Year", "2026"),
		row("nomax01", "No Max", ""),
	);

	it("marks a player whose last season is the current one active", () => {
		const seasonEndYear = currentSeasonEndYear(new Date(2026, 9, 1)); // 2027
		expect(activeById(html, seasonEndYear).curryst01).toBe(true);
	});

	it("marks a player whose last season was 2025-26 inactive once 2026-27 starts", () => {
		const seasonEndYear = currentSeasonEndYear(new Date(2026, 9, 1)); // 2027
		expect(activeById(html, seasonEndYear).lastyr01).toBe(false);
	});

	it("keeps 2025-26 players active through Sep 30", () => {
		const seasonEndYear = currentSeasonEndYear(new Date(2026, 8, 30)); // 2026
		expect(activeById(html, seasonEndYear).lastyr01).toBe(true);
	});

	it("treats a missing year_max as inactive", () => {
		const seasonEndYear = currentSeasonEndYear(new Date(2026, 9, 1));
		expect(activeById(html, seasonEndYear).nomax01).toBe(false);
	});
});
