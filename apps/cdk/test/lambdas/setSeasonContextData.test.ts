import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { HeadshotsFile, ScheduleFile, StandingsFile } from "models/live-data";
import type { PoolPlayer } from "utilities/player-names";

const s3Send = vi.fn();
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
	// A plain function expression, not an arrow: vitest's mock functions can't
	// be called with `new` otherwise (see setPlayersData.test.ts).
	return { ...actual, S3Client: vi.fn(function () { return { send: s3Send }; }) };
});

process.env.ESPN_API_BASE_URL = "https://espn.test/site";
process.env.ESPN_STANDINGS_URL = "https://espn.test/standings";
process.env.ESPN_HEADSHOT_BASE_URL = "https://img.espn.test/full";
process.env.assetsBucket = "assets";
process.env.staticDataBucket = "static";

const { GetObjectCommand, PutObjectCommand } = await import("@aws-sdk/client-s3");
const { normalizeName } = await import("utilities/player-names");
const {
	HEADSHOTS_KEY,
	HEADSHOT_CACHE_CONTROL,
	LIVE_JSON_CACHE_CONTROL,
	SCHEDULE_KEY,
	STANDINGS_KEY,
	headshotKey,
} = await import("utilities/live-data");
const { HEADSHOT_REFRESH_SECONDS } = await import("utilities/espn");
const { handler, ESPN_USER_AGENT, HEADSHOT_BATCH } = await import(
	"lambdas/setSeasonContextData/src/setSeasonContextData"
);

const NOW = new Date("2026-10-25T12:07:00Z").getTime();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const fixture = (name: string): string =>
	readFileSync(path.join(__dirname, "../fixtures/espn", name), "utf8");
const STANDINGS = JSON.parse(fixture("standings.json"));
const TEAM_IDS: string[] = STANDINGS.children.flatMap((c: any) =>
	c.standings.entries.map((e: any) => e.team.id),
);

// ---- In-memory buckets ----

interface StoredObject {
	body: string | Buffer;
	contentType?: string;
	cacheControl?: string;
}
const objects = new Map<string, StoredObject>();
const puts: string[] = [];
const getErrors = new Map<string, string>();
const objectKey = (bucket: string, key: string) => `${bucket}/${key}`;
const storedJson = <T>(key: string): T => JSON.parse(String(objects.get(objectKey("assets", key))!.body));
const seed = (key: string, value: unknown) =>
	objects.set(objectKey("assets", key), { body: JSON.stringify(value) });

s3Send.mockImplementation(async (cmd: any) => {
	const { Bucket, Key } = cmd.input;
	const id = objectKey(Bucket, Key);
	if (cmd instanceof GetObjectCommand) {
		const errorName = getErrors.get(id);
		if (errorName) throw Object.assign(new Error(errorName), { name: errorName });
		const found = objects.get(id);
		if (!found) throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
		return { Body: { transformToString: async () => String(found.body) } };
	}
	if (cmd instanceof PutObjectCommand) {
		puts.push(id);
		objects.set(id, {
			body: cmd.input.Body,
			contentType: cmd.input.ContentType,
			cacheControl: cmd.input.CacheControl,
		});
		return {};
	}
	throw new Error(`unexpected command ${cmd.constructor.name}`);
});

// ---- A synthetic league ----

// Base-26 letters: the matcher turns digits into spaces, so numbered names
// would all collapse into one.
const letters = (n: number): string => {
	let s = "";
	do {
		s = String.fromCharCode(97 + (n % 26)) + s;
		n = Math.floor(n / 26);
	} while (n > 0);
	return s;
};

interface Athlete {
	id: string;
	fullName: string;
	height: number;
	headshot?: { href: string };
}

let rosters = new Map<string, Athlete[]>();
let pool: PoolPlayer[] = [];

