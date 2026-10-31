import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ESPN_TEAM_NAMES, teamFor } from "../../utilities/nba-teams";

const standings: unknown = JSON.parse(
	readFileSync(path.join(__dirname, "../fixtures/espn/standings.json"), "utf8"),
);

const teamsIn = (value: unknown, found = new Map<string, string>()): Map<string, string> => {
	if (Array.isArray(value)) {
		for (const item of value) teamsIn(item, found);
	} else if (typeof value === "object" && value !== null) {
		const { abbreviation, displayName } = value as Record<string, unknown>;
		if (typeof abbreviation === "string" && typeof displayName === "string") {
			found.set(abbreviation, displayName);
		}
		for (const child of Object.values(value)) teamsIn(child, found);
	}
	return found;
};

describe("ESPN_TEAM_NAMES", () => {
	it("names every team the way ESPN's standings do", () => {
		const teams = teamsIn(standings);
		expect(teams.size).toBe(30);
		for (const [abbreviation, displayName] of teams) {
			expect(ESPN_TEAM_NAMES[abbreviation], abbreviation).toBe(displayName);
		}
		expect(Object.keys(ESPN_TEAM_NAMES)).toHaveLength(30);
	});
});

describe("teamFor", () => {
	it("pairs an ESPN code with its full name", () => {
		expect(teamFor("LAC")).toEqual({ full_name: "LA Clippers", abbreviation: "LAC" });
	});

	it("falls back to the abbreviation for a code it doesn't know", () => {
		expect(teamFor("XYZ")).toEqual({ full_name: "XYZ", abbreviation: "XYZ" });
	});
});
