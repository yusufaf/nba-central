import { describe, it, expect } from "vitest";
import {
	buildTeamSeasonFile,
	coachByTeam,
	finishedSeasons,
	franchiseResolver,
	indexSeason,
	mergeStints,
	orderRoster,
	parseCoaches,
	parseLeagueTeams,
	parsePerGame,
	positionRank,
	seasonLabel,
	seasonPaths,
	withIndexSeason,
	type PerGameRow,
	type RosterCandidate,
} from "../../scripts/lib/teamSeasons";

// Hand-written in the shape of basketball-reference.com's season pages; no
// copy of a real page is kept in the repo.
const perGamePage = (rows: string, { postRows = "" } = {}) => `
<html><body>
<table class="stats_table sortable" id="per_game_stats">
	<thead><tr><th data-stat="ranker">Rk</th><th data-stat="name_display">Player</th></tr></thead>
	<tbody>${rows}</tbody>
</table>
<table class="stats_table sortable" id="per_game_stats_post">
	<tbody>${postRows}</tbody>
</table>
</body></html>
`;

const perGameRow = ({
	id = "jordami01",
	idAttribute = true,
	team = "CHI",
	pos = "SG",
	g = "82",
	gs = "82" as string | null,
	mp = "37.7" as string | null,
	pts = "30.4",
} = {}) => `
	<tr>
		<th data-stat="ranker">1</th>
		<td ${idAttribute ? `data-append-csv="${id}"` : ""} data-stat="name_display"><a href='/players/${id[0]}/${id}.html'>Player</a></td>
		<td data-stat="age">32</td>
		<td data-stat="team_name_abbr"><a href="/teams/${team}/1996.html">${team}</a></td>
		<td data-stat="pos">${pos}</td>
		<td data-stat="games">${g}</td>
		${gs === null ? "" : `<td data-stat="games_started">${gs}</td>`}
		${mp === null ? "" : `<td data-stat="mp_per_g" csk="${mp}1">${mp}</td>`}
		<td data-stat="pts_per_g">${pts}</td>
	</tr>
`;

describe("parsePerGame", () => {
	it("reads one row per player-team with its numbers", () => {
		expect(parsePerGame(perGamePage(perGameRow()))).toEqual([
			{ id: "jordami01", team: "CHI", pos: "SG", g: 82, gs: 82, mpg: 37.71, ppg: 30.4 },
		]);
	});

	it("takes the id from the link when the attribute is missing", () => {
		const [row] = parsePerGame(perGamePage(perGameRow({ id: "tatumja01", idAttribute: false })));
		expect(row.id).toBe("tatumja01");
	});

	it("skips totals rows of traded players, league averages and header rows", () => {
		const rows = parsePerGame(
			perGamePage(`
				${perGameRow({ id: "laettch01", team: "2TM" })}
				${perGameRow({ id: "laettch01", team: "ATL" })}
				${perGameRow({ id: "laettch01", team: "TOT" })}
				<tr class="norank"><th data-stat="ranker"></th><td data-stat="name_display">League Average</td><td data-stat="team_name_abbr"></td><td data-stat="games">82</td></tr>
				<tr class="thead"><th data-stat="ranker">Rk</th></tr>
			`),
		);
		expect(rows.map((r) => r.team)).toEqual(["ATL"]);
	});

	it("reads null for columns an era doesn't have and keeps a blank position", () => {
		const [row] = parsePerGame(perGamePage(perGameRow({ pos: "", gs: null, mp: null })));
		expect(row).toMatchObject({ pos: "", gs: null, mpg: null, ppg: 30.4 });
	});

	it("ignores the playoffs table", () => {
		const rows = parsePerGame(perGamePage(perGameRow(), { postRows: perGameRow({ id: "pippesc01" }) }));
		expect(rows.map((r) => r.id)).toEqual(["jordami01"]);
	});
});

const coachesPage = (league: string, rows: string) => `
<table id="${league}_coaches"><tbody>${rows}</tbody></table>
`;

const coachRow = (id: string, team: string, g: string) => `
	<tr>
		<th data-stat="coach"><a href="/coaches/${id}.html">Coach</a></th>
		<td data-stat="team">${team}</td>
		<td data-stat="cur_g">${g}</td>
	</tr>
`;

