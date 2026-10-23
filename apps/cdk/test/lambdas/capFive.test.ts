import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Context } from "aws-lambda";
import { CAP_FIVE_FIRST_DATE, type CapFivePuzzle } from "../../models/cap-five";
import { buildCapFivePuzzle, eligiblePlayers, publishDates } from "../../utilities/cap-five";
import { DAY_MS, formatIsoDate, parseIsoDate } from "../../utilities/daily-era";

const s3Send = vi.fn();
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
	return { ...actual, S3Client: vi.fn(function () { return { send: s3Send }; }) };
});

process.env.staticDataBucket = "team-builder-test-static-data";

const firstDay = parseIsoDate(CAP_FIVE_FIRST_DATE)!;
const dateOf = (k: number) => formatIsoDate(firstDay + k);
// Puzzle #3's day, noon UTC: the window runs to firstDay + 3.
const NOW = (firstDay + 2) * DAY_MS + 12 * 3_600_000;

// 400 players, 100 per band, so the publisher's broken-file guard passes.
const BAND_MINS = [90, 80, 70, 65];
const players = BAND_MINS.flatMap((min, b) =>
	Array.from({ length: 100 }, (_, i) => ({ id: `p${b}${String(i).padStart(3, "0")}`, first_name: `F${i}`, last_name: `B${b}L${i}` })),
);
const ratingsData = Object.fromEntries(
	players.map((p, n) => [
		p.id,
		{ rating: BAND_MINS[Math.floor(n / 100)] + (n % 5), ratingSource: n % 2 ? "current" : "all-time", positions: ["SF"] },
	]),
);
const meta = { gameVersion: "2K27", ratingsGenerated: "2026-10-17T00:00:00.000Z" };
const puzzle: CapFivePuzzle = buildCapFivePuzzle(dateOf(2), eligiblePlayers(players, ratingsData), meta);

const objectBody = (value: unknown) => ({ Body: { transformToString: async () => JSON.stringify(value) } });
const s3Error = (name: string) => Object.assign(new Error(name), { name });

let getCapFive: (typeof import("lambdas/getCapFive/src/getCapFive"))["handler"];
let submitCapFive: (typeof import("lambdas/submitCapFive/src/submitCapFive"))["handler"];
let publishCapFive: (typeof import("lambdas/publishCapFive/src/publishCapFive"))["handler"];

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ["Date"], now: NOW });
	s3Send.mockReset();
	s3Send.mockResolvedValue(objectBody(puzzle));
	// Fresh modules each test, so the puzzle cache never leaks between them.
	vi.resetModules();
	({ handler: getCapFive } = await import("lambdas/getCapFive/src/getCapFive"));
	({ handler: submitCapFive } = await import("lambdas/submitCapFive/src/submitCapFive"));
	({ handler: publishCapFive } = await import("lambdas/publishCapFive/src/publishCapFive"));
});

afterEach(() => {
	vi.useRealTimers();
});

type Result = APIGatewayProxyStructuredResultV2 & { body: string; headers: Record<string, string> };

const invoke = (handler: typeof getCapFive, event: Partial<APIGatewayProxyEventV2>) =>
	handler(event as APIGatewayProxyEventV2, {} as Context, () => {}) as Promise<Result>;

const get = (date?: string, method = "GET") =>
	invoke(getCapFive, {
		pathParameters: date === undefined ? {} : { date },
		requestContext: { http: { method } } as APIGatewayProxyEventV2["requestContext"],
	});

const submit = (body: unknown) =>
	invoke(submitCapFive, { body: typeof body === "string" ? body : JSON.stringify(body) });

const parseBody = (result: Result) => JSON.parse(result.body);

