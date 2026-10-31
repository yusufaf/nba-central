import { describe, it, expect, vi, beforeEach } from "vitest";

const s3Send = vi.fn();
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
	return { ...actual, S3Client: vi.fn(function () { return { send: s3Send }; }) };
});

process.env.assetsBucket = "assets";
const { handler, parseIds, MAX_IDS, CACHE_TTL_MS, currentTeams } = await import("lambdas/getPlayers/src/getPlayers");
const { MAX_ROSTERS_AGE_MS } = await import("utilities/live-data");
const { NO_TEAM } = await import("utilities/nba-teams");

// One clock for the whole file, only ever moved forward: getPlayers caches
// reads in module scope, so each test starts past the TTL of every entry an
// earlier test cached. Restoring real time would make those entries fresh.
let now = Date.parse("2026-11-01T12:00:00.000Z");
vi.spyOn(Date, "now").mockImplementation(() => now);

const rosters = (teams: Record<string, string>, rostersAt: string | null = new Date(now).toISOString()) =>
	JSON.stringify({
		rostersAt,
		rostersAttemptedAt: rostersAt ?? "",
		players: Object.fromEntries(Object.entries(teams).map(([id, team]) => [id, { team }])),
		unmatched: [],
	});

let headshots: string | null;

const player = (id: string, first_name: string) => ({
	id,
	first_name,
	last_name: "Test",
	position: "G",
	height_feet: 6,
	height_inches: 3,
	weight_pounds: 200,
	active: true,
});

const PLAYERS = [player("jordami01", "Michael"), player("pippesc01", "Scottie"), player("rodmade01", "Dennis")];

beforeEach(() => {
	vi.clearAllMocks();
	now += CACHE_TTL_MS + 1;
	headshots = rosters({ jordami01: "CHI", pippesc01: "GS" });
	s3Send.mockReset();
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	s3Send.mockImplementation(async (cmd: { input: { Key?: string } }) => {
		if (cmd.input.Key === "live/headshots.json") {
			if (headshots === null) throw Object.assign(new Error("NoSuchKey"), { name: "NoSuchKey" });
			const body = headshots;
			return { Body: { transformToString: async () => body } };
		}
		const json =
			cmd.input.Key === "players.json"
				? { data: PLAYERS }
				: { gameVersion: "2K27", data: { pippesc01: { rating: 93, ratingSource: "allt", positions: ["SF"] } } };
		return { Body: { transformToString: async () => JSON.stringify(json) } };
	});
});

const call = async (queryStringParameters: Record<string, string>) => {
	const res = await handler({ queryStringParameters } as any, {} as any, () => {});
	return { statusCode: res.statusCode, ...JSON.parse(res.body) };
};

describe("parseIds", () => {
	it("splits, trims and dedupes, keeping the order", () => {
		expect(parseIds(" b,a, b ,,c")).toEqual(["b", "a", "c"]);
	});

	it("is null when absent or blank", () => {
		expect(parseIds(undefined)).toBeNull();
		expect(parseIds(" ")).toBeNull();
		expect(parseIds(",, ,")).toBeNull();
	});

	it("caps the list", () => {
		const many = Array.from({ length: MAX_IDS + 5 }, (_, i) => `p${i}`).join(",");
		expect(parseIds(many)).toHaveLength(MAX_IDS);
	});
});

describe("getPlayers ids", () => {
	it("returns the asked-for players in the asked-for order, with ratings, dropping unknown ids", async () => {
		const res = await call({ ids: "rodmade01,nobody99,pippesc01", search: "michael", limit: "1" });
		expect(res.statusCode).toBe(200);
		expect(res.data.map((p: { id: string }) => p.id)).toEqual(["rodmade01", "pippesc01"]);
		expect(res.data[1]).toMatchObject({ rating: 93, ratingSource: "allt" });
		expect(res).toMatchObject({ total: 2, nextCursor: null, gameVersion: "2K27" });
	});

	it("leaves an ordinary search alone", async () => {
		const res = await call({ search: "scottie" });
		expect(res.data.map((p: { id: string }) => p.id)).toEqual(["pippesc01"]);
	});
});

