import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Context } from "aws-lambda";
import { DAILY_ERA_FIRST_DATE, type DailyEraPuzzle } from "../../models/daily-era";
import { DAY_MS, formatIsoDate, parseIsoDate } from "../../utilities/daily-era";

const s3Send = vi.fn();
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
	return { ...actual, S3Client: vi.fn(function () { return { send: s3Send }; }) };
});

process.env.staticDataBucket = "team-builder-test-static-data";
process.env.assetsCdnDomain = "cdn.example";

const firstDay = parseIsoDate(DAILY_ERA_FIRST_DATE)!;
const dateOf = (k: number) => formatIsoDate(firstDay + k);
// Puzzle #3's day, noon UTC: the window runs to firstDay + 3.
const NOW = (firstDay + 2) * DAY_MS + 12 * 3_600_000;

const identity = (mediaId: string) => ({
	franchise: "OKC",
	name: "Secret Sonics 1995-1997 Home",
	startYear: 1995,
	mediaId,
});

const entry = (n: number): DailyEraPuzzle => ({
	puzzleId: `opaque${n}`,
	imageKey: `daily-era/image${n}.webp`,
	answerSeasons: [1996],
	runLabel: "1995-96",
	franchise: "OKC",
	teamName: "Secret Sonics",
	identities: [identity(`31d308_secret${n}`)],
	shownIdentity: identity(`31d308_secret${n}`),
});

const fixture = [entry(1), entry(2), entry(3)];

let getDailyEra: (typeof import("lambdas/getDailyEra/src/getDailyEra"))["handler"];
let guessDailyEra: (typeof import("lambdas/guessDailyEra/src/guessDailyEra"))["handler"];

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ["Date"], now: NOW });
	s3Send.mockReset();
	s3Send.mockResolvedValue({ Body: { transformToString: async () => JSON.stringify(fixture) } });
	// Fresh modules each test, so the list cache never leaks between them.
	vi.resetModules();
	({ handler: getDailyEra } = await import("lambdas/getDailyEra/src/getDailyEra"));
	({ handler: guessDailyEra } = await import("lambdas/guessDailyEra/src/guessDailyEra"));
});

afterEach(() => {
	vi.useRealTimers();
});

type Result = APIGatewayProxyStructuredResultV2 & { body: string; headers: Record<string, string> };

const invoke = (handler: typeof getDailyEra, event: Partial<APIGatewayProxyEventV2>) =>
	handler(event as APIGatewayProxyEventV2, {} as Context, () => {}) as Promise<Result>;

const get = (date?: string, method = "GET") =>
	invoke(getDailyEra, {
		pathParameters: date === undefined ? {} : { date },
		requestContext: { http: { method } } as APIGatewayProxyEventV2["requestContext"],
	});

const guess = (body: unknown) =>
	invoke(guessDailyEra, { body: typeof body === "string" ? body : JSON.stringify(body) });

const parseBody = (result: Result) => JSON.parse(result.body);

describe("getDailyEra", () => {
	it("returns the day's puzzle number, id and image URL", async () => {
		const result = await get(dateOf(0));

		expect(result.statusCode).toBe(200);
		const { success, data } = parseBody(result);
		expect(success).toBe(true);
		expect(Object.keys(data).sort()).toEqual(["imageUrl", "puzzleId", "puzzleNumber"]);
		expect(data).toEqual({
			puzzleNumber: 1,
			puzzleId: "opaque1",
			imageUrl: "https://cdn.example/daily-era/image1.webp",
		});
		expect(s3Send.mock.calls[0][0].input).toEqual({
			Bucket: "team-builder-test-static-data",
			Key: "daily-era-puzzles.json",
		});
	});

	it("never sends an answer field or value", async () => {
		const { body } = await get(dateOf(2));

		for (const field of ["answerSeasons", "runLabel", "teamName", "franchise", "identities", "shownIdentity", "mediaId"]) {
			expect(body).not.toContain(field);
		}
		for (const value of ["Secret Sonics", "1995-96", "1996", "31d308_secret", "OKC"]) {
			expect(body).not.toContain(value);
		}
	});

	it("is cacheable for at most an hour", async () => {
		const result = await get(dateOf(2));
		expect(result.headers["cache-control"]).toBe("public, max-age=3600");
		expect(result.headers["content-type"]).toBe("application/json");
	});

	// HEAD has its own route so API Gateway never 404s it (CloudFront would
	// cache index.html under the GET's key), and is never cached itself.
	it("answers HEAD like GET but uncacheable", async () => {
		const result = await get(dateOf(2), "HEAD");
		expect(result.statusCode).toBe(200);
		expect(result.headers["cache-control"]).toBe("no-store");
	});

	it("refuses a malformed date without reading the list", async () => {
		const result = await get("not-a-date");
		expect(result.statusCode).toBe(400);
		expect(result.headers["cache-control"]).toBe("no-store");
		expect(parseBody(result)).toEqual({ success: false, error: "Invalid date" });
		expect(s3Send).not.toHaveBeenCalled();
	});

	it("refuses a missing date", async () => {
		expect((await get()).statusCode).toBe(400);
	});

	it.each([
		["the day before puzzle #1", -1],
		["a playable day past the end of the list", 3],
		["a day outside the window", 5],
	])("returns 410 for %s", async (_, k) => {
		const result = await get(dateOf(k));
		expect(result.statusCode).toBe(410);
		expect(result.headers["cache-control"]).toBe("no-store");
		expect(parseBody(result)).toEqual({ success: false, error: "No playable puzzle for this date" });
	});

	it("returns 500 when the list can't be read", async () => {
		s3Send.mockRejectedValue(new Error("AccessDenied"));
		const result = await get(dateOf(0));
		expect(result.statusCode).toBe(500);
		expect(result.headers["cache-control"]).toBe("no-store");
		expect(parseBody(result)).toEqual({ success: false, error: "Failed to load puzzle" });
	});
});

