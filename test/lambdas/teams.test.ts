import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn();

vi.mock("@aws-sdk/lib-dynamodb", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/lib-dynamodb")>();
	return {
		...actual,
		DynamoDBDocumentClient: {
			from: () => ({ send }),
		},
	};
});

vi.mock("@aws-sdk/client-dynamodb", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-dynamodb")>();
	return { ...actual, DynamoDBClient: vi.fn() };
});

const { handler: listTeamsHandler } = await import("lambdas/listTeams/src/listTeams");
const { handler: getTeamHandler } = await import("lambdas/getTeam/src/getTeam");
const { handler: updateTeamHandler } = await import("lambdas/updateTeam/src/updateTeam");
const { handler: deleteTeamHandler } = await import("lambdas/deleteTeam/src/deleteTeam");

const authorizerEvent = (overrides: Record<string, any> = {}) => ({
	requestContext: {
		authorizer: {
			lambda: { sub: "user-1", username: "someone" },
		},
	},
	pathParameters: {},
	body: null,
	...overrides,
});

const parseBody = (result: any) => JSON.parse(result.body);

beforeEach(() => {
	send.mockReset();
});

describe("listTeams", () => {
	it("scopes the query to the caller's PK and returns card fields", async () => {
		const items = [
			{ teamUUID: "t1", title: "Team One", playerCount: 5 },
			{ teamUUID: "t2", title: "Team Two", playerCount: 3 },
		];
		send.mockResolvedValueOnce({ Items: items });

		const result: any = await listTeamsHandler(authorizerEvent(), {} as any, {} as any);

		expect(send).toHaveBeenCalledTimes(1);
		const command = send.mock.calls[0][0];
		expect(command.input.ExpressionAttributeValues[":pk"]).toBe("userUUID#user-1");
		expect(command.input.ExpressionAttributeValues[":sk"]).toBe("team#");
		expect(command.input.ProjectionExpression).not.toContain("roster");

		expect(result.statusCode).toBe(200);
		const body = parseBody(result);
		expect(body).toEqual({ success: true, data: { teams: items } });
	});

	it("returns an empty list rather than querying when unauthenticated", async () => {
		const event = authorizerEvent();
		delete (event as any).requestContext.authorizer.lambda;

		const result: any = await listTeamsHandler(event, {} as any, {} as any);

		expect(send).not.toHaveBeenCalled();
		expect(parseBody(result)).toEqual({ success: true, data: { teams: [] } });
	});
});

describe("getTeam", () => {
	it("404s when the team doesn't exist or isn't owned by the caller", async () => {
		const err = new Error("conditional check failed");
		err.name = "ConditionalCheckFailedException";
		send.mockRejectedValueOnce(err);

		const result: any = await getTeamHandler(
			authorizerEvent({ pathParameters: { teamUUID: "missing" } }),
			{} as any,
			{} as any,
		);

		expect(result.statusCode).toBe(404);
		expect(parseBody(result).success).toBe(false);
	});

	it("bumps lastViewed and returns the team on success", async () => {
		send.mockResolvedValueOnce({
			Attributes: { PK: "x", SK: "y", teamUUID: "t1", title: "Team One" },
		});

		const result: any = await getTeamHandler(
			authorizerEvent({ pathParameters: { teamUUID: "t1" } }),
			{} as any,
			{} as any,
		);

		const command = send.mock.calls[0][0];
		expect(command.input.UpdateExpression).toContain("lastViewed");

		expect(result.statusCode).toBe(200);
		const body = parseBody(result);
		expect(body.success).toBe(true);
		expect(body.data).not.toHaveProperty("PK");
		expect(body.data).not.toHaveProperty("SK");
		expect(body.data.teamUUID).toBe("t1");
	});
});

describe("updateTeam", () => {
	it("rejects a payload missing teamUUID with 400", async () => {
		const result: any = await updateTeamHandler(
			authorizerEvent({ body: JSON.stringify({ title: "No UUID", roster: [] }) }),
			{} as any,
			{} as any,
		);

		expect(send).not.toHaveBeenCalled();
		expect(result.statusCode).toBe(400);
	});

	it("rejects a non-string teamUUID with 400 rather than a misleading 404", async () => {
		const result: any = await updateTeamHandler(
			authorizerEvent({
				body: JSON.stringify({ teamUUID: 12345, title: "Bad UUID type", roster: [] }),
			}),
			{} as any,
			{} as any,
		);

		expect(send).not.toHaveBeenCalled();
		expect(result.statusCode).toBe(400);
	});

	it("rejects a non-finite roster slot", async () => {
		const result: any = await updateTeamHandler(
			authorizerEvent({
				body: JSON.stringify({
					teamUUID: "t1",
					title: "Bad slot",
					roster: [{ slot: Infinity, player: { fullName: "X" } }],
				}),
			}),
			{} as any,
			{} as any,
		);

		expect(send).not.toHaveBeenCalled();
		expect(result.statusCode).toBe(400);
	});

	it("replaces the mutable fields on a valid payload", async () => {
		send.mockResolvedValueOnce({
			Attributes: { teamUUID: "t1", title: "Renamed", roster: [] },
		});

		const payload = {
			teamUUID: "t1",
			title: "Renamed",
			roster: [],
			coach: null,
			gm: null,
			arena: null,
		};

		const result: any = await updateTeamHandler(
			authorizerEvent({ body: JSON.stringify(payload) }),
			{} as any,
			{} as any,
		);

		expect(result.statusCode).toBe(200);
		const command = send.mock.calls[0][0];
		expect(command.input.Key).toEqual({ PK: "userUUID#user-1", SK: "team#t1" });
	});
});

describe("deleteTeam", () => {
	it("maps a failed ownership condition to 404, not 500", async () => {
		const err = new Error("conditional check failed");
		err.name = "ConditionalCheckFailedException";
		send.mockRejectedValueOnce(err);

		const result: any = await deleteTeamHandler(
			authorizerEvent({ pathParameters: { teamUUID: "t1" } }),
			{} as any,
			{} as any,
		);

		expect(result.statusCode).toBe(404);
		expect(parseBody(result).success).toBe(false);
	});

	it("deletes successfully", async () => {
		send.mockResolvedValueOnce({});

		const result: any = await deleteTeamHandler(
			authorizerEvent({ pathParameters: { teamUUID: "t1" } }),
			{} as any,
			{} as any,
		);

		expect(result.statusCode).toBe(200);
		expect(parseBody(result)).toEqual({ success: true, data: undefined });
	});
});