describe("getCapFive", () => {
	it("returns the day's pool and cap with no rating anywhere", async () => {
		const result = await get(dateOf(2));

		expect(result.statusCode).toBe(200);
		expect(result.headers["cache-control"]).toMatch(/^public, max-age=\d+$/);
		const { success, data } = parseBody(result);
		expect(success).toBe(true);
		expect(data).toMatchObject({ puzzleNumber: 3, date: dateOf(2), cap: puzzle.cap, gameVersion: "2K27" });
		expect(data).not.toHaveProperty("optimal");
		expect(data.candidates).toHaveLength(12);
		for (const candidate of data.candidates) {
			expect(candidate).not.toHaveProperty("rating");
			expect(candidate).not.toHaveProperty("ratingSource");
		}
		for (const secret of ['"rating"', '"ratingSource"', '"optimal"']) expect(result.body).not.toContain(secret);
		expect(s3Send.mock.calls[0][0].input).toMatchObject({ Key: `cap-five/${dateOf(2)}.json` });
	});

	it("never lets CloudFront cache a HEAD", async () => {
		expect((await get(dateOf(2), "HEAD")).headers["cache-control"]).toBe("no-store");
	});

	it.each([
		["junk", "not-a-date", 400],
		["a missing date", undefined, 400],
		["a date past the window", dateOf(4), 410],
		["a date before puzzle #1", dateOf(-1), 410],
	])("refuses %s before reading S3", async (_, date, status) => {
		const result = await get(date);
		expect(result.statusCode).toBe(status);
		expect(result.headers["cache-control"]).toBe("no-store");
		expect(s3Send).not.toHaveBeenCalled();
	});

	it("says 410 for a day that isn't published", async () => {
		s3Send.mockRejectedValue(s3Error("NoSuchKey"));
		const result = await get(dateOf(2));
		expect(result.statusCode).toBe(410);
		expect(result.headers["cache-control"]).toBe("no-store");
	});

	it("says 500 when S3 fails", async () => {
		s3Send.mockRejectedValue(s3Error("InternalError"));
		expect((await get(dateOf(2))).statusCode).toBe(500);
	});

	it("reads a published day once per container", async () => {
		await get(dateOf(2));
		await get(dateOf(2));
		expect(s3Send).toHaveBeenCalledTimes(1);
	});
});

describe("submitCapFive", () => {
	const picks = puzzle.optimal.lineup;

	it("scores a lineup and reveals every rating", async () => {
		const result = await submit({ date: dateOf(2), picks });

		expect(result.statusCode).toBe(200);
		expect(result.headers["cache-control"]).toBe("no-store");
		const { data } = parseBody(result);
		expect(data).toMatchObject({ total: puzzle.cap, busted: false, picks, optimal: puzzle.optimal });
		expect(data.candidates).toEqual(puzzle.candidates);
	});

	it.each([
		["a body that isn't JSON", "nope", 400],
		["picks that aren't an array", { date: dateOf(2), picks: "abc" }, 400],
		["four picks", { date: dateOf(2), picks: picks.slice(0, 4) }, 400],
		["a bad date", { date: "2026-13-01", picks }, 400],
		["a date past the window", { date: dateOf(4), picks }, 410],
	])("refuses %s", async (_, body, status) => {
		expect((await submit(body)).statusCode).toBe(status);
	});

	it("says 410 for a day that isn't published", async () => {
		s3Send.mockRejectedValue(s3Error("NoSuchKey"));
		expect((await submit({ date: dateOf(2), picks })).statusCode).toBe(410);
	});
});

describe("publishCapFive", () => {
	const ratingsFile = { gameVersion: "2K27", generated: meta.ratingsGenerated, data: ratingsData };
	const reads = (ratings: unknown) => (command: { input: { Key: string } }) => {
		if (command.input.Key === "players.json") return Promise.resolve(objectBody({ data: players }));
		if (command.input.Key === "player-ratings.json") return Promise.resolve(objectBody(ratings));
		return Promise.resolve({});
	};
	const puts = () =>
		s3Send.mock.calls.map(([command]) => command.input).filter((input) => input.Key.startsWith("cap-five/"));
	const publish = () => publishCapFive({} as never, {} as Context, () => {});

	it("writes every publish date once, never overwriting", async () => {
		s3Send.mockImplementation(reads(ratingsFile));
		await publish();

		const written = puts();
		expect(written.map((input) => input.Key)).toEqual(publishDates(NOW).map((date) => `cap-five/${date}.json`));
		for (const input of written) expect(input.IfNoneMatch).toBe("*");
		const stored = JSON.parse(written.find((input) => input.Key === `cap-five/${dateOf(2)}.json`)!.Body);
		expect(stored).toEqual(puzzle);
	});

	it("skips a day that is already there", async () => {
		s3Send.mockImplementation((command: { input: { Key: string } }) =>
			command.input.Key === `cap-five/${dateOf(1)}.json`
				? Promise.reject(s3Error("PreconditionFailed"))
				: reads(ratingsFile)(command),
		);
		await expect(publish()).resolves.toBeUndefined();
		expect(puts()).toHaveLength(publishDates(NOW).length);
	});

	it("rethrows any other write failure", async () => {
		s3Send.mockImplementation((command: { input: { Key: string } }) =>
			command.input.Key.startsWith("cap-five/") ? Promise.reject(s3Error("AccessDenied")) : reads(ratingsFile)(command),
		);
		await expect(publish()).rejects.toThrow("AccessDenied");
	});

	it("publishes nothing from a ratings file that looks broken", async () => {
		const few = Object.fromEntries(Object.entries(ratingsData).slice(0, 50));
		s3Send.mockImplementation(reads({ ...ratingsFile, data: few }));
		await expect(publish()).rejects.toThrow(/eligible/);
		expect(puts()).toHaveLength(0);
	});
});
