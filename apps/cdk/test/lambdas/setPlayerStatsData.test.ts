import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const send = vi.fn();
vi.mock("@aws-sdk/lib-dynamodb", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/lib-dynamodb")>();
	return { ...actual, DynamoDBDocumentClient: { from: () => ({ send }) } };
});

vi.mock("@aws-sdk/client-dynamodb", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-dynamodb")>();
	return { ...actual, DynamoDBClient: vi.fn() };
});

const s3Send = vi.fn();
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
	// A plain function expression, not an arrow: vitest's mock functions can't
	// be called with `new` otherwise (see setPlayersData.test.ts).
	return { ...actual, S3Client: vi.fn(function () { return { send: s3Send }; }) };
});

const fetchMock = vi.fn();
vi.mock("node-fetch", () => ({ default: fetchMock }));

process.env.MAIN_TABLE_NAME = "main-table";
process.env.BBREF_BASE_URL = "https://bbref.test";
process.env.staticDataBucket = "static";

const { PutCommand, QueryCommand, UpdateCommand } = await import("@aws-sdk/lib-dynamodb");
const {
	handler,
	parseCareer,
	planRun,
	slotEndMs,
	REQUEST_INTERVAL_MS,
	FETCH_TIMEOUT_MS,
	ACTIVE_REFRESH_SECONDS,
	INACTIVE_REFRESH_SECONDS,
	RETRY_FAILED_SECONDS,
	BLOCKED_COOLDOWN_SECONDS,
	BLOCKED_PREFIX,
	RATE_LIMITED_ERROR,
	FAILURES_COOLDOWN_SECONDS,
	RUN_CONTROL_KEY,
	SHRINK_CONDITION,
	FAILED_UPDATE,
	LEASE_UPDATE,
	LEASE_CONDITION,
	RELEASE_UPDATE,
	PAUSE_UPDATE,
} = await import("lambdas/setPlayerStatsData/src/setPlayerStatsData");

const NOW = new Date("2026-10-24T12:00:00Z").getTime();
const nowS = NOW / 1000;
const DAY = 24 * 60 * 60;

// ---- In-memory main table ----

const table = new Map<string, Record<string, any>>();
const keyOf = (k: { PK: string; SK: string }) => `${k.PK}|${k.SK}`;
const stored = (id: string) => table.get(keyOf({ PK: "PLAYERSTATS", SK: id }));
const control = () => table.get(keyOf(RUN_CONTROL_KEY));
const store = (id: string, item: Record<string, unknown>) =>
	table.set(keyOf({ PK: "PLAYERSTATS", SK: id }), { PK: "PLAYERSTATS", SK: id, ...item });

let pageSize: number | undefined;
let leaseUntil: number | undefined;
let failNextFailedUpdate = false;

const conditionFailed = () =>
	Object.assign(new Error("cond"), { name: "ConditionalCheckFailedException" });