const syntheticLeague = (perTeam = 12) => {
	rosters = new Map();
	pool = [];
	let n = 0;
	for (const teamId of TEAM_IDS) {
		const athletes: Athlete[] = [];
		for (let i = 0; i < perTeam; i++, n++) {
			// The "Q" keeps short codes like "iv" or "jr" from reading as a
			// name suffix.
			const first = `Q${letters(n)}`;
			const height = 72 + (n % 12);
			athletes.push({
				id: `9000${n}`,
				fullName: `${first} Synth`,
				height,
				headshot: { href: `https://img.espn.test/full/9000${n}.png` },
			});
			pool.push({
				id: `synth${n}`,
				first_name: first,
				last_name: "Synth",
				height_feet: Math.floor(height / 12),
				height_inches: height % 12,
				active: true,
			});
		}
		rosters.set(teamId, athletes);
	}
	const names = pool.map((p) => normalizeName(`${p.first_name} ${p.last_name}`));
	expect(new Set(names).size).toBe(names.length);
	objects.set(objectKey("static", "players.json"), { body: JSON.stringify({ data: pool }) });
};

// ---- ESPN ----

interface Request {
	url: string;
	headers: Record<string, string>;
}
const requests: Request[] = [];
type Route = (url: URL, headers: Record<string, string>) => Response | undefined;
let override: Route = () => undefined;

const json = (value: unknown, status = 200) =>
	new Response(typeof value === "string" ? value : JSON.stringify(value), {
		status,
		headers: { "content-type": "application/json" },
	});
const png = (espnId: string) =>
	new Response(new Uint8Array(2048), {
		headers: { "content-type": "image/png", etag: `"e-${espnId}"` },
	});

const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
	const url = new URL(String(input));
	const headers = { ...(init?.headers as Record<string, string>) };
	requests.push({ url: url.href, headers });
	const custom = override(url, headers);
	if (custom) return custom;
	if (url.href === "https://espn.test/standings") return json(STANDINGS);
	if (url.pathname === "/site/scoreboard") {
		return url.searchParams.get("dates") === "20261026"
			? json(fixture("scoreboard-20261026.json"))
			: json({ events: [] });
	}
	const roster = /^\/site\/teams\/(\d+)\/roster$/.exec(url.pathname);
	if (roster) return json({ athletes: rosters.get(roster[1]) ?? [] });
	const image = /^\/full\/(\d+)\.png$/.exec(url.pathname);
	if (url.host === "img.espn.test" && image) return png(image[1]);
	return json({ message: "not found" }, 404);
});

const requestsTo = (pattern: RegExp) => requests.filter((r) => pattern.test(r.url));
const ROSTER = /\/site\/teams\/\d+\/roster$/;
const IMAGE = /^https:\/\/img\.espn\.test\//;

// ---- Running the handler ----

const ctx = (remaining = 300_000) => ({ getRemainingTimeInMillis: () => remaining }) as any;

// Both handlers go on before the clock loop, so a run that rejects is never
// an unhandled rejection that fails the vitest process.
const run = async (context = ctx()) => {
	requests.length = 0;
	puts.length = 0;
	let settled = false;
	const p = handler({} as any, context, () => {}) as Promise<any>;
	p.then(
		() => {
			settled = true;
		},
		() => {
			settled = true;
		},
	);
	while (!settled) await vi.advanceTimersByTimeAsync(1_000);
	return JSON.parse((await p).body);
};

const later = (ms: number) => vi.setSystemTime(Date.now() + ms);

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"], now: NOW });
	vi.stubGlobal("fetch", fetchMock);
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	syntheticLeague();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
	objects.clear();
	getErrors.clear();
	override = () => undefined;
});