describe("guessDailyEra", () => {
	it("reveals the answer on a hit", async () => {
		const result = await guess({ puzzleId: "opaque1", season: 1996, attempt: 1 });

		expect(result.statusCode).toBe(200);
		expect(result.headers["cache-control"]).toBe("no-store");
		expect(parseBody(result)).toEqual({
			success: true,
			data: {
				hit: true,
				direction: null,
				band: null,
				answer: {
					runLabel: "1995-96",
					teamName: "Secret Sonics",
					franchise: "OKC",
					shownIdentity: identity("31d308_secret1"),
				},
			},
		});
	});

	it("gives direction and band, and no answer, on an early miss", async () => {
		const result = await guess({ puzzleId: "opaque2", season: 2000, attempt: 1 });

		expect(result.statusCode).toBe(200);
		const { data } = parseBody(result);
		expect(data).toEqual({ hit: false, direction: "earlier", band: "near" });
		expect("answer" in data).toBe(false);
		expect(result.body).not.toContain("Secret Sonics");
	});

	it("reveals the answer once the attempts are used up", async () => {
		const result = await guess({ puzzleId: "opaque3", season: 1985, attempt: 4 });

		const { data } = parseBody(result);
		expect(data).toMatchObject({ hit: false, direction: "later", band: "far" });
		expect(data.answer.teamName).toBe("Secret Sonics");
	});

	it("returns 410 for an unknown puzzle", async () => {
		const result = await guess({ puzzleId: "nope", season: 1996, attempt: 1 });
		expect(result.statusCode).toBe(410);
		expect(result.headers["cache-control"]).toBe("no-store");
		expect(parseBody(result)).toEqual({ success: false, error: "This puzzle is no longer playable" });
	});

	it("returns 410 once the puzzle's day has left the window", async () => {
		vi.setSystemTime((firstDay + 31) * DAY_MS + 12 * 3_600_000);
		const result = await guess({ puzzleId: "opaque1", season: 1996, attempt: 1 });
		expect(result.statusCode).toBe(410);
		expect(result.body).not.toContain("Secret Sonics");
	});

	it.each([
		["attempt 5", { puzzleId: "opaque1", season: 1996, attempt: 5 }],
		["attempt 0", { puzzleId: "opaque1", season: 1996, attempt: 0 }],
		["a fractional attempt", { puzzleId: "opaque1", season: 1996, attempt: 1.5 }],
		["a season before 1947", { puzzleId: "opaque1", season: 1946, attempt: 1 }],
		["a season after the current one", { puzzleId: "opaque1", season: 2028, attempt: 1 }],
		["a fractional season", { puzzleId: "opaque1", season: 1996.5, attempt: 1 }],
		["a missing puzzleId", { season: 1996, attempt: 1 }],
		["a string season", { puzzleId: "opaque1", season: "1996", attempt: 1 }],
		["invalid JSON", "{not json"],
	])("returns 400 for %s", async (_, body) => {
		const result = await guess(body);
		expect(result.statusCode).toBe(400);
		expect(result.headers["cache-control"]).toBe("no-store");
		expect(parseBody(result).success).toBe(false);
		expect(s3Send).not.toHaveBeenCalled();
	});

	it("returns 500 when the list can't be read", async () => {
		s3Send.mockRejectedValue(new Error("AccessDenied"));
		const result = await guess({ puzzleId: "opaque1", season: 1996, attempt: 1 });
		expect(result.statusCode).toBe(500);
		expect(result.headers["cache-control"]).toBe("no-store");
	});
});
