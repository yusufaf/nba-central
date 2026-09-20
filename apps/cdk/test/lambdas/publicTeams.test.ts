import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn();

vi.mock("@aws-sdk/lib-dynamodb", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/lib-dynamodb")>();
	return {
		...actual,
		DynamoDBDocumentClient: { from: () => ({ send }) },
	};
});

vi.mock("@aws-sdk/client-dynamodb", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-dynamodb")>();
	return { ...actual, DynamoDBClient: vi.fn() };
});

const s3Send = vi.fn();
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
	// vitest 4's mock functions can't call an arrow-function implementation
	// with `new` ("is not a constructor") — a plain function expression is
	// required to double as a constructor mock.
	return { ...actual, S3Client: vi.fn(function () { return { send: s3Send }; }) };
});

const { handler: getPublicTeamHandler } = await import(
	"lambdas/getPublicTeam/src/getPublicTeam"
);

process.env.assetsBucket = "team-builder-test-assets";
process.env.assetsCdnDomain = "cdn.example";
const { handler: publishTeamHandler } = await import("lambdas/publishTeam/src/publishTeam");

const parseBody = (result: any) => JSON.parse(result.body);

const anonymousEvent = (teamUUID?: string) => ({
	requestContext: {},
	pathParameters: teamUUID ? { teamUUID } : {},
	body: null,
});

const storedPublicTeam = {
	PK: "userUUID#owner",
	SK: "team#t1",
	PK2: "team#t1",
	SK2: "public",
	teamUUID: "t1",
	userUUID: "owner",
	username: "yusuf",
	title: "Sharers",
	favorited: true,
	label: "secret",
	lastViewed: 1,
	public: true,
	cardUrl: "https://cdn.example/cards/t1/1.png",
	roster: [],
};

beforeEach(() => {
	send.mockReset();
	s3Send.mockReset();
});

describe("getPublicTeam", () => {
	it("400s without a teamUUID", async () => {
		const result: any = await getPublicTeamHandler(anonymousEvent(), {} as any, {} as any);
		expect(result.statusCode).toBe(400);
		expect(send).not.toHaveBeenCalled();
	});

	it("queries the PK2 index for the public row only", async () => {
		send.mockResolvedValueOnce({ Items: [storedPublicTeam] });
		await getPublicTeamHandler(anonymousEvent("t1"), {} as any, {} as any);
		const input = send.mock.calls[0][0].input;
		expect(input.IndexName).toBe("PK2");
		expect(input.KeyConditionExpression).toBe("PK2 = :pk2 AND SK2 = :sk2");
		expect(input.ExpressionAttributeValues).toEqual({ ":pk2": "team#t1", ":sk2": "public" });
	});

	it("returns the team without keys or owner-only fields", async () => {
		send.mockResolvedValueOnce({ Items: [storedPublicTeam] });
		const result: any = await getPublicTeamHandler(anonymousEvent("t1"), {} as any, {} as any);
		expect(result.statusCode).toBe(200);
		expect(result.headers["cache-control"]).toBe("no-cache");
		const { data } = parseBody(result);
		expect(data.username).toBe("yusuf");
		expect(data.cardUrl).toBe(storedPublicTeam.cardUrl);
		for (const key of ["PK", "SK", "PK2", "SK2", "userUUID", "favorited", "label", "lastViewed"]) {
			expect(data).not.toHaveProperty(key);
		}
	});

	it("404s when nothing public matches", async () => {
		send.mockResolvedValueOnce({ Items: [] });
		const result: any = await getPublicTeamHandler(anonymousEvent("nope"), {} as any, {} as any);
		expect(result.statusCode).toBe(404);
		expect(parseBody(result)).toEqual({ success: false, error: "Team not found" });
	});
});

// 1x1 transparent PNG — enough to pass the magic-bytes check.
const TINY_PNG_B64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const ownerEvent = (body: Record<string, unknown>) => ({
	requestContext: { authorizer: { lambda: { sub: "owner", username: "yusuf" } } },
	pathParameters: {},
	body: JSON.stringify(body),
});

process.env.webBucket = "team-builder-test-web";
process.env.siteUrl = "https://nba.example";
const { handler: pageHandler, __resetShellCache } = await import(
	"lambdas/getPublicTeamPage/src/getPublicTeamPage"
);

const SHELL = "<html><head><title>NBA Team Builder</title></head><body><div id=app></div></body></html>";
const shellObject = () => ({ Body: { transformToString: async () => SHELL } });