describe("setSeasonContextData", () => {
	it("first run writes standings, schedule, headshots and images with the cache headers", async () => {
		const summary = await run();

		expect(summary).toEqual({
			standings: "saved",
			schedule: "saved",
			rosters: "saved",
			headshots: { mirrored: HEADSHOT_BATCH, unchanged: 0, failed: 0 },
		});
		for (const key of [STANDINGS_KEY, SCHEDULE_KEY, HEADSHOTS_KEY]) {
			expect(objects.get(objectKey("assets", key))).toMatchObject({
				contentType: "application/json",
				cacheControl: LIVE_JSON_CACHE_CONTROL,
			});
		}

		const standings = storedJson<StandingsFile>(STANDINGS_KEY);
		expect(standings.conferences.map((c) => c.teams.length)).toEqual([15, 15]);
		expect(standings.generatedAt).toBe(new Date(NOW).toISOString());

		const schedule = storedJson<ScheduleFile>(SCHEDULE_KEY);
		expect(schedule.dates).toEqual([
			"20261024", "20261025", "20261026", "20261027",
			"20261028", "20261029", "20261030", "20261031",
		]);
		expect(schedule.games).toHaveLength(9);

		const headshots = storedJson<HeadshotsFile>(HEADSHOTS_KEY);
		const entries = Object.values(headshots.players);
		expect(entries).toHaveLength(360);
		expect(headshots.unmatched).toEqual([]);
		expect(headshots.rostersAt).toBe(headshots.rostersAttemptedAt);
		const mirrored = entries.filter((e) => e.image !== null);
		expect(mirrored).toHaveLength(HEADSHOT_BATCH);
		expect(headshots.players.synth0).toMatchObject({
			espnId: "90000",
			team: STANDINGS.children
				.flatMap((c: any) => c.standings.entries)
				.find((e: any) => e.team.id === TEAM_IDS[0]).team.abbreviation,
			hasHeadshot: true,
			image: "headshots/90000.png",
			etag: '"e-90000"',
		});
		expect(objects.get(objectKey("assets", headshotKey("90000")))).toMatchObject({
			contentType: "image/png",
			cacheControl: HEADSHOT_CACHE_CONTROL,
		});
	});

	it("a malformed standings response leaves the previous standings.json in place", async () => {
		const previous = { version: 1, generatedAt: "earlier", season: {}, conferences: [] };
		seed(STANDINGS_KEY, previous);
		const before = objects.get(objectKey("assets", STANDINGS_KEY))!.body;
		override = (url) => (url.href.endsWith("/standings") ? json({ children: [] }) : undefined);

		const summary = await run();

		expect(summary.standings).toMatch(/^kept: /);
		expect(objects.get(objectKey("assets", STANDINGS_KEY))!.body).toBe(before);
		expect(puts).not.toContain(objectKey("assets", STANDINGS_KEY));
		expect(puts).toContain(objectKey("assets", SCHEDULE_KEY));
		expect(summary.schedule).toBe("saved");
	});

	it("a 500 from ESPN keeps the previous file", async () => {
		seed(STANDINGS_KEY, { version: 1, generatedAt: "earlier" });
		override = (url) => (url.href.endsWith("/standings") ? json("oops", 500) : undefined);

		const summary = await run();

		expect(summary.standings).toBe("kept: ESPN 500 for https://espn.test/standings");
		expect(storedJson<any>(STANDINGS_KEY).generatedAt).toBe("earlier");
	});

	it("one bad scoreboard day keeps the previous schedule", async () => {
		seed(SCHEDULE_KEY, { version: 1, generatedAt: "earlier", dates: [], games: [] });
		override = (url) =>
			url.searchParams.get("dates") === "20261028" ? json({ events: "nope" }) : undefined;

		const summary = await run();

		expect(summary.schedule).toMatch(/^kept: 20261028: /);
		expect(puts).not.toContain(objectKey("assets", SCHEDULE_KEY));
		expect(storedJson<any>(SCHEDULE_KEY).generatedAt).toBe("earlier");
	});

	it("does not refetch rosters within 23h", async () => {
		await run();
		later(HOUR);

		const summary = await run();

		expect(summary.rosters).toBe("not due");
		expect(requestsTo(ROSTER)).toHaveLength(0);
		// The next batch of images still goes.
		expect(summary.headshots.mirrored).toBe(HEADSHOT_BATCH);
	});

	it("a failed roster rebuild is not retried within 23h", async () => {
		await run();
		const first = storedJson<HeadshotsFile>(HEADSHOTS_KEY);
		later(DAY);
		override = (url) => (ROSTER.test(url.href) ? json("down", 500) : undefined);

		const summary = await run();

		expect(summary.rosters).toMatch(/^kept: ESPN 500/);
		const second = storedJson<HeadshotsFile>(HEADSHOTS_KEY);
		expect(Object.keys(second.players)).toEqual(Object.keys(first.players));
		expect(second.rostersAt).toBe(first.rostersAt);
		expect(Date.parse(second.rostersAttemptedAt)).toBeGreaterThanOrEqual(NOW + DAY);

		later(HOUR);
		expect((await run()).rosters).toBe("not due");
		expect(requestsTo(ROSTER)).toHaveLength(0);
	});

	it("with no previous file, a failed roster rebuild still waits 23h", async () => {
		syntheticLeague(9);

		const summary = await run();

		expect(summary.rosters).toBe("kept: 270 matched athletes, under 300");
		const stub = storedJson<HeadshotsFile>(HEADSHOTS_KEY);
		expect(stub.players).toEqual({});
		expect(stub.rostersAt).toBeNull();
		expect(Date.parse(stub.rostersAttemptedAt)).toBeGreaterThanOrEqual(NOW);

		later(HOUR);
		expect((await run()).rosters).toBe("not due");
		expect(requestsTo(ROSTER)).toHaveLength(0);

		syntheticLeague(12);
		later(DAY);
		expect((await run()).rosters).toBe("saved");
		expect(Object.keys(storedJson<HeadshotsFile>(HEADSHOTS_KEY).players)).toHaveLength(360);
	});

	it("keeps the previous headshot map when matches drop below 80%", async () => {
		syntheticLeague(14);
		await run();
		const first = storedJson<HeadshotsFile>(HEADSHOTS_KEY);
		expect(Object.keys(first.players)).toHaveLength(420);
		for (const athletes of rosters.values()) athletes.splice(11);
		later(DAY);

		const summary = await run();

		expect(summary.rosters).toBe("kept: 330 matched athletes, down from 420");
		expect(Object.keys(storedJson<HeadshotsFile>(HEADSHOTS_KEY).players)).toHaveLength(420);
	});

	it("drops both athletes that resolve to one BBRef id", async () => {
		const [a, b] = [rosters.get(TEAM_IDS[0])![0], rosters.get(TEAM_IDS[1])![0]];
		b.fullName = a.fullName;

		await run();

		const headshots = storedJson<HeadshotsFile>(HEADSHOTS_KEY);
		expect(headshots.players.synth0).toBeUndefined();
		expect(headshots.unmatched).toEqual(
			expect.arrayContaining([`${a.fullName} (${a.id})`, `${b.fullName} (${b.id})`]),
		);
		expect(Object.keys(headshots.players)).toHaveLength(358);
	});

	it("counts one athlete listed twice as one match", async () => {
		const athlete = rosters.get(TEAM_IDS[0])![0];
		rosters.get(TEAM_IDS[1])!.push({ ...athlete });

		await run();

		const headshots = storedJson<HeadshotsFile>(HEADSHOTS_KEY);
		expect(headshots.players.synth0?.espnId).toBe(athlete.id);
		expect(headshots.unmatched).toEqual([]);
	});

	it("does not join a rookie to a retired namesake", async () => {
		// Retired BBRef players with the rookies' names: one 4 inches off the
		// ESPN height, one within an inch.
		Object.assign(pool[0], { active: false, height_inches: pool[0].height_inches! + 4 });
		Object.assign(pool[1], { active: false });
		objects.set(objectKey("static", "players.json"), { body: JSON.stringify({ data: pool }) });

		await run();

		const headshots = storedJson<HeadshotsFile>(HEADSHOTS_KEY);
		expect(headshots.players.synth0).toBeUndefined();
		expect(headshots.unmatched).toEqual(["Qa Synth (90000)"]);
		expect(headshots.players.synth1?.espnId).toBe("90001");
	});

	it("mirrors at most HEADSHOT_BATCH, sends If-None-Match, and a 304 only touches imageAt", async () => {
		const nowS = NOW / 1000;
		const staleS = nowS - HEADSHOT_REFRESH_SECONDS - 10;
		const players = Object.fromEntries(
			pool.map((p, n) => [
				p.id,
				{
					espnId: `9000${n}`,
					team: "ATL",
					hasHeadshot: true,
					image: `headshots/9000${n}.png`,
					imageAt: staleS,
					attemptAt: staleS,
					etag: `"e-9000${n}"`,
				},
			]),
		);
		seed(HEADSHOTS_KEY, {
			version: 1,
			generatedAt: "earlier",
			rostersAt: new Date(NOW).toISOString(),
			rostersAttemptedAt: new Date(NOW).toISOString(),
			players,
			unmatched: [],
		});
		override = (url, headers) =>
			IMAGE.test(url.href) && headers["If-None-Match"] ? new Response(null, { status: 304 }) : undefined;

		const summary = await run();

		expect(summary.headshots).toEqual({ mirrored: 0, unchanged: HEADSHOT_BATCH, failed: 0 });
		const images = requestsTo(IMAGE);
		expect(images).toHaveLength(HEADSHOT_BATCH);
		for (const { url, headers } of images) {
			expect(headers["If-None-Match"]).toBe(`"e-${/(\d+)\.png$/.exec(url)![1]}"`);
		}
		expect(puts.filter((key) => key.endsWith(".png"))).toEqual([]);
		const after = storedJson<HeadshotsFile>(HEADSHOTS_KEY).players;
		const touched = Object.values(after).filter((e) => e.imageAt! >= nowS);
		expect(touched).toHaveLength(HEADSHOT_BATCH);
		for (const entry of touched) expect(entry.image).toBe(`headshots/${entry.espnId}.png`);
	});

	it("rejects a non-PNG headshot", async () => {
		override = (url) =>
			url.href.endsWith("/full/90000.png")
				? new Response("<html>", { headers: { "content-type": "text/html" } })
				: undefined;

		const summary = await run();

		expect(summary.headshots).toEqual({ mirrored: HEADSHOT_BATCH - 1, unchanged: 0, failed: 1 });
		const entry = storedJson<HeadshotsFile>(HEADSHOTS_KEY).players.synth0;
		expect(entry.image).toBeNull();
		expect(entry.attemptAt).toBeGreaterThanOrEqual(NOW / 1000);
		expect(objects.has(objectKey("assets", headshotKey("90000")))).toBe(false);
	});

	it("a 404 headshot is not retried on the next hourly run", async () => {
		override = (url) => (url.href.endsWith("/full/90000.png") ? json("gone", 404) : undefined);
		expect((await run()).headshots.failed).toBe(1);
		later(HOUR);

		await run();

		expect(requestsTo(IMAGE).map((r) => r.url)).not.toContain(
			"https://img.espn.test/full/90000.png",
		);
	});

	it("an unreadable headshots.json skips rosters and mirroring", async () => {
		getErrors.set(objectKey("assets", HEADSHOTS_KEY), "InternalError");

		const summary = await run();

		expect(summary.rosters).toBe("kept: unreadable previous file");
		expect(summary.headshots).toEqual({ mirrored: 0, unchanged: 0, failed: 0 });
		expect(requestsTo(ROSTER)).toHaveLength(0);
		expect(requestsTo(IMAGE)).toHaveLength(0);
		expect(puts).not.toContain(objectKey("assets", HEADSHOTS_KEY));
		expect(puts).toEqual(
			expect.arrayContaining([objectKey("assets", STANDINGS_KEY), objectKey("assets", SCHEDULE_KEY)]),
		);
	});

	it("an unreadable schedule.json keeps the schedule rather than skip its shrink guard", async () => {
		getErrors.set(objectKey("assets", SCHEDULE_KEY), "InternalError");

		const summary = await run();

		expect(summary.schedule).toBe("kept: unreadable previous file");
		expect(requestsTo(/\/scoreboard\?/)).toHaveLength(0);
		expect(puts).not.toContain(objectKey("assets", SCHEDULE_KEY));
		expect(summary.standings).toBe("saved");
	});

	it("a corrupt schedule.json is replaced, not kept forever", async () => {
		objects.set(objectKey("assets", SCHEDULE_KEY), { body: "{ truncated" });

		const summary = await run();

		expect(summary.schedule).toBe("saved");
		expect(storedJson<ScheduleFile>(SCHEDULE_KEY).games).toHaveLength(9);
	});

	it("a first run without team ids retries the rosters next hour", async () => {
		override = (url) => (url.href.endsWith("/standings") ? json("down", 503) : undefined);

		const summary = await run();

		expect(summary.rosters).toBe("kept: no team ids");
		expect(puts).not.toContain(objectKey("assets", HEADSHOTS_KEY));

		override = () => undefined;
		later(HOUR);
		expect((await run()).rosters).toBe("saved");
	});

	it("survives a malformed previous standings.json when ESPN standings fail", async () => {
		seed(STANDINGS_KEY, { version: 1, conferences: [null, { teams: [null, {}] }] });
		override = (url) => (url.href.endsWith("/standings") ? json("down", 503) : undefined);

		const summary = await run();

		expect(summary.rosters).toBe("kept: no team ids");
		expect(summary.schedule).toBe("saved");
	});

	it("rebuilds a version 1 headshots.json of the wrong shape instead of crashing or stalling", async () => {
		seed(HEADSHOTS_KEY, { version: 1 });

		const summary = await run();

		expect(summary.rosters).toBe("saved");
		expect(Object.keys(storedJson<HeadshotsFile>(HEADSHOTS_KEY).players)).toHaveLength(360);
	});

	it("rejects a headshots entry with an empty ESPN id", async () => {
		await run();
		const file = storedJson<HeadshotsFile>(HEADSHOTS_KEY);
		file.players.synth0.espnId = "";
		seed(HEADSHOTS_KEY, file);
		later(HOUR);

		expect((await run()).rosters).toBe("saved");
		expect(requestsTo(/\/full\/\.png$/)).toHaveLength(0);
	});

	it.each([
		["no games", { version: 1, dates: [], games: null }],
		["a game whose date doesn't parse", { version: 1, dates: [], games: [{ id: "1", date: "garbage" }] }],
	])("replaces a version 1 schedule.json with %s", async (_, previous) => {
		seed(SCHEDULE_KEY, previous);

		const summary = await run();

		expect(summary.schedule).toBe("saved");
		expect(storedJson<ScheduleFile>(SCHEDULE_KEY).games).toHaveLength(9);
	});

	it("doesn't rebuild rosters from a partial previous standings.json", async () => {
		seed(STANDINGS_KEY, {
			version: 1,
			conferences: [{ name: "East", teams: [{ espnId: "1", abbreviation: "ATL" }] }],
		});
		override = (url) => (url.href.endsWith("/standings") ? json("down", 503) : undefined);

		const summary = await run();

		expect(summary.rosters).toBe("kept: no team ids");
		expect(requestsTo(ROSTER)).toHaveLength(0);
	});

	it("releases the body of every ESPN response it doesn't read", async () => {
		let cancelled = 0;
		const unread = (status: number) =>
			new Response(new ReadableStream({ cancel: () => void cancelled++ }), { status });
		override = (url) =>
			url.href.endsWith("dates=20261024") || url.href.endsWith("/full/90000.png") ? unread(500) : undefined;

		await run();

		expect(cancelled).toBe(2);
	});

	it("stops mirroring when the Lambda is nearly out of time", async () => {
		const summary = await run(ctx(10_000));

		expect(summary.headshots).toEqual({ mirrored: 0, unchanged: 0, failed: 0 });
		expect(requestsTo(IMAGE)).toHaveLength(0);
	});

	it("every ESPN request sends the browser User-Agent", async () => {
		await run();

		expect(requests.length).toBeGreaterThan(100);
		for (const request of requests) {
			expect(request.headers["User-Agent"]).toBe(ESPN_USER_AGENT);
		}
	});

	it("paces ESPN requests at least ESPN_REQUEST_INTERVAL_MS apart", async () => {
		const starts: number[] = [];
		override = () => {
			starts.push(Date.now());
			return undefined;
		};

		await run();

		for (let i = 1; i < starts.length; i++) {
			expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(500);
		}
	});
});
