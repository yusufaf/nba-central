import { describe, it, expect, vi, beforeEach } from "vitest";

const s3Send = vi.fn();
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
	return { ...actual, S3Client: vi.fn(function () { return { send: s3Send }; }) };
});

const { handler, parseIds, MAX_IDS } = await import("lambdas/getPlayers/src/getPlayers");

const player = (id: string, first_name: string) => ({
	id,
	first_name,
	last_name: "Test",
	position: "G",
	team: { full_name: "", abbreviation: "" },
	height_feet: 6,
	height_inches: 3,
	weight_pounds: 200,
	active: true,
});

const PLAYERS = [player("jordami01", "Michael"), player("pippesc01", "Scottie"), player("rodmade01", "Dennis")];

beforeEach(() => {
	s3Send.mockReset();
	vi.spyOn(console, "log").mockImplementation(() => {});
	s3Send.mockImplementation(async (cmd: { input: { Key?: string } }) => {
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