send.mockImplementation(async (cmd: any) => {
	const input = cmd.input;
	if (cmd instanceof QueryCommand) {
		const all = [...table.values()].filter(
			(item) => item.PK === input.ExpressionAttributeValues[":pk"],
		);
		const from = input.ExclusiveStartKey
			? all.findIndex((item) => item.SK === input.ExclusiveStartKey.SK) + 1
			: 0;
		const page = pageSize ? all.slice(from, from + pageSize) : all.slice(from);
		const last = page[page.length - 1];
		return {
			Items: page.map(({ SK, checkedAt, lastError, failed }) => ({
				SK,
				checkedAt,
				lastError,
				failed,
			})),
			LastEvaluatedKey:
				from + page.length < all.length ? { PK: last.PK, SK: last.SK } : undefined,
		};
	}
	if (cmd instanceof PutCommand) {
		const key = keyOf(input.Item);
		const existing = table.get(key);
		if (
			input.ConditionExpression === SHRINK_CONDITION &&
			Array.isArray(existing?.stats) &&
			existing.stats.length > input.ExpressionAttributeValues[":seasons"]
		) {
			throw conditionFailed();
		}
		table.set(key, input.Item);
		return {};
	}
	if (cmd instanceof UpdateCommand) {
		const key = keyOf(input.Key);
		const existing = table.get(key);
		const vals = input.ExpressionAttributeValues ?? {};
		switch (input.UpdateExpression) {
			case FAILED_UPDATE: {
				if (failNextFailedUpdate) {
					failNextFailedUpdate = false;
					throw new Error("throttled");
				}
				const { ttl: _ttl, freshUntil: _freshUntil, ...rest } = existing ?? input.Key;
				table.set(key, { ...rest, checkedAt: vals[":now"], lastError: vals[":error"] });
				return {};
			}
			case LEASE_UPDATE: {
				if (existing?.runningUntil !== undefined && existing.runningUntil > vals[":now"]) {
					throw conditionFailed();
				}
				leaseUntil = vals[":until"];
				const item = { ...(existing ?? input.Key), runningUntil: vals[":until"] };
				table.set(key, item);
				return { Attributes: item };
			}
			case RELEASE_UPDATE:
				if (existing) delete existing.runningUntil;
				return {};
			case PAUSE_UPDATE:
				table.set(key, {
					...(existing ?? input.Key),
					cooldownUntil: vals[":until"],
					reason: vals[":reason"],
				});
				return {};
		}
		throw new Error("unexpected update");
	}
	throw new Error("unexpected command");
});

const sentCommands = (type: any) => send.mock.calls.map(([cmd]) => cmd).filter((cmd) => cmd instanceof type);

// ---- static-data bucket ----

let players: { id: string; active: boolean }[] = [];
let ratings: Record<string, unknown> = {};
let failKey: string | undefined;

s3Send.mockImplementation(async (cmd: any) => {
	const key = cmd.input.Key;
	if (key === failKey) throw new Error(`no ${key}`);
	const body = key === "players.json" ? { data: players } : { data: ratings };
	return { Body: { transformToString: async () => JSON.stringify(body) } };
});

// ---- Basketball-Reference ----

const seasonRow = (season: number, pts: number) =>
	`<tr><th data-stat="year_id">${season}-${String(season + 1).slice(2)}</th>` +
	`<td data-stat="games">70</td><td data-stat="fg_per_g">${pts / 2}</td>` +
	`<td data-stat="pts_per_g">${pts}</td></tr>`;

const playerPage = (...rows: string[]) =>
	`<div id="meta"></div><table id="per_game_stats"><tbody>${rows.join("")}</tbody></table>`;

const DEFAULT_PAGE = { status: 200, html: playerPage(seasonRow(2025, 20), seasonRow(2024, 18)) };
const NO_TABLE = { status: 200, html: `<div id="meta"></div>` };
const NO_META = { status: 200, html: `<html><body>Slow down</body></html>` };

const pages = new Map<string, { status: number; html?: string } | Error>();
const fetched: string[] = [];
const fetchTimes: number[] = [];

fetchMock.mockImplementation(async (url: string) => {
	const id = url.split("/").pop()!.replace(".html", "");
	fetched.push(id);
	fetchTimes.push(Date.now());
	const page = pages.get(id) ?? DEFAULT_PAGE;
	if (page instanceof Error) throw page;
	return {
		ok: page.status < 400,
		status: page.status,
		statusText: "x",
		text: async () => page.html ?? "",
	};
});

// ---- Running the handler ----

const ctx = (remaining: number[] = [600_000]) => {
	let i = 0;
	return {
		getRemainingTimeInMillis: () => remaining[Math.min(i++, remaining.length - 1)],
	} as any;
};

// Both handlers go on before the clock loop, so a run that rejects is never
// an unhandled rejection that fails the vitest process.
const run = async (context = ctx()) => {
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

const missing = (...ids: string[]) => ids.map((id) => ({ id, active: false }));

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"], now: NOW });
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	players = [];
	ratings = {};
	failKey = undefined;
	pageSize = undefined;
	leaseUntil = undefined;
	failNextFailedUpdate = false;
});

