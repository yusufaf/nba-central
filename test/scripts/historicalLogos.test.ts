import { describe, it, expect } from "vitest";
import {
	collapseEras,
	formatYears,
	parseFranchiseSeasons,
	parseFranchises,
	parseLogoBase,
	type Franchise,
} from "../../scripts/lib/historicalLogos";

describe("parseLogoBase", () => {
	it("extracts the versioned CDN base from a season page", () => {
		const html = `<img src="https://cdn.ssref.net/req/202608270/tlogo/bbr/OKC-2025.png">`;
		expect(parseLogoBase(html)).toBe(
			"https://cdn.ssref.net/req/202608270/tlogo/bbr/",
		);
	});

	it("falls back to a pinned version when the page carries no match", () => {
		expect(parseLogoBase("<html></html>")).toBe(
			"https://cdn.ssref.net/req/202106291/tlogo/bbr/",
		);
	});
});

describe("parseFranchises", () => {
	// A trimmed copy of basketball-reference.com/teams/: one active franchise,
	// one defunct, and a header row that must not be mistaken for data.
	const html = `
<html><body>
<table id="teams_active">
	<thead>
		<tr class="thead"><th data-stat="franch_name">Franchise</th></tr>
	</thead>
	<tbody>
		<tr class="full_table">
			<th data-stat="franch_name"><a href="/teams/OKC/">Oklahoma City Thunder</a></th>
			<td data-stat="lg_id">NBA</td>
			<td data-stat="year_min">1967-68</td>
			<td data-stat="year_max">2026-27</td>
		</tr>
	</tbody>
</table>
<table id="teams_defunct">
	<tbody>
		<tr class="full_table">
			<th data-stat="franch_name"><a href="/teams/AND/">Anderson Packers</a></th>
			<td data-stat="lg_id">NBA</td>
			<td data-stat="year_min">1949-50</td>
			<td data-stat="year_max">1949-50</td>
		</tr>
	</tbody>
</table>
</body></html>
`;

	it("parses both the active and defunct tables", () => {
		const franchises = parseFranchises(html);
		expect(franchises).toHaveLength(2);
	});

	it("converts BBRef season-start labels to CDN end years", () => {
		const [okc] = parseFranchises(html);
		expect(okc).toEqual({
			code: "OKC",
			name: "Oklahoma City Thunder",
			league: "NBA",
			yearMin: 1968,
			yearMax: 2027,
		});
	});

	it("skips the header row, which carries no franchise link", () => {
		const franchises = parseFranchises(html);
		expect(franchises.find((f) => f.name === "Franchise")).toBeUndefined();
	});
});

describe("parseFranchiseSeasons", () => {
	// A franchise page's season table plus a decoy nav-dropdown link for a
	// *different* team elsewhere on the page, mirroring how BBRef repeats
	// /teams/<code>/<year>.html links for every current team outside table#<CODE>.
	const html = `
<html><body>
<div class="nav-dropdown"><a href="/teams/BOS/2027.html">Boston Celtics</a></div>
<table id="OKC">
	<thead>
		<tr><th data-stat="season">Season</th></tr>
	</thead>
	<tbody>
		<tr>
			<th data-stat="season"><a href="/teams/OKC/2027.html">2026-27</a></th>
			<td data-stat="team_name"><a href="/teams/OKC/2027.html">Oklahoma City Thunder</a></td>
		</tr>
		<tr>
			<th data-stat="season"><a href="/teams/SEA/1968.html">1967-68</a></th>
			<td data-stat="team_name"><a href="/teams/SEA/1968.html">Seattle SuperSonics</a></td>
		</tr>
	</tbody>
</table>
</body></html>
`;

	it("parses only rows inside the franchise's own table", () => {
		const seasons = parseFranchiseSeasons(html, "OKC");
		expect(seasons).toHaveLength(2);
		expect(seasons.every((s) => s.teamCode !== "BOS")).toBe(true);
	});

	it("carries the season's team code, year, and display name", () => {
		const seasons = parseFranchiseSeasons(html, "OKC");
		expect(seasons).toContainEqual({
			teamCode: "SEA",
			year: 1968,
			teamName: "Seattle SuperSonics",
		});
	});

	it("strips BBRef's trailing playoff-berth asterisk from the team name", () => {
		// The "*" sits outside the <a>, as a sibling text node - matches
		// basketball-reference.com/teams/WSC/'s markup for a playoff season.
		const withAsterisk = `
<html><body>
<table id="WSC">
	<tbody>
		<tr>
			<th data-stat="season"><a href="/teams/WSC/1950.html">1949-50</a></th>
			<td data-stat="team_name"><a href="/teams/WSC/1950.html">Washington Capitols</a>*</td>
		</tr>
	</tbody>
</table>
</body></html>
`;
		const seasons = parseFranchiseSeasons(withAsterisk, "WSC");
		expect(seasons[0].teamName).toBe("Washington Capitols");
	});
});

