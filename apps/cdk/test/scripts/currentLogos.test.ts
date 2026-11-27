import { describe, it, expect } from "vitest";
import { currentLogoObjectKey, parseCurrentLogos } from "../../scripts/lib/currentLogos";

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
			{ name: "Atlanta Hawks", slug: "atl", source: logoUrl("atl") },
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

		expect(rows.map((row) => row.slug)).toEqual(["atl", "bos", "det", "gs"]);
	});

	it("takes the slug from the logo's file name", () => {
		const [row] = parseCurrentLogos(payload([team("utah")]));

		expect(row.slug).toBe("utah");
	});

	it("leaves source and slug empty when a team has no default logo", () => {
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

		expect(row).toMatchObject({ source: "", slug: "" });
	});

	it("returns no rows when the payload shape changes", () => {
		expect(parseCurrentLogos("{}")).toEqual([]);
	});
});

describe("currentLogoObjectKey", () => {
	const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

	it("content-addresses the image under logos/current/", () => {
		expect(currentLogoObjectKey("atl", png)).toMatch(
			/^logos\/current\/atl\.[0-9a-f]{12}\.png$/,
		);
	});

	it("is stable for identical bytes and changes with them", () => {
		const same = currentLogoObjectKey("atl", new Uint8Array(png));
		expect(same).toBe(currentLogoObjectKey("atl", png));

		const edited = new Uint8Array(png);
		edited[edited.length - 1] = 9;
		expect(currentLogoObjectKey("atl", edited)).not.toBe(same);
	});
});
