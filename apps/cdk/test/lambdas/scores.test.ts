import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Context, Handler } from "aws-lambda";
import { ESPN_USER_AGENT } from "../../resources/espn";

process.env.ESPN_API_BASE_URL = "https://espn.test/nba";

// 18:00 ET on Oct 27, 2026.
const NOW = Date.parse("2026-10-27T22:00:00Z");

const fetchMock = vi.fn();

type Result = APIGatewayProxyStructuredResultV2 & { body?: string; headers: Record<string, string> };

let getScoreboardDay: Handler;
let getScoreboardMonth: Handler;
let getGameSummary: Handler;

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ["Date"], now: NOW });
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
	vi.resetModules();
	({ handler: getScoreboardDay } = await import("lambdas/getScoreboardDay/src/getScoreboardDay"));
	({ handler: getScoreboardMonth } = await import("lambdas/getScoreboardMonth/src/getScoreboardMonth"));
	({ handler: getGameSummary } = await import("lambdas/getGameSummary/src/getGameSummary"));
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

const invoke = (handler: Handler, pathParameters: Record<string, string>, method = "GET") =>
	handler(
		{
			pathParameters,
			requestContext: { http: { method } } as APIGatewayProxyEventV2["requestContext"],
		} as APIGatewayProxyEventV2,
		{} as Context,
		() => {},
	) as Promise<Result>;

const espnReturns = (body: unknown, status = 200) => {
	const text = typeof body === "string" ? body : JSON.stringify(body);
	fetchMock.mockResolvedValue(new Response(text, { status }));
	return text;
};

const scoreboard = (...games: { state: string; date: string }[]) => ({
	events: games.map(({ state, date }) => ({
		date,
		competitions: [{ status: { type: { state } } }],
	})),
});