describe("formatYears", () => {
	it("renders a single season as one label", () => {
		expect(formatYears(1968, 1968)).toBe("1967-68");
	});

	it("renders a span as two labels joined by an en dash", () => {
		expect(formatYears(1976, 1985)).toBe("1975-76 – 1984-85");
	});
});

describe("collapseEras", () => {
	const franchise: Franchise = {
		code: "SAC",
		name: "Sacramento Kings",
		league: "NBA",
		yearMin: 1949,
		yearMax: 2027,
	};

	it("merges consecutive seasons that share a hash and name into one era", () => {
		const eras = collapseEras(franchise, [
			{ teamCode: "KCK", year: 1976, teamName: "Kansas City Kings", hash: "a" },
			{ teamCode: "KCK", year: 1977, teamName: "Kansas City Kings", hash: "a" },
			{ teamCode: "KCK", year: 1978, teamName: "Kansas City Kings", hash: "a" },
		]);

		expect(eras).toEqual([
			{
				franchise: "SAC",
				franchiseName: "Sacramento Kings",
				team: "KCK",
				name: "Kansas City Kings",
				league: "NBA",
				startYear: 1976,
				endYear: 1978,
				years: "1975-76 – 1977-78",
				logoHash: "a",
			},
		]);
	});

	it("breaks the era on a hash change even when the name stays the same", () => {
		const eras = collapseEras(franchise, [
			{ teamCode: "SAC", year: 1994, teamName: "Sacramento Kings", hash: "a" },
			{ teamCode: "SAC", year: 1995, teamName: "Sacramento Kings", hash: "b" },
		]);

		expect(eras.map((e) => e.logoHash)).toEqual(["a", "b"]);
	});

	it("breaks the era on a name change even when the hash stays the same", () => {
		const eras = collapseEras(franchise, [
			{ teamCode: "KCK", year: 1985, teamName: "Kansas City Kings", hash: "a" },
			{ teamCode: "SAC", year: 1986, teamName: "Sacramento Kings", hash: "a" },
		]);

		expect(eras).toHaveLength(2);
		expect(eras.map((e) => e.name)).toEqual([
			"Kansas City Kings",
			"Sacramento Kings",
		]);
	});

	it("does not break the era on a code change alone", () => {
		// Mirrors the Nuggets' ABA-to-NBA transition: DNA -> DEN, same name,
		// same logo, one era.
		const eras = collapseEras(franchise, [
			{ teamCode: "DNA", year: 1975, teamName: "Denver Nuggets", hash: "a" },
			{ teamCode: "DEN", year: 1976, teamName: "Denver Nuggets", hash: "a" },
		]);

		expect(eras).toHaveLength(1);
		expect(eras[0].team).toBe("DNA");
		expect(eras[0].endYear).toBe(1976);
	});

	it("breaks the era on a year gap", () => {
		const eras = collapseEras(franchise, [
			{ teamCode: "SAC", year: 1994, teamName: "Sacramento Kings", hash: "a" },
			{ teamCode: "SAC", year: 1996, teamName: "Sacramento Kings", hash: "a" },
		]);

		expect(eras).toHaveLength(2);
	});

	it("sorts out-of-order seasons before collapsing", () => {
		const eras = collapseEras(franchise, [
			{ teamCode: "SAC", year: 1996, teamName: "Sacramento Kings", hash: "a" },
			{ teamCode: "SAC", year: 1995, teamName: "Sacramento Kings", hash: "a" },
		]);

		expect(eras).toHaveLength(1);
		expect(eras[0]).toMatchObject({ startYear: 1995, endYear: 1996 });
	});
});
