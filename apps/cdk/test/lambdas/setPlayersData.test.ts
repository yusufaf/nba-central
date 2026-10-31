import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const s3Send = vi.fn();
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
	// A plain function expression, not an arrow: vitest's mock functions can't
	// be called with `new` otherwise (see publicTeams.test.ts).
	return { ...actual, S3Client: vi.fn(function () { return { send: s3Send }; }) };
});

const fetchMock = vi.fn();
vi.mock("node-fetch", () => ({ default: fetchMock }));

const { GetObjectCommand, PutObjectCommand, NoSuchKey } = await import("@aws-sdk/client-s3");
const {
	parsePage,
	activeSeasonEndYear,
	latestDraftYear,
	parseDraftPage,
	hasDraftTable,
	handler,
	refusalReason,
	hasPlayersTable,
	rosterMembers,
	writeCurrentTeamSeason,
	MIN_CURRENT_SEASON_ROWS,
} = await import("lambdas/setPlayersData/src/setPlayersData");

const row = (id: string, name: string, yearMax: string) =>
	`<tr><th data-stat="player" data-append-csv="${id}"><a>${name}</a></th>` +
	`<td data-stat="pos">F</td><td data-stat="height">6-9</td>` +
	`<td data-stat="weight">220</td><td data-stat="year_max">${yearMax}</td></tr>`;

const page = (...rows: string[]) =>
	`<table id="players"><tbody>` +
	`<tr class="thead"><th>Player</th></tr>${rows.join("")}</tbody></table>`;

// Copies the real /draft/NBA_YYYY.html markup: the id lives only in the player
// link's href, there is no data-append-csv.
const draftRow = (pick: number, id: string, name: string) =>
	`<tr><th data-stat="ranker">${pick}</th>` +
	`<td data-stat="pick_overall" csk="${pick}"><a>${pick}</a></td>` +
	`<td data-stat="team_id"><a href="/teams/WAS/draft.html">WAS</a></td>` +
	`<td data-stat="player" csk="x"><a href='/players/${id[0]}/${id}.html'>${name}</a></td></tr>`;

const draftPage = (...rows: string[]) =>
	`<table id="stats"><thead><tr><th>Rk</th></tr></thead><tbody>` +
	`<tr class="over_header thead"><th colspan="3">Round 1</th></tr>` +
	`<tr class="thead"><th>Rk</th></tr>${rows.join("")}</tbody></table>`;

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

describe("latestDraftYear", () => {
	it.each([
		["Jun 30 2026 23:59:59", new Date(2026, 5, 30, 23, 59, 59), 2025],
		["Jul 1 2026", new Date(2026, 6, 1), 2026],
		["Oct 11 2026", new Date(2026, 9, 11), 2026],
		["Jan 1 2027", new Date(2027, 0, 1), 2026],
		["Jun 30 2027", new Date(2027, 5, 30), 2026],
		["Jul 1 2027", new Date(2027, 6, 1), 2027],
	])("%s gives %i", (_label, now, expected) => {
		expect(latestDraftYear(now)).toBe(expected);
	});
});

describe("parseDraftPage", () => {
	const html = draftPage(
		draftRow(1, "dybanaj01", "AJ Dybantsa"),
		draftRow(2, "peterda02", "Darryn Peterson"),
		draftRow(3, "brownmi02", "Mikel Brown Jr."),
		draftRow(4, "lopezka01", "Karim López"),
	);

	it("parses picks in page order with the BBRef id from the href", () => {
		const players = parseDraftPage(html);
		expect(players.map((p) => p.id)).toEqual([
			"dybanaj01",
			"peterda02",
			"brownmi02",
			"lopezka01",
		]);
		expect(players[0]).toMatchObject({ first_name: "AJ", last_name: "Dybantsa" });
	});

	it("keeps a suffix in the last name, as the index does", () => {
		expect(parseDraftPage(html)[2]).toMatchObject({ first_name: "Mikel", last_name: "Brown Jr." });
	});

	it("keeps diacritics", () => {
		expect(parseDraftPage(html)[3]).toMatchObject({ first_name: "Karim", last_name: "López" });
	});

	it("marks every draftee active with no bio fields", () => {
		for (const p of parseDraftPage(html)) {
			expect(p).toMatchObject({
				active: true,
				position: "",
				team: { full_name: "", abbreviation: "" },
				height_feet: null,
				height_inches: null,
				weight_pounds: null,
			});
		}
	});

	it("skips separator rows and a pick whose player cell has no link", () => {
		const unlinked = `<tr><th data-stat="ranker">9</th><td data-stat="player">Unknown</td></tr>`;
		const players = parseDraftPage(
			draftPage(draftRow(1, "dybanaj01", "AJ Dybantsa"), unlinked),
		);
		expect(players.map((p) => p.id)).toEqual(["dybanaj01"]);
	});
});

