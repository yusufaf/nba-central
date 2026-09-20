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

const { handler: getPublicTeamHandler } = await import(
	"lambdas/getPublicTeam/src/getPublicTeam"
);

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
