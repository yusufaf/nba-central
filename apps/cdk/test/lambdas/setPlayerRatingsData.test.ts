import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const s3Send = vi.fn();
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
	// A plain function expression, not an arrow: vitest's mock functions can't
	// be called with `new` otherwise (see publicTeams.test.ts).
	return { ...actual, S3Client: vi.fn(function () { return { send: s3Send }; }) };
});

process.env.NBA2K_API_BASE_URL = "https://2k.test";
process.env.staticDataBucket = "static";

const { PutObjectCommand } = await import("@aws-sdk/client-s3");
const { handler } = await import(
	"lambdas/setPlayerRatingsData/src/setPlayerRatingsData"
);

const fetchMock = vi.fn();

// The error alarm counts Lambda Errors, so a failed refresh has to reject
// rather than resolve with a 500 body.
describe("setPlayerRatingsData handler", () => {
	beforeEach(() => {
		s3Send.mockReset();
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
		s3Send.mockResolvedValue({
			Body: { transformToString: async () => JSON.stringify({ data: [] }) },
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("rejects when nba2kapi fails, so Lambda counts the error", async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			status: 503,
			statusText: "Service Unavailable",
		});

		await expect(handler({} as any, {} as any, () => {})).rejects.toThrow(
			"nba2kapi curr returned 503",
		);
		expect(s3Send).not.toHaveBeenCalledWith(expect.any(PutObjectCommand));
	});

	it("rejects when players.json can't be read", async () => {
		s3Send.mockRejectedValue(new Error("NoSuchBucket"));

		await expect(handler({} as any, {} as any, () => {})).rejects.toThrow(
			"NoSuchBucket",
		);
	});
});