const requestedUrl = () => fetchMock.mock.calls[0][0] as string;
const requestedHeaders = () => (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;

describe("getScoreboardDay", () => {
	it("passes ESPN's body through and caches a live day for 10 s", async () => {
		const text = espnReturns(scoreboard({ state: "in", date: "2026-10-27T21:30Z" }));
		const result = await invoke(getScoreboardDay, { date: "20261027" });

		expect(result.statusCode).toBe(200);
		expect(result.body).toBe(text);
		expect(result.headers["cache-control"]).toBe("public, max-age=10, stale-if-error=3600");
		expect(requestedUrl()).toBe("https://espn.test/nba/scoreboard?dates=20261027");
		expect(requestedHeaders()["User-Agent"]).toBe(ESPN_USER_AGENT);
	});

	it("caches a finished past day for a day", async () => {
		espnReturns(scoreboard({ state: "post", date: "2026-10-26T23:00Z" }));
		const result = await invoke(getScoreboardDay, { date: "20261026" });
		expect(result.headers["cache-control"]).toBe("public, max-age=86400, stale-if-error=3600");
	});

	it("refuses a malformed date without calling ESPN", async () => {
		const result = await invoke(getScoreboardDay, { date: "2026-10-26" });
		expect(result.statusCode).toBe(400);
		expect(result.headers["cache-control"]).toBe("no-store");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("answers HEAD uncacheable without calling ESPN", async () => {
		const result = await invoke(getScoreboardDay, { date: "20261027" }, "HEAD");
		expect(result.statusCode).toBe(200);
		expect(result.headers["cache-control"]).toBe("no-store");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it.each<[string, () => void]>([
		["ESPN fails", () => espnReturns("oops", 500)],
		["the request times out", () => fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"))],
		["ESPN sends another shape", () => espnReturns({})],
		["ESPN sends invalid JSON", () => espnReturns("<html>")],
	])("answers 502 no-store when %s", async (_, arrange) => {
		arrange();
		const result = await invoke(getScoreboardDay, { date: "20261027" });
		expect(result.statusCode).toBe(502);
		expect(result.headers["cache-control"]).toBe("no-store");
	});
});

describe("getScoreboardMonth", () => {
	it("returns only the parseable game dates", async () => {
		espnReturns({
			events: [
				{ date: "2026-10-21T23:30Z", competitions: [{ big: "x".repeat(100) }] },
				{ date: "not a date" },
				{ name: "no date" },
			],
		});
		const result = await invoke(getScoreboardMonth, { month: "202610" });

		expect(result.statusCode).toBe(200);
		expect(JSON.parse(result.body!)).toEqual({ events: [{ date: "2026-10-21T23:30Z" }] });
		expect(result.headers["cache-control"]).toBe("public, max-age=3600, stale-if-error=3600");
		expect(requestedUrl()).toBe("https://espn.test/nba/scoreboard?dates=202610&limit=1000");
	});

	it("caches a past month for a day", async () => {
		espnReturns({ events: [{ date: "2026-03-01T20:00Z" }] });
		const result = await invoke(getScoreboardMonth, { month: "202603" });
		expect(result.headers["cache-control"]).toBe("public, max-age=86400, stale-if-error=3600");
	});

	it("caches an empty past month for an hour only", async () => {
		espnReturns({ events: [] });
		const result = await invoke(getScoreboardMonth, { month: "202603" });
		expect(result.headers["cache-control"]).toBe("public, max-age=3600, stale-if-error=3600");
	});

	it("refuses a bad month without calling ESPN", async () => {
		const result = await invoke(getScoreboardMonth, { month: "202613" });
		expect(result.statusCode).toBe(400);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("getGameSummary", () => {
	const liveSummary = {
		header: { competitions: [{ date: "2026-10-27T21:30Z", status: { type: { state: "in" } } }] },
		plays: [1],
		winprobability: [1],
	};

	it("passes plays and winprobability through and caches a live game for 10 s", async () => {
		const text = espnReturns(liveSummary);
		const result = await invoke(getGameSummary, { gameId: "401859965" });

		expect(result.statusCode).toBe(200);
		expect(result.body).toBe(text);
		expect(JSON.parse(result.body!)).toMatchObject({ plays: [1], winprobability: [1] });
		expect(result.headers["cache-control"]).toBe("public, max-age=10, stale-if-error=3600");
		expect(requestedUrl()).toBe("https://espn.test/nba/summary?event=401859965");
	});

	it("caches a game final since yesterday for a day", async () => {
		espnReturns({
			header: { competitions: [{ date: "2026-10-26T23:00Z", status: { type: { state: "post" } } }] },
		});
		const result = await invoke(getGameSummary, { gameId: "401859965" });
		expect(result.headers["cache-control"]).toBe("public, max-age=86400, stale-if-error=3600");
	});

	it("turns ESPN's 404 into a briefly cached 410", async () => {
		espnReturns({ code: 404 }, 404);
		const result = await invoke(getGameSummary, { gameId: "999999999" });
		expect(result.statusCode).toBe(410);
		expect(result.headers["cache-control"]).toBe("public, max-age=60, stale-if-error=3600");
	});

	it("refuses a non-numeric id without calling ESPN", async () => {
		const result = await invoke(getGameSummary, { gameId: "abc" });
		expect(result.statusCode).toBe(400);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("answers 502 when ESPN sends no header", async () => {
		espnReturns({ boxscore: {} });
		const result = await invoke(getGameSummary, { gameId: "401859965" });
		expect(result.statusCode).toBe(502);
	});

	// The distribution swaps a 403/404 for index.html.
	it.each<[string, () => void, Record<string, string>]>([
		["bad id", () => {}, { gameId: "x" }],
		["ESPN 404", () => espnReturns({}, 404), { gameId: "401859965" }],
		["ESPN 403", () => espnReturns({}, 403), { gameId: "401859965" }],
		["ESPN 500", () => espnReturns({}, 500), { gameId: "401859965" }],
	])("never answers 403 or 404 (%s)", async (_, arrange, params) => {
		arrange();
		const { statusCode } = await invoke(getGameSummary, params);
		expect([403, 404]).not.toContain(statusCode);
	});
});
