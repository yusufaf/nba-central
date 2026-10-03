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

const s3Send = vi.fn();
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
	// A plain function, not an arrow: it has to work with `new`.
	return { ...actual, S3Client: vi.fn(function () { return { send: s3Send }; }) };
});

const cloudFrontSend = vi.fn();
vi.mock("@aws-sdk/client-cloudfront", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-cloudfront")>();
	return {
		...actual,
		CloudFrontClient: vi.fn(function () { return { send: cloudFrontSend }; }),
	};
});

process.env.assetsBucket = "team-builder-test-assets";
process.env.assetsDistributionId = "EDIST123";

const { handler: listTeamsHandler } = await import("lambdas/listTeams/src/listTeams");
const { handler: getTeamHandler } = await import("lambdas/getTeam/src/getTeam");
const { handler: updateTeamHandler } = await import("lambdas/updateTeam/src/updateTeam");
const { handler: deleteTeamHandler } = await import("lambdas/deleteTeam/src/deleteTeam");
const { handler: createTeamHandler } = await import("lambdas/createTeam/src/createTeam");

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
	s3Send.mockReset();
	cloudFrontSend.mockReset();
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
	const deleteTeam = (teamUUID = "t1") =>
		deleteTeamHandler(
			authorizerEvent({ pathParameters: { teamUUID } }),
			{} as any,
			{} as any,
		) as Promise<any>;

	// Answers the ownership read, the card listing and the deletes by
	// command, recording the order they ran in.
	const respond = ({
		owned = true,
		cards = ["cards/t1/1.png", "cards/t1/2.png"],
		failCards = false,
	} = {}) => {
		const order: string[] = [];
		send.mockImplementation(async (command: any) => {
			order.push(command.constructor.name);
			if (command.constructor.name === "GetCommand") {
				return { Item: owned ? { teamUUID: "t1" } : undefined };
			}
			return {};
		});
		s3Send.mockImplementation(async (command: any) => {
			order.push(command.constructor.name);
			if (command.constructor.name === "ListObjectsV2Command") {
				return { Contents: cards.map((Key) => ({ Key })), IsTruncated: false };
			}
			if (failCards) throw new Error("delete failed");
			return { Errors: [] };
		});
		cloudFrontSend.mockImplementation(async (command: any) => {
			order.push(command.constructor.name);
			return {};
		});
		return order;
	};

	it("404s for a team the caller doesn't own, and never touches its cards", async () => {
		respond({ owned: false });

		const result = await deleteTeam();

		expect(result.statusCode).toBe(404);
		expect(parseBody(result).success).toBe(false);
		expect(s3Send).not.toHaveBeenCalled();
		const [getCommand] = send.mock.calls[0];
		expect(getCommand.input.Key).toEqual({ PK: "userUUID#user-1", SK: "team#t1" });
	});

	it("deletes the team's share cards and invalidates them before deleting the item", async () => {
		const order = respond();

		const result = await deleteTeam();

		expect(result.statusCode).toBe(200);
		expect(parseBody(result)).toEqual({ success: true, data: undefined });
		expect(order).toEqual([
			"GetCommand",
			"ListObjectsV2Command",
			"DeleteObjectsCommand",
			"CreateInvalidationCommand",
			"DeleteCommand",
		]);
		const list = s3Send.mock.calls[0][0].input;
		expect(list).toMatchObject({ Bucket: "team-builder-test-assets", Prefix: "cards/t1/" });
		const removed = s3Send.mock.calls[1][0].input.Delete.Objects;
		expect(removed).toEqual([{ Key: "cards/t1/1.png" }, { Key: "cards/t1/2.png" }]);
		const invalidation = cloudFrontSend.mock.calls[0][0].input;
		expect(invalidation.DistributionId).toBe("EDIST123");
		expect(invalidation.InvalidationBatch.Paths.Items).toEqual([
			"/cards/t1/1.png",
			"/cards/t1/2.png",
		]);
		const deleteCommand = send.mock.calls[1][0].input;
		expect(deleteCommand.Key).toEqual({ PK: "userUUID#user-1", SK: "team#t1" });
	});

	it("deletes a team that never had a card without calling S3 delete or CloudFront", async () => {
		const order = respond({ cards: [] });

		const result = await deleteTeam();

		expect(result.statusCode).toBe(200);
		expect(order).toEqual(["GetCommand", "ListObjectsV2Command", "DeleteCommand"]);
	});

	it("keeps the item when the cards can't be deleted, so a retry finds them again", async () => {
		const order = respond({ failCards: true });

		const result = await deleteTeam();

		expect(result.statusCode).toBe(500);
		expect(order).not.toContain("DeleteCommand");
	});

	it("maps a team deleted in between to 404, not 500", async () => {
		respond();
		const err = new Error("conditional check failed");
		err.name = "ConditionalCheckFailedException";
		send.mockImplementation(async (command: any) => {
			if (command.constructor.name === "GetCommand") return { Item: { teamUUID: "t1" } };
			throw err;
		});

		const result = await deleteTeam();

		expect(result.statusCode).toBe(404);
	});
});

const validTeamBody = (overrides: Record<string, any> = {}) =>
	JSON.stringify({
		title: "Sharers",
		roster: [{ slot: 1, player: { fullName: "LeBron James" } }],
		coach: null,
		gm: null,
		arena: null,
		...overrides,
	});

describe("createTeam GSI keys", () => {
	it("writes PK2/SK2 so the row is indexed as private from birth", async () => {
		send.mockResolvedValueOnce({});
		const result: any = await createTeamHandler(
			authorizerEvent({ body: validTeamBody() }),
			{} as any,
			{} as any,
		);
		expect(result.statusCode).toBe(200);
		const item = send.mock.calls[0][0].input.Item;
		expect(item.PK2).toBe(`team#${item.teamUUID}`);
		expect(item.SK2).toBe("private");
		expect(item.public).toBe(false);
		const body = parseBody(result);
		expect(body.data.PK2).toBeUndefined();
		expect(body.data.SK2).toBeUndefined();
	});
});

describe("updateTeam GSI keys", () => {
	it("sets PK2 and only defaults SK2 when absent, so a save never unpublishes", async () => {
		send.mockResolvedValueOnce({ Attributes: { teamUUID: "t1", title: "x" } });
		await updateTeamHandler(
			authorizerEvent({ body: validTeamBody({ teamUUID: "t1" }) }),
			{} as any,
			{} as any,
		);
		const input = send.mock.calls[0][0].input;
		expect(input.UpdateExpression).toContain("PK2 = :pk2");
		expect(input.UpdateExpression).toContain("SK2 = if_not_exists(SK2, :sk2Default)");
		expect(input.ExpressionAttributeValues[":pk2"]).toBe("team#t1");
		expect(input.ExpressionAttributeValues[":sk2Default"]).toBe("private");
	});
});

describe("listTeams projection", () => {
	it("projects the share fields under an alias because public is reserved", async () => {
		send.mockResolvedValueOnce({ Items: [] });
		await listTeamsHandler(authorizerEvent(), {} as any, {} as any);
		const input = send.mock.calls[0][0].input;
		expect(input.ProjectionExpression).toContain("#pub");
		expect(input.ProjectionExpression).toContain("cardUrl");
		expect(input.ExpressionAttributeNames["#pub"]).toBe("public");
	});
});