describe("hasDraftTable", () => {
	it("accepts a draft page", () => {
		expect(hasDraftTable(draftPage())).toBe(true);
	});

	it("rejects a block page served as a 200", () => {
		expect(hasDraftTable("<html>Rate limited</html>")).toBe(false);
	});

	it("leaves parseDraftPage returning [] for a page with no table", () => {
		expect(parseDraftPage("<html>Rate limited</html>")).toEqual([]);
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

describe("refusalReason", () => {
	it.each([
		["a scrape just under the current size", 75, 78, false],
		["exactly 95% of the current size", 95, 100, false],
		["just below 95% of the current size", 94, 100, true],
		["a scrape below 95% of 79", 75, 79, true],
		["a scrape with no existing file", 75, null, false],
		["an empty scrape with no existing file", 0, null, true],
		["an empty scrape over an existing file", 0, 78, true],
	])("%s (%i vs %s)", (_label, scraped, current, refused) => {
		const reason = refusalReason(scraped, current);
		if (!refused) {
			expect(reason).toBeNull();
			return;
		}
		expect(reason).toEqual(expect.any(String));
		if (current !== null) {
			expect(reason).toContain(String(scraped));
			expect(reason).toContain(String(current));
		}
	});

	it("names both counts for an empty scrape over an existing file", () => {
		expect(refusalReason(0, 78)).toBe("scraped 0 players, below 95% of the current 78");
	});
});

describe("hasPlayersTable", () => {
	it("accepts the empty table BBRef serves for /players/x/", () => {
		expect(hasPlayersTable(page())).toBe(true);
	});

	it("accepts a table with rows", () => {
		expect(hasPlayersTable(page(row("curryst01", "Stephen Curry", "2027")))).toBe(true);
	});

	it("rejects a block page served as a 200", () => {
		expect(hasPlayersTable("<html>Rate limited</html>")).toBe(false);
	});

	it("leaves parsePage returning [] for a page with no table", () => {
		expect(parsePage("<html>Rate limited</html>", 2027)).toEqual([]);
	});
});

describe("handler guard (#168)", () => {
	const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

	// Three players per letter; BBRef really serves /players/x/ with an empty
	// table, so a full scrape is 25 x 3 = 75.
	const letterPage = (letter: string) =>
		letter === "x"
			? page()
			: page(...[0, 1, 2].map((i) => row(`${letter}${i}`, `Player ${letter}${i}`, "2027")));
	const FULL_SCRAPE = (LETTERS.length - 1) * 3;

	const currentFile = (n: number) => ({
		Body: {
			transformToString: async () =>
				JSON.stringify({ data: Array.from({ length: n }, (_, i) => ({ id: `old${i}` })) }),
		},
	});

	const stubS3 = (current: () => unknown) =>
		s3Send.mockImplementation(async (cmd: unknown) =>
			cmd instanceof GetObjectCommand ? current() : {},
		);

	// The draft page is a supplement to the index, so by default it serves an
	// empty draft table and the letter counts below stay unchanged.
	const stubBBRef = (
		override?: (letter: string) => unknown,
		draft: () => unknown = async () => ({
			ok: true,
			status: 200,
			text: async () => draftPage(),
		}),
	) =>
		fetchMock.mockImplementation(async (url: string) => {
			if (url.includes("/draft/")) return draft();
			const letter = url.split("/").slice(-2)[0];
			return (
				(override && (await override(letter))) ?? {
					ok: true,
					status: 200,
					text: async () => letterPage(letter),
				}
			);
		});

	const puts = () =>
		s3Send.mock.calls.map(([cmd]) => cmd).filter((cmd) => cmd instanceof PutObjectCommand);

	const run = async () => {
		const p = handler({} as any, {} as any, () => {}) as Promise<any>;
		p.catch(() => {});
		await vi.runAllTimersAsync();
		return p;
	};

	beforeEach(() => {
		vi.useFakeTimers();
		s3Send.mockReset();
		fetchMock.mockReset();
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it.each([
		["a non-2xx response", async () => ({ ok: false, status: 429, text: async () => "" })],
		["a network error", async () => { throw new Error("ECONNRESET"); }],
		[
			"a 200 page without the players table",
			async () => ({ ok: true, status: 200, text: async () => "<html>Rate limited</html>" }),
		],
	])("rejects and leaves players.json alone on %s", async (_label, failQ) => {
		stubS3(() => currentFile(78));
		stubBBRef((letter) => (letter === "q" ? failQ() : undefined));

		await expect(run()).rejects.toThrow(/players\/q\//);

		expect(puts()).toHaveLength(0);
		// Stops at the first failure instead of hammering a server that is
		// probably rate-limiting us.
		expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/players/r/"))).toBe(false);
		// The draft page is only worth a request once the index is complete.
		expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/draft/"))).toBe(false);
	});

	it("refuses a scrape below 95% of the current list", async () => {
		stubS3(() => currentFile(79));
		stubBBRef();

		await expect(run()).rejects.toThrow(/75.*79/);

		expect(puts()).toHaveLength(0);
	});

	it("writes a full scrape over the current list", async () => {
		stubS3(() => currentFile(78));
		stubBBRef();

		await expect(run()).resolves.toMatchObject({ statusCode: 200 });

		const [put] = puts() as any[];
		expect(puts()).toHaveLength(1);
		expect(put.input.Key).toBe("players.json");
		expect(JSON.parse(put.input.Body).data).toHaveLength(FULL_SCRAPE);
	});

	const draftResponse = (...rows: string[]) => async () => ({
		ok: true,
		status: 200,
		text: async () => draftPage(...rows),
	});

	it("adds draftees the index doesn't list yet", async () => {
		stubS3(() => currentFile(78));
		stubBBRef(undefined, draftResponse(
			draftRow(1, "dybanaj01", "AJ Dybantsa"),
			draftRow(2, "peterda02", "Darryn Peterson"),
		));

		await expect(run()).resolves.toMatchObject({ statusCode: 200 });

		const [put] = puts() as any[];
		const data = JSON.parse(put.input.Body).data;
		expect(data).toHaveLength(FULL_SCRAPE + 2);
		expect(data.find((p: any) => p.id === "dybanaj01")).toMatchObject({
			first_name: "AJ",
			last_name: "Dybantsa",
			active: true,
		});
	});

	it("keeps the index row when a draftee is already indexed", async () => {
		stubS3(() => currentFile(78));
		stubBBRef(undefined, draftResponse(draftRow(1, "a0", "Draft Name")));

		await expect(run()).resolves.toMatchObject({ statusCode: 200 });

		const [put] = puts() as any[];
		const data = JSON.parse(put.input.Body).data;
		expect(data).toHaveLength(FULL_SCRAPE);
		expect(data.find((p: any) => p.id === "a0")).toMatchObject({
			first_name: "Player",
			position: "F",
		});
	});

	it("fetches the latest draft class after the index, with a timeout", async () => {
		vi.setSystemTime(new Date(2026, 9, 11));
		stubS3(() => currentFile(78));
		stubBBRef();

		await run();

		const urls = fetchMock.mock.calls.map(([u]) => String(u));
		const draftCall = urls.findIndex((u) => u.endsWith("/draft/NBA_2026.html"));
		expect(draftCall).toBeGreaterThan(urls.findIndex((u) => u.includes("/players/z/")));
		expect(fetchMock.mock.calls[draftCall][1]).toMatchObject({
			signal: expect.any(AbortSignal),
		});
	});

	it.each([
		["a non-2xx response", async () => ({ ok: false, status: 429, text: async () => "" })],
		["a network error", async () => { throw new Error("ECONNRESET"); }],
		[
			"the draft fetch timing out",
			async () => {
				throw Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
			},
		],
		[
			"a 200 page without the draft table",
			async () => ({ ok: true, status: 200, text: async () => "<html>Rate limited</html>" }),
		],
	])("still writes the index when the draft page has %s", async (_label, failDraft) => {
		stubS3(() => currentFile(78));
		stubBBRef(undefined, failDraft);

		await expect(run()).resolves.toMatchObject({ statusCode: 200 });

		expect(puts()).toHaveLength(1);
		expect(JSON.parse((puts()[0] as any).input.Body).data).toHaveLength(FULL_SCRAPE);
		expect(console.error).toHaveBeenCalled();
	});

	it("writes when there is no current file", async () => {
		stubS3(() => {
			throw new NoSuchKey({ message: "no key", $metadata: {} });
		});
		stubBBRef();

		await expect(run()).resolves.toMatchObject({ statusCode: 200 });

		expect(puts()).toHaveLength(1);
	});

	it.each([
		["invalid JSON", "{not json"],
		["no data array", JSON.stringify({ data: null })],
	])("fails before scraping when the current file has %s", async (_label, body) => {
		stubS3(() => ({ Body: { transformToString: async () => body } }));
		stubBBRef();

		await expect(run()).rejects.toThrow();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(puts()).toHaveLength(0);
	});

	it("fails before scraping when the current file can't be read", async () => {
		stubS3(() => {
			throw Object.assign(new Error("Access Denied"), { name: "AccessDenied" });
		});
		stubBBRef();

		await expect(run()).rejects.toThrow(/Access Denied/);

		expect(fetchMock).not.toHaveBeenCalled();
		expect(puts()).toHaveLength(0);
	});
});

describe("rosterMembers", () => {
	it("groups headshots.json players by Basketball-Reference team code with their rating", () => {
		const entry = (team: string) => ({ espnId: "1", team, hasHeadshot: true, image: null, imageAt: null, attemptAt: null, etag: null });
		const members = rosterMembers(
			{
				version: 1,
				generatedAt: "",
				rostersAt: null,
				rostersAttemptedAt: "",
				players: { curryst01: entry("GS"), jamesle01: entry("PHI"), greendr01: entry("GS") },
				unmatched: [],
			},
			{ curryst01: { rating: 94 } },
		);
		expect(members.get("GSW")).toEqual([
			{ id: "curryst01", rating: 94 },
			{ id: "greendr01", rating: null },
		]);
		expect(members.get("PHI")).toEqual([{ id: "jamesle01", rating: null }]);
	});
});

describe("writeCurrentTeamSeason", () => {
	const CODES = ["GSW", "PHI", "BOS", "LAL", "NYK"];
	const ESPN: Record<string, string> = { GSW: "GS", NYK: "NY" };

	const perGamePage = (rowsPerTeam: number) =>
		`<table id="per_game_stats"><tbody>${CODES.flatMap((code) =>
			Array.from(
				{ length: rowsPerTeam },
				(_, i) =>
					`<tr><td data-append-csv="${code.toLowerCase()}${i}" data-stat="name_display"></td>` +
					`<td data-stat="team_name_abbr">${code}</td><td data-stat="pos">SF</td>` +
					`<td data-stat="games">5</td><td data-stat="games_started">${i < 5 ? 5 : 0}</td>` +
					`<td data-stat="mp_per_g">${40 - i}</td><td data-stat="pts_per_g">10</td></tr>`,
			),
		).join("")}</tbody></table>`;
	const coachesPage = `<table id="NBA_coaches"><tbody>${CODES.map(
		(code) => `<tr><th data-stat="coach"><a href="/coaches/${code.toLowerCase()}co01c.html">Coach ${code}</a></th><td data-stat="team">${code}</td><td data-stat="cur_g">5</td></tr>`,
	).join("")}</tbody></table>`;
	const leaguePage = `<table id="advanced-team"><tbody>${CODES.map(
		(code) => `<tr><td data-stat="team"><a href='/teams/${code}/2027.html'>${code} Team</a></td><td data-stat="arena_name">${code} Arena</td></tr>`,
	).join("")}</tbody></table>`;

	// Nine on each roster: the top eight on the page plus one signing who hasn't played.
	const headshots = {
		version: 1,
		rostersAt: "2026-11-01T12:00:00.000Z",
		players: Object.fromEntries(
			CODES.flatMap((code) =>
				[...Array.from({ length: 8 }, (_, i) => `${code.toLowerCase()}${i}`), `${code.toLowerCase()}new`].map((id) => [
					id,
					{ espnId: id, team: ESPN[code] ?? code },
				]),
			),
		),
		unmatched: [],
	};

	const stub = ({ rowsPerTeam = 30, withHeadshots = true, failLeague = false, rostersAt = headshots.rostersAt as string | null } = {}) => {
		fetchMock.mockImplementation(async (url: string) => {
			if (failLeague && url.endsWith("NBA_2027.html")) return { ok: false, status: 429, text: async () => "" };
			const body = url.includes("_per_game") ? perGamePage(rowsPerTeam) : url.includes("_coaches") ? coachesPage : leaguePage;
			return { ok: true, status: 200, text: async () => body };
		});
		s3Send.mockImplementation(async (cmd: unknown) => {
			if (!(cmd instanceof GetObjectCommand)) return {};
			const key = (cmd as InstanceType<typeof GetObjectCommand>).input.Key;
			const json =
				key === "live/headshots.json" ? (withHeadshots ? { ...headshots, rostersAt } : null) :
				key === "player-ratings.json" ? { data: { gswnew: { rating: 70 } } } :
				key === "live/team-seasons/index.json" ? { seasons: [{ teams: [{ code: "GSW", franchise: "GSW" }, { code: "NYK", franchise: "NYK" }] }] } :
				null;
			if (!json) throw new NoSuchKey({ message: "missing", $metadata: {} });
			return { Body: { transformToString: async () => JSON.stringify(json) } };
		});
	};

	const putBodies = () =>
		s3Send.mock.calls
			.map(([cmd]) => cmd)
			.filter((cmd) => cmd instanceof PutObjectCommand)
			.map((cmd) => (cmd as InstanceType<typeof PutObjectCommand>).input);

	const run = async (positions = new Map<string, string>()) => {
		const p = writeCurrentTeamSeason(positions, new Date(2026, 10, 2));
		await vi.runAllTimersAsync();
		return p;
	};

	beforeEach(() => {
		vi.useFakeTimers();
		s3Send.mockReset();
		fetchMock.mockReset();
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("writes the current season from today's rosters, ordered by the season page", async () => {
		stub();
		expect(await run()).toBe("saved 2027: 5 teams");
		const [put] = putBodies();
		expect(put).toMatchObject({
			Key: "live/team-seasons/current.json",
			CacheControl: expect.stringContaining("max-age=300"),
		});
		const file = JSON.parse(put.Body as string);
		expect(file).toMatchObject({ league: "NBA", year: 2027, label: "2026-27" });
		const gsw = file.teams.find((t: { code: string }) => t.code === "GSW");
		expect(gsw).toMatchObject({ coachId: "gswco01c", coachName: "Coach GSW", arena: "GSW Arena", starters: 5 });
		expect(gsw.roster).toEqual(["gsw0", "gsw1", "gsw2", "gsw3", "gsw4", "gsw5", "gsw6", "gsw7", "gswnew"]);
		expect(fetchMock.mock.calls.map(([u]) => String(u))).toEqual([
			expect.stringContaining("/leagues/NBA_2027_per_game.html"),
			expect.stringContaining("/leagues/NBA_2027_coaches.html"),
			expect.stringContaining("/leagues/NBA_2027.html"),
		]);
	});

	it("skips before the season has enough games, after one request", async () => {
		stub({ rowsPerTeam: Math.floor(MIN_CURRENT_SEASON_ROWS / 5) - 1 });
		expect(await run()).toMatch(/^skipped: /);
		expect(putBodies()).toEqual([]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it.each([
		["headshots.json is missing", { withHeadshots: false }, /no rosters/],
		["its rosters are over a week old", { rostersAt: "2026-10-20T00:00:00.000Z" }, /from 2026-10-20/],
		["its rosters were never built", { rostersAt: null }, /from never/],
	])("keeps the previous file when %s", async (_label, options, reason) => {
		stub(options);
		expect(await run()).toMatch(reason);
		expect(putBodies()).toEqual([]);
	});

	it("keeps the previous file, without throwing, when a page fails", async () => {
		stub({ failLeague: true });
		expect(await run()).toMatch(/^kept previous: .*429/);
		expect(putBodies()).toEqual([]);
	});
});