describe("parseCoaches / coachByTeam", () => {
	it("reads the league's coaches table", () => {
		expect(parseCoaches(coachesPage("ABA", coachRow("brownhu01c", "KEN", "84")), "ABA")).toEqual([
			{ coachId: "brownhu01c", team: "KEN", g: 84 },
		]);
		expect(parseCoaches(coachesPage("ABA", coachRow("brownhu01c", "KEN", "84")), "NBA")).toEqual([]);
	});

	it("gives a team that changed coaches the one with the most games", () => {
		const rows = parseCoaches(
			coachesPage("NBA", coachRow("firstco01c", "ATL", "30") + coachRow("secondc01c", "ATL", "52")),
			"NBA",
		);
		expect(coachByTeam(rows).get("ATL")).toBe("secondc01c");
	});
});

describe("parseLeagueTeams", () => {
	it("reads code, name (without the playoff star) and arena", () => {
		const page = `
		<table id="advanced-team"><tbody>
			<tr><th data-stat="ranker">1</th><td data-stat="team"><a href='/teams/CHI/1996.html'>Chicago Bulls</a>*</td><td data-stat="arena_name">United Center</td></tr>
			<tr><th data-stat="ranker">2</th><td data-stat="team"><a href='/teams/PIT/1947.html'>Pittsburgh Ironmen</a></td><td data-stat="arena_name"></td></tr>
			<tr><th data-stat="ranker"></th><td data-stat="team">League Average</td><td data-stat="arena_name"></td></tr>
		</tbody></table>`;
		expect(parseLeagueTeams(page)).toEqual([
			{ code: "CHI", name: "Chicago Bulls", arena: "United Center" },
			{ code: "PIT", name: "Pittsburgh Ironmen", arena: null },
		]);
	});
});

describe("helpers", () => {
	it("labels seasons by their end year", () => {
		expect(seasonLabel(1996)).toBe("1995-96");
		expect(seasonLabel(2000)).toBe("1999-00");
		expect(seasonLabel(1947)).toBe("1946-47");
	});

	it("builds season page paths", () => {
		expect(seasonPaths("BAA", 1947).perGame).toBe("/leagues/BAA_1947_per_game.html");
	});

	it("ranks positions guard to center", () => {
		expect(positionRank("PG")).toBe(1);
		expect(positionRank("G-F")).toBe(1.5);
		expect(positionRank("c")).toBe(5);
		expect(positionRank("")).toBeNull();
	});
});

// The 1995-96 Bulls as the 1996 per-game page lists them.
const BULLS_1996: RosterCandidate[] = [
	{ id: "jordami01", pos: "SG", g: 82, gs: 82, mpg: 37.7, ppg: 30.4 },
	{ id: "pippesc01", pos: "SF", g: 77, gs: 77, mpg: 36.7, ppg: 19.4 },
	{ id: "kukocto01", pos: "SF", g: 81, gs: 20, mpg: 26.0, ppg: 13.1 },
	{ id: "longllu01", pos: "C", g: 62, gs: 62, mpg: 26.5, ppg: 9.1 },
	{ id: "kerrst01", pos: "PG", g: 82, gs: 0, mpg: 23.4, ppg: 8.4 },
	{ id: "harpero01", pos: "PG", g: 80, gs: 80, mpg: 23.6, ppg: 7.4 },
	{ id: "rodmade01", pos: "PF", g: 64, gs: 57, mpg: 32.6, ppg: 5.5 },
	{ id: "wennibi01", pos: "C", g: 71, gs: 20, mpg: 15.0, ppg: 5.3 },
	{ id: "haleyja01", pos: "C", g: 1, gs: 0, mpg: 7.0, ppg: 5.0 },
	{ id: "sallejo01", pos: "PF", g: 17, gs: 0, mpg: 11.2, ppg: 2.1 },
	{ id: "buechju01", pos: "SF", g: 74, gs: 0, mpg: 10.0, ppg: 3.8 },
	{ id: "simpkdi01", pos: "PF", g: 60, gs: 12, mpg: 11.4, ppg: 3.6 },
	{ id: "edwarja01", pos: "C", g: 28, gs: 0, mpg: 9.8, ppg: 3.5 },
	{ id: "caffeja01", pos: "PF", g: 57, gs: 0, mpg: 9.6, ppg: 3.2 },
	{ id: "brownra02", pos: "PG", g: 68, gs: 0, mpg: 9.9, ppg: 2.7 },
];