const CHI = { full_name: "Chicago Bulls", abbreviation: "CHI" };
const teamsById = (data: { id: string; team: unknown }[]) =>
	Object.fromEntries(data.map((p) => [p.id, p.team]));

describe("currentTeams", () => {
	it("maps each rostered player to their team and skips entries without one", () => {
		const teams = currentTeams(
			{
				rostersAt: new Date(now).toISOString(),
				players: { jordami01: { team: "CHI" }, x: { team: "" }, y: "junk" },
			},
			now,
		);
		expect([...teams]).toEqual([["jordami01", CHI]]);
		expect(console.warn).not.toHaveBeenCalled();
	});

	it("is empty for a file of the wrong shape", () => {
		expect(currentTeams(null, now).size).toBe(0);
		expect(currentTeams({}, now).size).toBe(0);
		expect(currentTeams({ players: [] }, now).size).toBe(0);
	});

	it("keeps serving rosters it hasn't rebuilt in over a week", () => {
		const rostersAt = new Date(now - MAX_ROSTERS_AGE_MS - 1).toISOString();
		const teams = currentTeams({ rostersAt, players: { jordami01: { team: "CHI" } } }, now);
		expect(teams.get("jordami01")).toEqual(CHI);
		expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/rosters are from/));
	});

	it("warns but still maps rosters that were never rebuilt", () => {
		const teams = currentTeams({ rostersAt: null, players: { jordami01: { team: "CHI" } } }, now);
		expect(teams.get("jordami01")).toEqual(CHI);
		expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/rosters are from never/));
	});
});

describe("getPlayers current team", () => {
	it("gives each rostered player their current team and everyone else none", async () => {
		const search = await call({});
		expect(teamsById(search.data)).toEqual({
			jordami01: CHI,
			pippesc01: { full_name: "Golden State Warriors", abbreviation: "GS" },
			rodmade01: NO_TEAM,
		});

		const byId = await call({ ids: "jordami01,rodmade01" });
		expect(teamsById(byId.data)).toEqual({ jordami01: CHI, rodmade01: NO_TEAM });
	});

	it("shows a trade once the cached roster expires", async () => {
		expect(teamsById((await call({ ids: "jordami01" })).data).jordami01).toEqual(CHI);

		headshots = rosters({ jordami01: "MIA" });
		expect(teamsById((await call({ ids: "jordami01" })).data).jordami01).toEqual(CHI);

		now += CACHE_TTL_MS + 1;
		expect(teamsById((await call({ ids: "jordami01" })).data).jordami01).toEqual({
			full_name: "Miami Heat",
			abbreviation: "MIA",
		});
	});

	it("answers without teams when headshots.json is missing", async () => {
		headshots = null;
		const res = await call({});
		expect(res.statusCode).toBe(200);
		expect(res.data).toHaveLength(3);
		for (const p of res.data) expect(p.team).toEqual(NO_TEAM);
	});

	it("answers without teams when headshots.json is unreadable", async () => {
		headshots = "{not json";
		const res = await call({});
		expect(res.statusCode).toBe(200);
		expect(res.data).toHaveLength(3);
		for (const p of res.data) expect(p.team).toEqual(NO_TEAM);
	});

	it("sorts by the current team, players without one last in both directions", async () => {
		const ids = (res: { data: { id: string }[] }) => res.data.map((p) => p.id);
		expect(ids(await call({ sort: "team" }))).toEqual(["jordami01", "pippesc01", "rodmade01"]);
		expect(ids(await call({ sort: "team", direction: "desc" }))).toEqual([
			"pippesc01",
			"jordami01",
			"rodmade01",
		]);
	});

	it("warns about stale rosters once per read of the file, not on every request", async () => {
		headshots = rosters({ jordami01: "CHI" }, new Date(now - MAX_ROSTERS_AGE_MS - 1).toISOString());
		await call({});
		await call({ search: "michael" });
		expect(console.warn).toHaveBeenCalledTimes(1);
		expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/serving 1 teams anyway/));
	});
});
