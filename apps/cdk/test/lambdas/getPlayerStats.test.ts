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

// Kept so the spike test can prove it is never called.
const fetchMock = vi.fn();
vi.mock("node-fetch", () => ({ default: fetchMock }));

process.env.MAIN_TABLE_NAME = "main-table";
process.env.staticDataBucket = "static";

const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
const { handler } = await import("lambdas/getPlayerStats/src/getPlayerStats");

const nowS = Math.floor(Date.now() / 1000);
const STATS = [{ season: 2025, pts: 25 }, { season: 2024, pts: 27 }];

const call = async (playerId: string) => {
	const res = await handler(
		{ queryStringParameters: { playerId } } as any,
		{} as any,
		() => {},
	);
	return { status: res.statusCode, body: JSON.parse(res.body) };
};

const stubItem = (item?: Record<string, unknown>) =>
	send.mockImplementation(async () => ({ Item: item }));

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	s3Send.mockImplementation(async () => ({
		Body: {
			transformToString: async () =>
				JSON.stringify({
					gameVersion: "2K27",
					data: { jamesle01: { rating: 97, ratingSource: "current" } },
				}),
		},
	}));
});

afterEach(() => {
	vi.restoreAllMocks();
	send.mockReset();
	fetchMock.mockReset();
});

describe("getPlayerStats", () => {
	it("serves the snapshot career", async () => {
		stubItem({ PK: "PLAYERSTATS", SK: "jamesle01", stats: STATS, scrapedAt: nowS, checkedAt: nowS });

		const { status, body } = await call("jamesle01");

		expect(status).toBe(200);
		expect(body).toMatchObject({
			data: STATS,
			available: true,
			rating: 97,
			ratingSource: "current",
			gameVersion: "2K27",
		});
		expect(send.mock.calls[0][0].input).toEqual({
			TableName: "main-table",
			Key: { PK: "PLAYERSTATS", SK: "jamesle01" },
		});
	});

	it("serves a legacy cache item whatever its age", async () => {
		stubItem({ PK: "PLAYERSTATS", SK: "jamesle01", stats: STATS, freshUntil: nowS - 10_000, ttl: nowS - 1 });

		const { body } = await call("jamesle01");

		expect(body).toMatchObject({ data: STATS, available: true });
	});

	it("serves an empty career as available", async () => {
		stubItem({ PK: "PLAYERSTATS", SK: "jamesle01", stats: [], checkedAt: nowS });

		const { body } = await call("jamesle01");

		expect(body).toMatchObject({ data: [], available: true });
	});

	it.each([
		["a missing item", undefined],
		["a legacy failure marker", { PK: "PLAYERSTATS", SK: "jamesle01", stats: [], failed: true, ttl: nowS }],
		["a failure-only item", { PK: "PLAYERSTATS", SK: "jamesle01", checkedAt: nowS, lastError: "BBRef returned 500" }],
	])("answers not available for %s", async (_label, item) => {
		stubItem(item);

		const { status, body } = await call("jamesle01");

		expect(status).toBe(200);
		expect(body).toMatchObject({ data: [], available: false, rating: 97 });
	});

	it("never calls upstream or writes under a spike", async () => {
		const globalFetch = vi.spyOn(globalThis, "fetch");
		const items: Record<string, Record<string, unknown> | undefined> = {
			snap: { stats: STATS, scrapedAt: nowS, checkedAt: nowS },
			legacy: { stats: STATS, freshUntil: nowS - 10_000, ttl: nowS - 1 },
			empty: { stats: [], checkedAt: nowS },
			marker: { stats: [], failed: true, ttl: nowS },
			failure: { checkedAt: nowS, lastError: "BBRef returned 500" },
			missing: undefined,
		};
		send.mockImplementation(async (cmd: any) => ({ Item: items[cmd.input.Key.SK] }));
		const ids = Object.keys(items);

		const results = await Promise.all(
			Array.from({ length: 50 }, (_, i) => call(ids[i % ids.length])),
		);

		expect(results.every((r) => r.status === 200)).toBe(true);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(globalFetch).not.toHaveBeenCalled();
		expect(send).toHaveBeenCalledTimes(50);
		expect(send.mock.calls.every(([cmd]) => cmd instanceof GetCommand)).toBe(true);
	});

	it("rejects an invalid playerId", async () => {
		const { status } = await call("../x");

		expect(status).toBe(400);
		expect(send).not.toHaveBeenCalled();
	});

	it("returns 500 when the snapshot read fails", async () => {
		send.mockRejectedValue(new Error("throttled"));

		const { status } = await call("jamesle01");

		expect(status).toBe(500);
	});
});