const player = (id: string, fields: Partial<RosterCandidate> = {}): RosterCandidate => ({
	id,
	pos: "",
	g: 70,
	gs: null,
	mpg: null,
	ppg: null,
	...fields,
});

describe("orderRoster", () => {
	it("starts the five with the most starts, guard to center, then the bench by minutes", () => {
		expect(orderRoster(BULLS_1996)).toEqual({
			roster: [
				"harpero01", "jordami01", "pippesc01", "rodmade01", "longllu01",
				"kukocto01", "kerrst01", "wennibi01", "buechju01", "simpkdi01",
				"brownra02", "caffeja01", "edwarja01", "sallejo01", "haleyja01",
			],
			starters: 5,
			alternates: [],
		});
	});

	it("picks starters by minutes before games started were tracked", () => {
		const roster = orderRoster([
			player("c1", { pos: "C", mpg: 40 }),
			player("pg1", { pos: "PG", mpg: 35 }),
			player("bench1", { pos: "SF", mpg: 10 }),
			player("sf1", { pos: "SF", mpg: 33 }),
			player("sg1", { pos: "SG", mpg: 32 }),
			player("pf1", { pos: "PF", mpg: 31 }),
		]);
		expect(roster.roster).toEqual(["pg1", "sg1", "sf1", "pf1", "c1", "bench1"]);
		expect(roster.starters).toBe(5);
	});

	it("falls back to points when minutes weren't tracked, and keeps that order without positions", () => {
		const roster = orderRoster([
			player("low", { g: 60, ppg: 2 }),
			player("a", { g: 60, ppg: 16.8 }),
			player("b", { g: 58, ppg: 14.1 }),
			player("c", { g: 60, ppg: 12 }),
			player("d", { g: 59, ppg: 10, pos: "C" }),
			player("e", { g: 55, ppg: 9 }),
		]);
		expect(roster.roster).toEqual(["a", "b", "c", "d", "e", "low"]);
	});

	it("uses one metric for the whole team: a single player without minutes drops everyone to points", () => {
		// By minutes "mins" would lead; by points it's last.
		const roster = orderRoster([
			player("mins", { mpg: 40, ppg: 1 }),
			player("pts", { mpg: null, ppg: 20 }),
		]);
		expect(roster.roster).toEqual(["pts", "mins"]);
	});

	it("caps the roster at 15 and keeps the next three as alternates", () => {
		const candidates = Array.from({ length: 20 }, (_, i) =>
			player(`p${String(i).padStart(2, "0")}`, { mpg: 40 - i }),
		);
		const roster = orderRoster(candidates);
		expect(roster.roster).toHaveLength(15);
		expect(roster.roster.slice(5)).toEqual(candidates.slice(5, 15).map((c) => c.id));
		expect(roster.alternates).toEqual(["p15", "p16", "p17"]);
	});

	it("puts current-season players with no games after everyone who played, by rating", () => {
		const roster = orderRoster([
			player("unrated", { g: 0 }),
			player("rated80", { g: 0, rating: 80 }),
			player("played", { g: 3, gs: 0, mpg: 5 }),
			player("rated72", { g: 0, rating: 72 }),
		]);
		expect(roster.roster).toEqual(["played", "rated80", "rated72", "unrated"]);
	});

	it("never starts more players than it has", () => {
		const roster = orderRoster([player("a", { mpg: 30 }), player("b", { mpg: 20 })]);
		expect(roster).toEqual({ roster: ["a", "b"], starters: 2, alternates: [] });
	});

	it("counts a blank games-started cell as 0 rather than dropping the whole team to minutes", () => {
		const roster = orderRoster([
			player("bench", { gs: null, mpg: 45 }),
			...["a", "b", "c", "d", "e"].map((id) => player(id, { gs: 70, mpg: 30 })),
		]);
		expect(roster.roster.slice(0, 5)).toEqual(["a", "b", "c", "d", "e"]);
	});

	it("breaks a games-started tie by minutes", () => {
		const roster = orderRoster([
			player("s1", { gs: 82, mpg: 30 }),
			player("s2", { gs: 82, mpg: 31 }),
			player("s3", { gs: 82, mpg: 32 }),
			player("s4", { gs: 82, mpg: 33 }),
			player("tieLow", { gs: 60, mpg: 20 }),
			player("tieHigh", { gs: 60, mpg: 25 }),
		]);
		expect(roster.roster.slice(0, 5)).toEqual(["s4", "s3", "s2", "s1", "tieHigh"]);
	});
});