afterEach(() => {
	vi.useRealTimers();
	vi.clearAllMocks();
	table.clear();
	pages.clear();
	fetched.length = 0;
	fetchTimes.length = 0;
});

const requestS = (i: number) => Math.floor(fetchTimes[i] / 1000);

describe("setPlayerStatsData handler", () => {
	it("backfills missing players, current first, then rated, then the rest", async () => {
		players = [
			{ id: "c", active: false },
			{ id: "a", active: true },
			{ id: "b", active: false },
		];
		ratings = { b: { rating: 80 } };

		const summary = await run();

		expect(fetched).toEqual(["a", "b", "c"]);
		expect(summary).toEqual({ due: 3, attempted: 3, saved: 3, failed: 0, stoppedBy: "done" });
		for (const [i, id] of fetched.entries()) {
			const item = stored(id)!;
			expect(item).toEqual({
				PK: "PLAYERSTATS",
				SK: id,
				stats: expect.any(Array),
				scrapedAt: requestS(i),
				checkedAt: requestS(i),
			});
			expect(item.stats.map((s: any) => s.season)).toEqual([2025, 2024]);
		}
		expect(control()).toBeDefined();
		expect(control()!.runningUntil).toBeUndefined();
	});

	it("spaces requests at least REQUEST_INTERVAL_MS apart", async () => {
		players = missing("a", "b", "c", "d");

		await run();

		expect(fetchTimes).toHaveLength(4);
		for (let i = 1; i < fetchTimes.length; i++) {
			expect(fetchTimes[i] - fetchTimes[i - 1]).toBeGreaterThanOrEqual(REQUEST_INTERVAL_MS);
		}
	});

	it("stops at its time budget and the next run picks up the rest", async () => {
		players = missing("a", "b", "c", "d", "e");

		// The lease, then three loop checks.
		const first = await run(ctx([600_000, 600_000, 600_000, 59_000]));
		expect(first.stoppedBy).toBe("budget");
		expect(fetched).toEqual(["a", "b"]);

		const second = await run(ctx());
		expect(second.stoppedBy).toBe("done");
		expect(fetched).toEqual(["a", "b", "c", "d", "e"]);
	});

	it("scrapes nothing when nothing is due", async () => {
		players = [
			{ id: "a", active: true },
			{ id: "b", active: false },
		];
		store("a", { stats: [], checkedAt: nowS - 60 });
		store("b", { stats: [], checkedAt: nowS - 60 });

		const summary = await run();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(summary).toMatchObject({ due: 0, stoppedBy: "done" });
	});

	it("keeps the stored career when the scrape fails validation", async () => {
		players = [{ id: "a", active: true }];
		const old = [{ season: 2024 }, { season: 2023 }];
		store("a", { stats: old, scrapedAt: 123, checkedAt: nowS - 8 * DAY });
		pages.set("a", { status: 200, html: playerPage(seasonRow(2031, 20), seasonRow(2025, 20)) });

		const summary = await run();

		expect(summary).toMatchObject({ saved: 0, failed: 1 });
		const item = stored("a")!;
		expect(item.stats).toBe(old);
		expect(item.scrapedAt).toBe(123);
		expect(item.lastError).toMatch(/out of range/);
		expect(item.checkedAt).toBe(requestS(0));
	});

	it("keeps the stored career when the new one has fewer seasons", async () => {
		players = [{ id: "a", active: true }];
		const old = [{ season: 2025 }, { season: 2024 }, { season: 2023 }];
		store("a", { stats: old, scrapedAt: 123, checkedAt: nowS - 8 * DAY });

		await run();

		const item = stored("a")!;
		expect(item.stats).toBe(old);
		expect(item.lastError).toBe("fewer seasons than the stored career");
	});

	it.each([
		["a 500", { status: 500 }, /500/],
		["a 404", { status: 404 }, /404/],
		["a page with no table for a retired player", NO_TABLE, /no seasons for a retired player/],
		["a rejected fetch", new Error("ECONNRESET"), /ECONNRESET/],
	])("records a failure for a missing player (%s)", async (_label, page, error) => {
		players = missing("a");
		pages.set("a", page);

		const summary = await run();

		expect(summary).toMatchObject({ saved: 0, failed: 1, stoppedBy: "done" });
		expect(stored("a")).toEqual({
			PK: "PLAYERSTATS",
			SK: "a",
			checkedAt: requestS(0),
			lastError: expect.stringMatching(error),
		});
	});

	it("stores an empty career for a current player", async () => {
		players = [{ id: "a", active: true }];
		pages.set("a", NO_TABLE);

		const summary = await run();

		expect(summary).toMatchObject({ saved: 1, failed: 0 });
		expect(stored("a")!.stats).toEqual([]);
	});

	it.each([
		["429", { status: 429 }],
		["403", { status: 403 }],
		["a 200 page without #meta", NO_META],
	])("stops and pauses for a day when BBRef blocks us (%s)", async (_label, page) => {
		players = missing("a", "b", "c");
		pages.set("b", page);

		const first = await run();

		expect(fetched).toEqual(["a", "b"]);
		expect(first).toEqual({ due: 3, attempted: 2, saved: 1, failed: 1, stoppedBy: "blocked" });
		const cooldownUntil = control()!.cooldownUntil;
		expect(cooldownUntil).toBe(requestS(1) + BLOCKED_COOLDOWN_SECONDS);
		expect(stored("b")).toEqual({
			PK: "PLAYERSTATS",
			SK: "b",
			checkedAt: requestS(1),
			lastError: expect.stringMatching(new RegExp(`^${BLOCKED_PREFIX}`)),
		});

		send.mockClear();
		const second = await run();
		expect(second.stoppedBy).toBe("cooldown");
		expect(fetched).toHaveLength(2);
		expect(sentCommands(QueryCommand)).toHaveLength(0);

		pages.delete("b");
		vi.setSystemTime((cooldownUntil + 1) * 1000);
		const third = await run();
		expect(fetched.slice(2)).toEqual(["c", "b"]);
		expect(third.stoppedBy).toBe("done");
	});

	it.each([
		["403 after a 403", { status: 403 }, "blocked: BBRef returned 403"],
		["no #meta after no #meta", NO_META, "blocked: BBRef returned a page without player info"],
		["no #meta after a 403", NO_META, "blocked: BBRef returned 403"],
		["403 after no #meta", { status: 403 }, "blocked: BBRef returned a page without player info"],
	])("treats a second block on the same player as an ordinary failure (%s)", async (_label, page, lastError) => {
		players = [
			{ id: "x", active: false },
			{ id: "y", active: true },
		];
		store("x", { checkedAt: nowS - 10 * DAY, lastError });
		store("y", { stats: [{ season: 2025 }, { season: 2024 }], checkedAt: nowS - 8 * DAY });
		pages.set("x", page);

		const summary = await run();

		expect(fetched).toEqual(["x", "y"]);
		expect(summary).toEqual({ due: 2, attempted: 2, saved: 1, failed: 1, stoppedBy: "done" });
		expect(control()!.cooldownUntil).toBeUndefined();
		const expected =
			page === NO_META ? "blocked: BBRef returned a page without player info" : "blocked: BBRef returned 403";
		expect(stored("x")!.lastError).toBe(expected);
		expect(stored("x")!.checkedAt).toBe(requestS(0));
	});

	it("pauses on a 403 from a player whose last block was a 429", async () => {
		players = missing("x");
		store("x", { checkedAt: nowS - 10 * DAY, lastError: RATE_LIMITED_ERROR });
		pages.set("x", { status: 403 });

		const summary = await run();

		expect(summary.stoppedBy).toBe("blocked");
		expect(control()!.cooldownUntil).toBe(requestS(0) + BLOCKED_COOLDOWN_SECONDS);
		expect(stored("x")!.lastError).toBe("blocked: BBRef returned 403");
	});

	it("pauses on a 429 even from a player who was blocked before", async () => {
		players = missing("x", "y");
		store("x", { checkedAt: nowS - 10 * DAY, lastError: "blocked: BBRef returned 429" });
		pages.set("x", { status: 429 });

		const summary = await run();

		expect(fetched).toEqual(["y", "x"]);
		expect(summary.stoppedBy).toBe("blocked");
		expect(control()!.cooldownUntil).toBe(requestS(1) + BLOCKED_COOLDOWN_SECONDS);
	});

	it("still pauses when charging the block to the player fails", async () => {
		players = missing("a");
		pages.set("a", { status: 429 });
		failNextFailedUpdate = true;

		await expect(run()).rejects.toThrow("throttled");

		expect(control()!.cooldownUntil).toBe(requestS(0) + BLOCKED_COOLDOWN_SECONDS);
		expect(control()!.runningUntil).toBeUndefined();
	});

	it("pauses for an hour after MAX_CONSECUTIVE_FAILURES failures in a row", async () => {
		players = missing("a", "b", "c", "d", "e", "f", "g");
		for (const { id } of players) pages.set(id, { status: 500 });

		const summary = await run();

		expect(fetched).toHaveLength(5);
		expect(summary.stoppedBy).toBe("failures");
		expect(control()!.cooldownUntil).toBe(requestS(4) + FAILURES_COOLDOWN_SECONDS);
	});

	it("a saved career resets the failure count", async () => {
		players = missing("p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9");
		for (const { id } of players) if (id !== "p5") pages.set(id, { status: 500 });

		const summary = await run();

		expect(fetched).toHaveLength(9);
		expect(summary.stoppedBy).toBe("done");
	});

	it("rewrites a legacy cache item without its ttl", async () => {
		players = missing("l1", "l2");
		store("l1", { stats: [{ season: 2024 }], freshUntil: nowS - 1, ttl: nowS + 1000 });
		store("l2", { stats: [{ season: 2024 }], freshUntil: nowS - 1, ttl: nowS + 1000 });
		pages.set("l2", { status: 500 });

		await run();

		const rewritten = stored("l1")!;
		expect(rewritten.stats).toHaveLength(2);
		expect(rewritten.scrapedAt).toBeDefined();
		expect(rewritten.checkedAt).toBeDefined();
		expect(rewritten).not.toHaveProperty("ttl");
		expect(rewritten).not.toHaveProperty("freshUntil");

		const failed = stored("l2")!;
		expect(failed.stats).toEqual([{ season: 2024 }]);
		expect(failed).not.toHaveProperty("ttl");
		expect(failed).not.toHaveProperty("freshUntil");
	});

	it("reads every page of the snapshot", async () => {
		pageSize = 2;
		players = missing("a", "b", "c", "d", "e");
		for (const { id } of players) store(id, { stats: [], checkedAt: nowS - 60 });

		await run();

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("still runs without player-ratings.json", async () => {
		players = [
			{ id: "c", active: false },
			{ id: "a", active: true },
			{ id: "b", active: false },
		];
		// Would put c ahead of b if it were read.
		ratings = { c: { rating: 80 } };
		failKey = "player-ratings.json";

		await run();

		expect(fetched).toEqual(["a", "b", "c"]);
	});

	it("fails the run when players.json is unreadable", async () => {
		failKey = "players.json";

		await expect(run()).rejects.toThrow();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(control()!.runningUntil).toBeUndefined();
	});

	it("passes a timeout signal", async () => {
		players = missing("a");

		await run();

		expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
	});

	it("writes the exact expressions", async () => {
		expect(SHRINK_CONDITION).toBe("attribute_not_exists(#stats) OR size(#stats) <= :seasons");
		expect(FAILED_UPDATE).toBe(
			"SET #checkedAt = :now, #lastError = :error REMOVE #ttl, #freshUntil",
		);
		expect(LEASE_UPDATE).toBe("SET #runningUntil = :until");
		expect(LEASE_CONDITION).toBe(
			"attribute_not_exists(#runningUntil) OR #runningUntil <= :now",
		);
		expect(RELEASE_UPDATE).toBe("REMOVE #runningUntil");
		expect(PAUSE_UPDATE).toBe("SET #cooldownUntil = :until, #reason = :reason");
		expect(BLOCKED_PREFIX).toBe("blocked: ");
		expect(RATE_LIMITED_ERROR).toBe("blocked: BBRef returned 429");

		players = missing("a", "b");
		pages.set("b", { status: 500 });

		await run();

		const puts = sentCommands(PutCommand);
		expect(puts).toHaveLength(1);
		expect(puts[0].input.ConditionExpression).toBe(SHRINK_CONDITION);

		const updates = sentCommands(UpdateCommand);
		expect(
			updates.some((u) => u.input.UpdateExpression === FAILED_UPDATE && u.input.Key.SK === "b"),
		).toBe(true);
		const lease = updates.find((u) => u.input.UpdateExpression === LEASE_UPDATE)!;
		expect(lease.input.ConditionExpression).toBe(LEASE_CONDITION);
		expect(lease.input.ReturnValues).toBe("ALL_NEW");

		const last = send.mock.calls[send.mock.calls.length - 1][0];
		expect(last).toBeInstanceOf(UpdateCommand);
		expect(last.input.UpdateExpression).toBe(RELEASE_UPDATE);
	});

	it("skips the run while another holds the lease", async () => {
		players = missing("a", "b");
		table.set(keyOf(RUN_CONTROL_KEY), { ...RUN_CONTROL_KEY, runningUntil: nowS + 600 });

		const summary = await run();

		expect(summary.stoppedBy).toBe("running");
		expect(fetchMock).not.toHaveBeenCalled();
		expect(sentCommands(QueryCommand)).toHaveLength(0);
		expect(control()!.runningUntil).toBe(nowS + 600);
	});

	it("takes over an expired lease", async () => {
		players = missing("a", "b");
		table.set(keyOf(RUN_CONTROL_KEY), { ...RUN_CONTROL_KEY, runningUntil: nowS - 1 });

		const summary = await run();

		expect(summary.stoppedBy).toBe("done");
		expect(fetched).toEqual(["a", "b"]);
		expect(control()!.runningUntil).toBeUndefined();
	});

	it("sizes the lease to the invocation's time limit", async () => {
		players = missing("a");

		await run(ctx([780_000]));

		expect(leaseUntil).toBe(nowS + 780);
	});

	it("makes no request past 12 minutes into its slot when it starts late", async () => {
		vi.setSystemTime(NOW + 11 * 60_000 + 40_000);
		players = missing("a", "b", "c", "d", "e");

		const summary = await run();

		// 11:40, 11:43.5 and 11:47; a 4th at 11:50.5 could run past 12:00.
		expect(fetched).toHaveLength(3);
		expect(summary.stoppedBy).toBe("budget");
		for (const t of fetchTimes) {
			expect(t + FETCH_TIMEOUT_MS).toBeLessThanOrEqual(slotEndMs(NOW));
		}
	});

	it("scrapes nothing when it starts after its slot's stop time", async () => {
		vi.setSystemTime(NOW + 12 * 60_000 + 30_000);
		players = missing("a", "b");

		const summary = await run();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(summary).toMatchObject({ due: 2, attempted: 0, stoppedBy: "budget" });
		expect(control()!.runningUntil).toBeUndefined();
	});
});

describe("slotEndMs", () => {
	it("is 12 minutes into the run's 20-minute slot", () => {
		expect(slotEndMs(NOW)).toBe(NOW + 12 * 60_000);
		expect(slotEndMs(NOW + 19 * 60_000 + 59_000)).toBe(NOW + 12 * 60_000);
		expect(slotEndMs(NOW + 20 * 60_000)).toBe(NOW + 32 * 60_000);
	});
});

describe("planRun", () => {
	const plan = (
		pool: { id: string; active: boolean }[],
		entries: Record<string, Record<string, unknown>>,
		rated: string[] = [],
	) => planRun(pool, new Set(rated), new Map(Object.entries(entries)), nowS);

	it("orders missing, then legacy, then due refreshes oldest first", () => {
		const pool = [
			{ id: "refresh-new", active: true },
			{ id: "legacy", active: false },
			{ id: "missing-other", active: false },
			{ id: "refresh-old", active: true },
			{ id: "missing-rated", active: false },
			{ id: "missing-active", active: true },
		];
		const entries = {
			"refresh-new": { checkedAt: nowS - ACTIVE_REFRESH_SECONDS - 10 },
			"refresh-old": { checkedAt: nowS - ACTIVE_REFRESH_SECONDS - 100 },
			legacy: {},
		};

		expect(plan(pool, entries, ["missing-rated"])).toEqual([
			"missing-active",
			"missing-rated",
			"missing-other",
			"legacy",
			"refresh-old",
			"refresh-new",
		]);
	});

	it("ranks a legacy failure marker as missing", () => {
		const pool = [
			{ id: "legacy", active: false },
			{ id: "marker", active: false },
		];
		expect(plan(pool, { legacy: {}, marker: { failed: true } })).toEqual(["marker", "legacy"]);
	});

	it("refreshes a current player weekly", () => {
		const pool = [{ id: "a", active: true }];
		expect(plan(pool, { a: { checkedAt: nowS - ACTIVE_REFRESH_SECONDS } })).toEqual(["a"]);
		expect(plan(pool, { a: { checkedAt: nowS - ACTIVE_REFRESH_SECONDS + 1 } })).toEqual([]);
	});

	it("refreshes a retired player every 90 days", () => {
		const pool = [{ id: "a", active: false }];
		expect(plan(pool, { a: { checkedAt: nowS - INACTIVE_REFRESH_SECONDS } })).toEqual(["a"]);
		expect(plan(pool, { a: { checkedAt: nowS - 30 * DAY } })).toEqual([]);
	});

	it.each([true, false])("retries a failure after a day (active: %s)", (active) => {
		const pool = [{ id: "a", active }];
		const failedAt = (age: number) => ({ a: { checkedAt: nowS - age, lastError: "x" } });
		expect(plan(pool, failedAt(RETRY_FAILED_SECONDS))).toEqual(["a"]);
		expect(plan(pool, failedAt(RETRY_FAILED_SECONDS - 1))).toEqual([]);
	});

	it("ignores entries for players no longer in the pool", () => {
		expect(plan([], { gone: {} })).toEqual([]);
	});
});

describe("parseCareer", () => {
	it("puts the most recent season first", () => {
		const stats = parseCareer(playerPage(seasonRow(2023, 10), seasonRow(2025, 20)))!;
		expect(stats.map((s) => s.season)).toEqual([2025, 2023]);
	});

	it("keeps the first row of a multi-team season", () => {
		const stats = parseCareer(
			playerPage(seasonRow(2024, 20), seasonRow(2024, 12), seasonRow(2024, 8)),
		)!;
		expect(stats).toHaveLength(1);
		expect(stats[0].pts).toBe(20);
	});

	it("skips header and career rows", () => {
		const stats = parseCareer(
			playerPage(
				seasonRow(2024, 20),
				`<tr class="thead"><th data-stat="year_id">Season</th></tr>`,
				`<tr><th data-stat="year_id">Career</th><td data-stat="pts_per_g">27</td></tr>`,
			),
		)!;
		expect(stats.map((s) => s.season)).toEqual([2024]);
	});

	it("returns null for a page without player info", () => {
		expect(parseCareer(NO_META.html)).toBeNull();
	});

	it("returns no seasons for a player page without the table", () => {
		expect(parseCareer(NO_TABLE.html)).toEqual([]);
	});
});