describe("getPublicTeamPage", () => {
	beforeEach(() => __resetShellCache());

	it("serves the shell with OG tags for a public team", async () => {
		send.mockResolvedValueOnce({ Items: [storedPublicTeam] });
		s3Send.mockResolvedValueOnce(shellObject());
		const result: any = await pageHandler(anonymousEvent("t1"), {} as any, {} as any);
		expect(result.statusCode).toBe(200);
		expect(result.headers["content-type"]).toBe("text/html; charset=utf-8");
		expect(result.body).toContain('property="og:title" content="Sharers"');
		expect(result.body).toContain("<title>Sharers — NBA Team Builder</title>");
		expect(s3Send.mock.calls[0][0].input).toEqual({ Bucket: "team-builder-test-web", Key: "index.html" });
	});

	it("serves the untouched shell when the team is not public", async () => {
		send.mockResolvedValueOnce({ Items: [] });
		s3Send.mockResolvedValueOnce(shellObject());
		const result: any = await pageHandler(anonymousEvent("nope"), {} as any, {} as any);
		expect(result.statusCode).toBe(200);
		expect(result.body).toBe(SHELL);
	});

	it("reuses the cached shell across invocations", async () => {
		send.mockResolvedValue({ Items: [] });
		s3Send.mockResolvedValueOnce(shellObject());
		await pageHandler(anonymousEvent("a"), {} as any, {} as any);
		await pageHandler(anonymousEvent("b"), {} as any, {} as any);
		expect(s3Send).toHaveBeenCalledTimes(1);
	});

	it("500s plainly when the shell cannot be read", async () => {
		send.mockResolvedValueOnce({ Items: [storedPublicTeam] });
		s3Send.mockRejectedValueOnce(new Error("NoSuchKey"));
		const result: any = await pageHandler(anonymousEvent("t1"), {} as any, {} as any);
		expect(result.statusCode).toBe(500);
		expect(result.headers["content-type"]).toBe("text/plain; charset=utf-8");
	});

	it("500s plainly, without caching, when the shell body is empty", async () => {
		send.mockResolvedValueOnce({ Items: [storedPublicTeam] });
		s3Send.mockResolvedValueOnce({ Body: { transformToString: async () => "" } });
		const result: any = await pageHandler(anonymousEvent("t1"), {} as any, {} as any);
		expect(result.statusCode).toBe(500);
		expect(result.headers["content-type"]).toBe("text/plain; charset=utf-8");

		send.mockResolvedValueOnce({ Items: [storedPublicTeam] });
		s3Send.mockResolvedValueOnce(shellObject());
		await pageHandler(anonymousEvent("t1"), {} as any, {} as any);
		expect(s3Send).toHaveBeenCalledTimes(2);
	});
});

describe("publishTeam", () => {
	it("400s on a malformed payload", async () => {
		const result: any = await publishTeamHandler(
			ownerEvent({ teamUUID: "t1", public: "yes" }),
			{} as any,
			{} as any,
		);
		expect(result.statusCode).toBe(400);
		expect(send).not.toHaveBeenCalled();
	});

	it("404s before uploading when the caller does not own the team", async () => {
		send.mockResolvedValueOnce({}); // GetCommand: no Item
		const result: any = await publishTeamHandler(
			ownerEvent({ teamUUID: "t1", public: true, cardPng: TINY_PNG_B64 }),
			{} as any,
			{} as any,
		);
		expect(result.statusCode).toBe(404);
		expect(s3Send).not.toHaveBeenCalled();
		expect(send).toHaveBeenCalledTimes(1);
	});

	it("uploads the card to the assets bucket and flips SK2 to public", async () => {
		send.mockResolvedValueOnce({ Item: { teamUUID: "t1" } }); // ownership
		s3Send.mockResolvedValueOnce({});
		send.mockResolvedValueOnce({
			Attributes: { PK: "x", SK: "y", teamUUID: "t1", public: true, cardUrl: "u" },
		});

		const result: any = await publishTeamHandler(
			ownerEvent({ teamUUID: "t1", public: true, cardPng: TINY_PNG_B64 }),
			{} as any,
			{} as any,
		);

		expect(result.statusCode).toBe(200);
		const put = s3Send.mock.calls[0][0].input;
		expect(put.Bucket).toBe("team-builder-test-assets");
		expect(put.Key).toMatch(/^cards\/t1\/\d+\.png$/);
		expect(put.ContentType).toBe("image/png");
		expect(put.CacheControl).toContain("immutable");

		const update = send.mock.calls[1][0].input;
		expect(update.Key).toEqual({ PK: "userUUID#owner", SK: "team#t1" });
		expect(update.ExpressionAttributeNames["#pub"]).toBe("public");
		expect(update.ExpressionAttributeValues[":sk2"]).toBe("public");
		expect(update.ExpressionAttributeValues[":pk2"]).toBe("team#t1");
		expect(update.ExpressionAttributeValues[":cardUrl"]).toBe(`https://cdn.example/${put.Key}`);
		expect(update.UpdateExpression).toContain("publishedAt = if_not_exists(publishedAt, :now)");
		expect(update.ConditionExpression).toBe("attribute_exists(PK) AND attribute_exists(SK)");

		const body = parseBody(result);
		expect(body.data.PK).toBeUndefined();
	});

	it("rejects a card that is not a PNG", async () => {
		send.mockResolvedValueOnce({ Item: { teamUUID: "t1" } });
		const result: any = await publishTeamHandler(
			ownerEvent({ teamUUID: "t1", public: true, cardPng: Buffer.from("GIF89a").toString("base64") }),
			{} as any,
			{} as any,
		);
		expect(result.statusCode).toBe(400);
		expect(s3Send).not.toHaveBeenCalled();
	});

	it("unpublishes without touching S3 or cardUrl", async () => {
		send.mockResolvedValueOnce({ Item: { teamUUID: "t1" } });
		send.mockResolvedValueOnce({ Attributes: { teamUUID: "t1", public: false } });
		const result: any = await publishTeamHandler(
			ownerEvent({ teamUUID: "t1", public: false }),
			{} as any,
			{} as any,
		);
		expect(result.statusCode).toBe(200);
		expect(s3Send).not.toHaveBeenCalled();
		const update = send.mock.calls[1][0].input;
		expect(update.ExpressionAttributeValues[":sk2"]).toBe("private");
		expect(update.UpdateExpression).not.toContain("cardUrl");
	});
});