describe("franchiseResolver", () => {
	const franchiseOf = franchiseResolver([
		{ team: "SEA", franchise: "OKC" },
		{ team: "NYA", franchise: "NJN" },
	]);

	it("follows historicalLogos, then the overrides, then the code itself", () => {
		expect(franchiseOf("SEA")).toBe("OKC");
		expect(franchiseOf("NYN")).toBe("NJN");
		expect(franchiseOf("PIT")).toBe("PIT");
	});
});

describe("finishedSeasons", () => {
	it("covers the BAA, the NBA through the last finished season, and the ABA", () => {
		const seasons = finishedSeasons(2026).map((s) => `${s.league}-${s.year}`);
		expect(seasons).toContain("BAA-1947");
		expect(seasons).not.toContain("NBA-1949");
		expect(seasons).toContain("NBA-1950");
		expect(seasons).toContain("NBA-2026");
		expect(seasons).not.toContain("NBA-2027");
		expect(seasons.filter((s) => s.startsWith("ABA"))).toHaveLength(9);
		expect(seasons).toHaveLength(3 + 77 + 9);
	});
});

const pgRow = (id: string, team: string, fields: Partial<PerGameRow> = {}): PerGameRow => ({
	id,
	team,
	pos: "SF",
	g: 70,
	gs: null,
	mpg: 20,
	ppg: 10,
	...fields,
});

const nineFor = (team: string) =>
	Array.from({ length: 9 }, (_, i) => pgRow(`${team.toLowerCase()}${i}`, team, { mpg: 30 - i }));

const leagueTeams = (codes: string[]) => codes.map((code) => ({ code, name: `${code} Name`, arena: `${code} Arena` }));

describe("buildTeamSeasonFile", () => {
	const franchiseOf = franchiseResolver([{ team: "SEA", franchise: "OKC" }]);
	const codes = ["SEA", "BOS", "LAL", "CHI", "NYK"];

	it("builds every team with its lineage, coach, arena and ordered roster", () => {
		const { file, problems } = buildTeamSeasonFile(
			{
				league: "NBA",
				year: 1996,
				perGame: codes.flatMap(nineFor),
				coaches: [{ coachId: "karlge01c", team: "SEA", g: 82 }],
				teams: leagueTeams(codes),
			},
			franchiseOf,
			new Map(),
			"2026-10-30T00:00:00.000Z",
		);
		expect(problems).toEqual([]);
		expect(file).toMatchObject({ version: 1, league: "NBA", year: 1996, label: "1995-96" });
		expect(file.teams[0]).toMatchObject({
			code: "SEA",
			franchise: "OKC",
			name: "SEA Name",
			coachId: "karlge01c",
			arena: "SEA Arena",
			starters: 5,
		});
		expect(file.teams[0].roster).toHaveLength(9);
		expect(file.teams[1].coachId).toBeNull();
		// Only the order leaves the module, never the numbers behind it.
		expect(JSON.stringify(file)).not.toContain("mpg");
	});

	it("fills a blank position from players.json", () => {
		const perGame = [
			...nineFor("BOS").map((row) => ({ ...row, pos: "" })),
			...["SEA", "LAL", "CHI", "NYK"].flatMap(nineFor),
		];
		const positions = new Map(["bos0", "bos1", "bos2", "bos3", "bos4"].map((id, i) => [id, ["C", "F", "G", "F", "G"][i]]));
		const { file } = buildTeamSeasonFile(
			{ league: "BAA", year: 1947, perGame, coaches: [], teams: leagueTeams(codes) },
			franchiseOf,
			positions,
			"now",
		);
		const bos = file.teams.find((t) => t.code === "BOS")!;
		expect(bos.roster.slice(0, 5)).toEqual(["bos2", "bos4", "bos1", "bos3", "bos0"]);
	});

	it("reports short seasons, short rosters and players on unnamed teams", () => {
		const { problems } = buildTeamSeasonFile(
			{
				league: "NBA",
				year: 1950,
				perGame: [...nineFor("SEA"), pgRow("x", "BOS"), pgRow("y", "ZZZ")],
				coaches: [],
				teams: leagueTeams(["SEA", "BOS"]),
			},
			franchiseOf,
			new Map(),
			"now",
		);
		expect(problems).toEqual([
			"NBA-1950: players listed for ZZZ, which the league page doesn't name",
			"NBA-1950: only 2 teams",
			"NBA-1950: BOS has 1 players",
		]);
	});
});

