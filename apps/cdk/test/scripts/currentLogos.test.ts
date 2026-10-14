import { describe, it, expect } from "vitest";
import { parseCurrentLogos } from "../../scripts/lib/currentLogos";

const logoUrl = (slug: string) =>
	`https://a.espncdn.com/i/teamlogos/nba/500/${slug}.png`;

// Shaped like site.api.espn.com/apis/site/v2/sports/basketball/nba/teams.
const payload = (teams: object[]) =>
	JSON.stringify({
		sports: [{ leagues: [{ teams: teams.map((team) => ({ team })) }] }],
	});

const team = (slug: string, displayName = slug.toUpperCase()) => ({
	displayName,
	logos: [{ rel: ["full", "default"], href: logoUrl(slug) }],
});

describe("parseCurrentLogos", () => {
	it("takes each team's default logo, even when it is not listed first", () => {
		const rows = parseCurrentLogos(
			payload([
				{
					displayName: "Atlanta Hawks",
					logos: [
						{
							rel: ["full", "dark"],
							href: "https://a.espncdn.com/i/teamlogos/nba/500-dark/atl.png",
						},
						{ rel: ["full", "default"], href: logoUrl("atl") },
					],
				},
			]),
		);

		expect(rows).toEqual([
			{ name: "Atlanta Hawks", logo: logoUrl("atl") },
		]);
	});

	it("uses ESPN's displayName as the name", () => {
		const [row] = parseCurrentLogos(
			payload([team("lac", "LA Clippers")]),
		);

		expect(row.name).toBe("LA Clippers");
	});

	it("sorts by logo file name, the order the dialog has always shown", () => {
		const rows = parseCurrentLogos(
			payload([team("bos"), team("gs"), team("atl"), team("det")]),
		);

		expect(rows.map((row) => row.logo)).toEqual([
			logoUrl("atl"),
			logoUrl("bos"),
			logoUrl("det"),
			logoUrl("gs"),
		]);
	});

	it("leaves logo empty when a team has no default logo", () => {
		const [row] = parseCurrentLogos(
			payload([
				{
					displayName: "Atlanta Hawks",
					logos: [
						{
							rel: ["full", "dark"],
							href: "https://a.espncdn.com/i/teamlogos/nba/500-dark/atl.png",
						},
					],
				},
			]),
		);

		expect(row.logo).toBe("");
	});

	it("returns no rows when the payload shape changes", () => {
		expect(parseCurrentLogos("{}")).toEqual([]);
	});
});
