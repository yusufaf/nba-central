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

const coach = {
	create: (await import("lambdas/createCustomCoach/src/createCustomCoach")).handler,
	update: (await import("lambdas/updateCustomCoach/src/updateCustomCoach")).handler,
	list: (await import("lambdas/listCustomCoaches/src/listCustomCoaches")).handler,
};
const gm = {
	create: (await import("lambdas/createCustomGM/src/createCustomGM")).handler,
	update: (await import("lambdas/updateCustomGM/src/updateCustomGM")).handler,
	list: (await import("lambdas/listCustomGMs/src/listCustomGMs")).handler,
};

const LOOK = {
	version: 1,
	frame: "m",
	skin: "#8d5a3b",
	hair: { style: "parted", color: "#3b2a1e" },
	facialHair: { style: "beard", color: "#3b2a1e" },
	build: { girth: 0, shoulders: 0, wingspan: 0, heightIn: 74 },
	accessories: [{ id: "glasses", color: "#1c1c1c" }],
	outfit: { style: "tracksuit", primary: "#552583", secondary: "#fdb927" },
	ageLook: "veteran",
	pose: "armsCrossed",
};

const event = (overrides: Record<string, unknown> = {}) => ({
	requestContext: { authorizer: { lambda: { sub: "user-1", username: "someone" } } },
	pathParameters: {},
	body: null,
	...overrides,
});
type Result = { statusCode: number; body: string };
const run = async (handler: (...args: never[]) => unknown, body?: unknown) =>
	(await handler(
		event({ body: body === undefined ? null : JSON.stringify(body) }) as never,
		{} as never,
		{} as never,
	)) as Result;
const parseBody = (result: Result) => JSON.parse(result.body);

beforeEach(() => {
	send.mockReset();
});

describe.each([
	{
		kind: "coach",
		handlers: coach,
		base: { name: "Coach K", overallRating: 70, specialty: "Balanced" },
		idKey: "coachUUID",
		listKey: "customCoaches",
	},
	{ kind: "gm", handlers: gm, base: { name: "Exec", teams: ["LAL"] }, idKey: "gmUUID", listKey: "customGMs" },
])("custom $kind looks", ({ handlers, base, idKey, listKey }) => {
	describe("create", () => {
		it("stores the look without unknown keys and returns it", async () => {
			send.mockResolvedValueOnce({});
			const result = await run(handlers.create, {
				...base,
				appearance: { ...LOOK, secret: 1, jerseyNumber: "8", outfit: { ...LOOK.outfit, tie: "#000000" } },
			});
			expect(result.statusCode).toBe(200);
			expect(send.mock.calls[0][0].input.Item.appearance).toEqual(LOOK);
			expect(parseBody(result).data.appearance).toEqual(LOOK);
		});

		it("stores no appearance key without one", async () => {
			send.mockResolvedValueOnce({});
			const result = await run(handlers.create, base);
			expect(send.mock.calls[0][0].input.Item).not.toHaveProperty("appearance");
			expect(parseBody(result).data).not.toHaveProperty("appearance");
		});

		it("400s on an invalid look without writing", async () => {
			const result = await run(handlers.create, {
				...base,
				appearance: { ...LOOK, accessories: [{ id: "headband", color: "#ffffff" }] },
			});
			expect(result.statusCode).toBe(400);
			expect(parseBody(result).error).toBe("Appearance accessories must be one of glasses");
			expect(send).not.toHaveBeenCalled();
		});
	});

	describe("update", () => {
		const updated = (appearance?: unknown) => ({
			Attributes: { [idKey]: "s1", ...base, updated: "now", ...(appearance !== undefined && { appearance }) },
		});

		it("replaces the look, without unknown keys", async () => {
			send.mockResolvedValueOnce(updated(LOOK));
			const result = await run(handlers.update, { [idKey]: "s1", ...base, appearance: { ...LOOK, secret: 1 } });
			const input = send.mock.calls[0][0].input;
			expect(input.UpdateExpression).toContain(", #appearance = :appearance");
			expect(input.ExpressionAttributeNames["#appearance"]).toBe("appearance");
			expect(input.ExpressionAttributeValues[":appearance"]).toEqual(LOOK);
			expect(parseBody(result).data.appearance).toEqual(LOOK);
		});

		it("leaves a stored look alone when the payload has none", async () => {
			send.mockResolvedValueOnce(updated());
			const result = await run(handlers.update, { [idKey]: "s1", ...base });
			const input = send.mock.calls[0][0].input;
			expect(input.UpdateExpression).not.toContain("appearance");
			expect(input.ExpressionAttributeNames).not.toHaveProperty("#appearance");
			expect(input.ExpressionAttributeValues).not.toHaveProperty(":appearance");
			expect(parseBody(result).data).not.toHaveProperty("appearance");
		});

		it("removes the look on null", async () => {
			send.mockResolvedValueOnce(updated());
			await run(handlers.update, { [idKey]: "s1", ...base, appearance: null });
			const input = send.mock.calls[0][0].input;
			expect(input.UpdateExpression).toMatch(/ REMOVE #appearance$/);
			expect(input.ExpressionAttributeNames["#appearance"]).toBe("appearance");
			expect(input.ExpressionAttributeValues).not.toHaveProperty(":appearance");
		});

		it("400s on an invalid look without writing", async () => {
			const result = await run(handlers.update, {
				[idKey]: "s1",
				...base,
				appearance: { ...LOOK, build: { ...LOOK.build, heightIn: 95 } },
			});
			expect(result.statusCode).toBe(400);
			expect(send).not.toHaveBeenCalled();
		});
	});

	describe("list", () => {
		it("returns a stored look, and no key for an item without one", async () => {
			send.mockResolvedValueOnce({
				Items: [
					{ [idKey]: "s1", ...base, created: "x", appearance: LOOK },
					{ [idKey]: "s2", ...base, created: "y" },
				],
			});
			const { data } = parseBody(await run(handlers.list));
			expect(data[listKey][0].appearance).toEqual(LOOK);
			expect(data[listKey][1]).not.toHaveProperty("appearance");
		});
	});
});