describe("withIndexSeason", () => {
	const entry = (league: "NBA" | "ABA" | "BAA", year: number, code: string) => ({
		league,
		year,
		label: "",
		path: `team-seasons/${league}-${year}.json`,
		teams: [{ code, franchise: code, name: code }],
	});

	it("adds or replaces a season, newest first, NBA before ABA in a shared year", () => {
		let seasons = withIndexSeason([], entry("NBA", 1975, "BOS"));
		seasons = withIndexSeason(seasons, entry("NBA", 1996, "CHI"));
		seasons = withIndexSeason(seasons, entry("ABA", 1975, "KEN"));
		seasons = withIndexSeason(seasons, entry("NBA", 1996, "SEA"));
		expect(seasons.map((s) => `${s.league}-${s.year}-${s.teams[0].code}`)).toEqual([
			"NBA-1996-SEA",
			"NBA-1975-BOS",
			"ABA-1975-KEN",
		]);
	});

	it("refuses a team code another league already uses that year", () => {
		expect(() => withIndexSeason([entry("NBA", 1975, "DEN")], entry("ABA", 1975, "DEN"))).toThrow(
			"DEN-1975 is used by two leagues",
		);
	});

	it("builds an entry from a file", () => {
		expect(
			indexSeason(
				{
					version: 1,
					league: "NBA",
					year: 1996,
					label: "1995-96",
					generatedAt: "now",
					teams: [{ code: "CHI", franchise: "CHI", name: "Chicago Bulls", coachId: null, arena: null, roster: [], starters: 0, alternates: [] }],
				},
				"team-seasons/NBA-1996.json",
			),
		).toEqual({
			league: "NBA",
			year: 1996,
			label: "1995-96",
			path: "team-seasons/NBA-1996.json",
			teams: [{ code: "CHI", franchise: "CHI", name: "Chicago Bulls" }],
		});
	});
});

describe("mergeStints", () => {
	it("combines two stints with the same team, weighting per-game numbers by games", () => {
		const merged = mergeStints([
			pgRow("backagain", "ATL", { g: 20, gs: 10, mpg: 30, ppg: 10 }),
			pgRow("backagain", "BOS", { g: 10, gs: 0, mpg: 10, ppg: 2 }),
			pgRow("backagain", "ATL", { g: 30, gs: 30, mpg: 20, ppg: 20 }),
		]);
		expect(merged).toEqual([
			pgRow("backagain", "ATL", { g: 50, gs: 40, mpg: 24, ppg: 16 }),
			pgRow("backagain", "BOS", { g: 10, gs: 0, mpg: 10, ppg: 2 }),
		]);
	});

	it("keeps a column null when a stint lacks it", () => {
		const [merged] = mergeStints([
			pgRow("old", "SYR", { g: 20, gs: null, mpg: null, ppg: 10 }),
			pgRow("old", "SYR", { g: 20, gs: null, mpg: null, ppg: 20 }),
		]);
		expect(merged).toMatchObject({ g: 40, gs: null, mpg: null, ppg: 15 });
	});
});
