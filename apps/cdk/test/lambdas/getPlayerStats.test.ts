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

const { GetCommand, PutCommand } = await import("@aws-sdk/lib-dynamodb");
const {
	handler,
	STATS_FRESH_SECONDS,
	EMPTY_FRESH_SECONDS,
	FAILURE_BACKOFF_SECONDS,
	RETAIN_SECONDS,
} = await import("lambdas/getPlayerStats/src/getPlayerStats");

const NOW = new Date("2026-10-11T12:00:00Z").getTime();
const nowS = NOW / 1000;

const OLD_STATS = [{ season: 2024, pts: 20 }];

const cacheItem = (over: Record<string, unknown>) => ({
	PK: "PLAYERSTATS",
	SK: "jamesle01",
	stats: OLD_STATS,
	...over,
});

// A refresh that is due: it stopped being fresh a second ago, and DynamoDB
// still holds it for another 1000s.
const expired = () => cacheItem({ freshUntil: nowS - 1, ttl: nowS + 1000 });

const seasonRow = (season: number, pts: number) =>
	`<tr><th data-stat="year_id">${season}-${String(season + 1).slice(2)}</th>` +
	`<td data-stat="games">70</td><td data-stat="pts_per_g">${pts}</td></tr>`;

const playerPage = (...rows: string[]) =>
	`<div id="meta"></div><table id="per_game_stats"><tbody>${rows.join("")}</tbody></table>`;

const EMPTY_PLAYER_PAGE = `<div id="meta"></div>`;

const page = (html: string) => ({
	ok: true,
	status: 200,
	statusText: "OK",
	text: async () => html,
});

const httpError = (status: number, statusText: string) => ({
	ok: false,
	status,
	statusText,
	text: async () => "",
});

const stubCache = (item?: Record<string, unknown>, putError?: Error) =>
	send.mockImplementation(async (cmd: unknown) => {
		if (cmd instanceof GetCommand) return { Item: item };
		if (putError) throw putError;
		return {};
	});

const putInputs = () =>
	send.mock.calls
		.map(([cmd]) => cmd)
		.filter((cmd) => cmd instanceof PutCommand)
		.map((cmd: any) => cmd.input);

const puts = () => putInputs().map((input) => input.Item);

const call = (playerId = "jamesle01") =>
	handler({ queryStringParameters: { playerId } }, {} as any, () => {}) as Promise<any>;

const body = (res: any) => JSON.parse(res.body);

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"], now: NOW });
	send.mockReset();
	fetchMock.mockReset();
	s3Send.mockReset();
	// No ratings file, so the response carries stats only.
	s3Send.mockRejectedValue(new Error("NoSuchKey"));
	vi.spyOn(console, "log").mockImplementation(() => {});
	errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("getPlayerStats cache", () => {
	it("serves a fresh entry without scraping", async () => {
		stubCache(cacheItem({ freshUntil: nowS + 60, ttl: nowS + 60 + RETAIN_SECONDS }));

		const res = await call();

		expect(res.statusCode).toBe(200);
		expect(body(res).data).toEqual(OLD_STATS);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(puts()).toHaveLength(0);
	});

	it("serves a fresh legacy entry by its ttl", async () => {
		stubCache(cacheItem({ ttl: nowS + 60 }));

		const res = await call();

		expect(res.statusCode).toBe(200);
		expect(body(res).data).toEqual(OLD_STATS);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(puts()).toHaveLength(0);
	});

	it.each([
		["retained", { freshUntil: nowS - 1, ttl: nowS + RETAIN_SECONDS }],
		["legacy", { ttl: nowS - 1 }],
	])("refreshes an expired entry (%s)", async (_label, timing) => {
		stubCache(cacheItem(timing));
		fetchMock.mockResolvedValue(page(playerPage(seasonRow(2024, 27), seasonRow(2025, 30))));

		const res = await call();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(res.statusCode).toBe(200);
		expect(body(res).data.map((s: any) => s.season)).toEqual([2025, 2024]);
		const [item] = puts();
		expect(item.freshUntil).toBe(nowS + STATS_FRESH_SECONDS);
		expect(item.ttl).toBe(nowS + STATS_FRESH_SECONDS + RETAIN_SECONDS);
		expect(item.failed).toBeUndefined();
		expect(putInputs()[0].ConditionExpression).toBeUndefined();
	});

	it("caches an empty career only briefly", async () => {
		stubCache(undefined);
		fetchMock.mockResolvedValue(page(EMPTY_PLAYER_PAGE));

		const res = await call();

		expect(res.statusCode).toBe(200);
		expect(body(res).data).toEqual([]);
		const [item] = puts();
		expect(item.freshUntil).toBe(nowS + EMPTY_FRESH_SECONDS);
		expect(item.ttl).toBe(nowS + EMPTY_FRESH_SECONDS + RETAIN_SECONDS);
		expect(item.failed).toBeUndefined();
	});

	it("treats a 404 as an empty career", async () => {
		stubCache(undefined);
		fetchMock.mockResolvedValue(httpError(404, "Not Found"));

		const res = await call();

		expect(res.statusCode).toBe(200);
		expect(body(res).data).toEqual([]);
		expect(puts()[0].freshUntil).toBe(nowS + EMPTY_FRESH_SECONDS);
	});

	it("still returns fresh stats when the cache write fails", async () => {
		stubCache(undefined, new Error("ProvisionedThroughputExceeded"));
		fetchMock.mockResolvedValue(page(playerPage(seasonRow(2025, 30))));

		const res = await call();

		expect(res.statusCode).toBe(200);
		expect(body(res).data.map((s: any) => s.season)).toEqual([2025]);
	});

	it("passes a timeout signal to the scrape", async () => {
		stubCache(undefined);
		fetchMock.mockResolvedValue(page(EMPTY_PLAYER_PAGE));

		await call();

		expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
	});

	it("rejects an invalid playerId", async () => {
		const res = await call("../x");

		expect(res.statusCode).toBe(400);
		expect(send).not.toHaveBeenCalled();
	});
});

