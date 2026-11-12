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

const { handler: createHandler } = await import("lambdas/createCustomPlayer/src/createCustomPlayer");
const { handler: updateHandler } = await import("lambdas/updateCustomPlayer/src/updateCustomPlayer");
const { handler: listHandler } = await import("lambdas/listCustomPlayers/src/listCustomPlayers");
const { handler: deleteHandler } = await import("lambdas/deleteCustomPlayer/src/deleteCustomPlayer");

const LOOK = {
	version: 1,
	frame: "m",
	skin: "#8d5a3b",
	hair: { style: "parted", color: "#3b2a1e" },
	facialHair: { style: "beard", color: "#3b2a1e" },
	build: { girth: 0, shoulders: 0, wingspan: 0 },
	accessories: [],
	pose: "relaxed",
};

const PLAYER = { name: "Nova", position: "PG", heightFeet: 6, heightInches: 3, weightPounds: 195, overallRating: 80 };

const event = (overrides: Record<string, unknown> = {}) => ({
	requestContext: { authorizer: { lambda: { sub: "user-1", username: "someone" } } },
	pathParameters: {},
	body: null,
	...overrides,
});
type Result = { statusCode: number; body: string };
const run = async (handler: (...args: never[]) => unknown, body?: unknown, overrides: Record<string, unknown> = {}) =>
	(await handler(
		event({ body: body === undefined ? null : JSON.stringify(body), ...overrides }) as never,
		{} as never,
		{} as never,
	)) as Result;
const parseBody = (result: Result) => JSON.parse(result.body);

beforeEach(() => {
	send.mockReset();
});

describe("createCustomPlayer", () => {
	it("stores the look without unknown keys and returns it", async () => {
		send.mockResolvedValueOnce({});
		const result = await run(createHandler, { ...PLAYER, appearance: { ...LOOK, secret: 1 } });
		expect(result.statusCode).toBe(200);
		expect(send.mock.calls[0][0].input.Item.appearance).toEqual(LOOK);
		expect(parseBody(result).data.appearance).toEqual(LOOK);
	});

	it("stores no appearance key without one", async () => {
		send.mockResolvedValueOnce({});
		const result = await run(createHandler, PLAYER);
		expect(send.mock.calls[0][0].input.Item).not.toHaveProperty("appearance");
		expect(parseBody(result).data).not.toHaveProperty("appearance");
	});

	it("400s on an invalid look without writing", async () => {
		const result = await run(createHandler, { ...PLAYER, appearance: { ...LOOK, skin: "pink" } });
		expect(result.statusCode).toBe(400);
		expect(parseBody(result).error).toBe("Appearance skin must be a #rrggbb colour");
		expect(send).not.toHaveBeenCalled();
	});
});

describe("updateCustomPlayer", () => {
	const updated = (appearance?: unknown) => ({
		Attributes: { playerUUID: "p1", ...PLAYER, updated: "now", ...(appearance !== undefined && { appearance }) },
	});

	it("replaces the look, without unknown keys", async () => {
		send.mockResolvedValueOnce(updated(LOOK));
		const result = await run(updateHandler, { playerUUID: "p1", ...PLAYER, appearance: { ...LOOK, secret: 1 } });
		const input = send.mock.calls[0][0].input;
		expect(input.UpdateExpression).toContain(", #appearance = :appearance");
		expect(input.ExpressionAttributeNames["#appearance"]).toBe("appearance");
		expect(input.ExpressionAttributeValues[":appearance"]).toEqual(LOOK);
		expect(parseBody(result).data.appearance).toEqual(LOOK);
	});

	it("leaves a stored look alone when the payload has none", async () => {
		send.mockResolvedValueOnce(updated());
		const result = await run(updateHandler, { playerUUID: "p1", ...PLAYER });
		const input = send.mock.calls[0][0].input;
		expect(input.UpdateExpression).not.toContain("appearance");
		expect(input.ExpressionAttributeNames).not.toHaveProperty("#appearance");
		expect(input.ExpressionAttributeValues).not.toHaveProperty(":appearance");
		expect(parseBody(result).data).not.toHaveProperty("appearance");
	});

	it("removes the look on null", async () => {
		send.mockResolvedValueOnce(updated());
		await run(updateHandler, { playerUUID: "p1", ...PLAYER, appearance: null });
		const input = send.mock.calls[0][0].input;
		expect(input.UpdateExpression).toMatch(/ REMOVE #appearance$/);
		expect(input.ExpressionAttributeNames["#appearance"]).toBe("appearance");
		expect(input.ExpressionAttributeValues).not.toHaveProperty(":appearance");
	});

	it("400s on an invalid look without writing", async () => {
		const result = await run(updateHandler, { playerUUID: "p1", ...PLAYER, appearance: { ...LOOK, version: 2 } });
		expect(result.statusCode).toBe(400);
		expect(send).not.toHaveBeenCalled();
	});
});

describe("listCustomPlayers", () => {
	it("returns a stored look, and no key for a player without one", async () => {
		send.mockResolvedValueOnce({
			Items: [
				{ playerUUID: "p1", ...PLAYER, created: "x", appearance: LOOK },
				{ playerUUID: "p2", ...PLAYER, created: "y" },
			],
		});
		const { data } = parseBody(await run(listHandler));
		expect(data.customPlayers[0].appearance).toEqual(LOOK);
		expect(data.customPlayers[1]).not.toHaveProperty("appearance");
	});
});

describe("deleteCustomPlayer", () => {
	it("deletes only the player's own item, so teams keep their look", async () => {
		send.mockResolvedValue({});
		await run(deleteHandler, undefined, { pathParameters: { playerUUID: "p1" } });
		const commands = send.mock.calls.map(([command]) => command);
		expect(commands.map((command) => command.constructor.name)).toEqual(["DeleteCommand"]);
		expect(commands[0].input.Key).toEqual({ PK: "userUUID#user-1", SK: "customPlayer#p1" });
	});
});