describe("getPlayerStats when Basketball-Reference fails", () => {
	it.each([
		["a 429", () => fetchMock.mockResolvedValue(httpError(429, "Too Many Requests"))],
		["a 500", () => fetchMock.mockResolvedValue(httpError(500, "Server Error"))],
		["a network error", () => fetchMock.mockRejectedValue(new Error("ECONNRESET"))],
		[
			"a timeout",
			() =>
				fetchMock.mockRejectedValue(
					Object.assign(new Error("aborted"), { name: "AbortError" }),
				),
		],
		[
			"a 200 page without player info",
			() => fetchMock.mockResolvedValue(page("<html>Rate limited</html>")),
		],
	])("serves the stale entry when the refresh fails with %s", async (_label, failFetch) => {
		stubCache(expired());
		failFetch();

		const res = await call();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(res.statusCode).toBe(200);
		expect(body(res).data).toEqual(OLD_STATS);
		const [item] = puts();
		expect(item.stats).toEqual(OLD_STATS);
		expect(item.freshUntil).toBe(nowS + FAILURE_BACKOFF_SECONDS);
		expect(item.ttl).toBe(nowS + FAILURE_BACKOFF_SECONDS + RETAIN_SECONDS);
		expect(putInputs()[0].ConditionExpression).toBe("#ttl = :seenTtl");
		expect(putInputs()[0].ExpressionAttributeValues[":seenTtl"]).toBe(nowS + 1000);
	});

	it.each([
		["a fetch 500", () => fetchMock.mockResolvedValue(httpError(500, "Server Error"))],
		[
			"a 200 page without player info",
			() => fetchMock.mockResolvedValue(page("<html>Rate limited</html>")),
		],
	])(
		"returns 502 and caches the failure briefly when there is nothing stale (%s)",
		async (_label, failFetch) => {
			stubCache(undefined);
			failFetch();

			const res = await call();

			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(res.statusCode).toBe(502);
			expect(puts()).toEqual([
				{
					PK: "PLAYERSTATS",
					SK: "jamesle01",
					stats: [],
					failed: true,
					freshUntil: nowS + FAILURE_BACKOFF_SECONDS,
					ttl: nowS + FAILURE_BACKOFF_SECONDS,
				},
			]);
			expect(putInputs()[0].ConditionExpression).toBe("attribute_not_exists(PK)");
		},
	);

	it("answers from a fresh failure marker without scraping", async () => {
		stubCache(
			cacheItem({ stats: [], failed: true, freshUntil: nowS + 60, ttl: nowS + 60 }),
		);

		const res = await call();

		expect(res.statusCode).toBe(502);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("does not serve an expired failure marker as stale data", async () => {
		stubCache(cacheItem({ stats: [], failed: true, freshUntil: nowS - 1, ttl: nowS - 1 }));
		fetchMock.mockResolvedValue(httpError(500, "Server Error"));

		const res = await call();

		expect(res.statusCode).toBe(502);
		expect(puts()[0].failed).toBe(true);
		expect(putInputs()[0].ConditionExpression).toBe("#ttl = :seenTtl");
	});

	it("treats a lost conditional write as a concurrent refresh", async () => {
		stubCache(
			undefined,
			Object.assign(new Error("cond"), { name: "ConditionalCheckFailedException" }),
		);
		fetchMock.mockResolvedValue(httpError(500, "Server Error"));

		const res = await call();

		expect(res.statusCode).toBe(502);
		expect(errorSpy).not.toHaveBeenCalledWith("Failed to cache player stats", expect.anything());
	});

	it.each([
		["a page with no stats table", () => fetchMock.mockResolvedValue(page(EMPTY_PLAYER_PAGE))],
		["a 404", () => fetchMock.mockResolvedValue(httpError(404, "Not Found"))],
	])("keeps cached seasons when the refresh finds none (%s)", async (_label, emptyFetch) => {
		stubCache(expired());
		emptyFetch();

		const res = await call();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(res.statusCode).toBe(200);
		expect(body(res).data).toEqual(OLD_STATS);
		const [item] = puts();
		expect(item.stats).toEqual(OLD_STATS);
		expect(item.freshUntil).toBe(nowS + FAILURE_BACKOFF_SECONDS);
		expect(item.ttl).toBe(nowS + FAILURE_BACKOFF_SECONDS + RETAIN_SECONDS);
		expect(putInputs()[0].ConditionExpression).toBe("#ttl = :seenTtl");
		expect(putInputs()[0].ExpressionAttributeValues[":seenTtl"]).toBe(nowS + 1000);
	});
});
