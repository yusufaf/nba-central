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

const { handler: getHandler } = await import(
	"lambdas/getUserSettings/src/getUserSettings"
);
const { handler: updateHandler } = await import(
	"lambdas/updateUserSettings/src/updateUserSettings"
);

const authorizerEvent = (overrides: Record<string, any> = {}) => ({
	requestContext: {
		authorizer: {
			lambda: { sub: "user-1", username: "someone" },
		},
	},
	body: null,
	...overrides,
});

const unauthenticatedEvent = (overrides: Record<string, any> = {}) => {
	const event = authorizerEvent(overrides);
	delete (event as any).requestContext.authorizer.lambda;
	return event;
};

const parseBody = (result: any) => JSON.parse(result.body);

const conditionalCheckFailed = () => {
	const err = new Error("The conditional request failed");
	err.name = "ConditionalCheckFailedException";
	return err;
};

beforeEach(() => {
	send.mockReset();
});

describe("getUserSettings", () => {
	it("reads the caller's item keyed by the authorizer sub", async () => {
		send.mockResolvedValueOnce({
			Item: {
				PK: "userUUID#user-1",
				SK: "metadata#",
				settings: { "scores.hideScores": true },
				settingsUpdatedAt: "2026-09-28T00:00:00.000Z",
			},
		});

		const result: any = await getHandler(authorizerEvent(), {} as any, {} as any);

		expect(send).toHaveBeenCalledTimes(1);
		const command = send.mock.calls[0][0];
		expect(command.input.Key).toEqual({
			PK: "userUUID#user-1",
			SK: "metadata#",
		});
		expect(result.statusCode).toBe(200);
		expect(parseBody(result)).toEqual({
			success: true,
			data: {
				settings: { "scores.hideScores": true },
				updatedAt: "2026-09-28T00:00:00.000Z",
			},
		});
	});

	it("ignores any user id in the query or body", async () => {
		send.mockResolvedValueOnce({});

		await getHandler(
			authorizerEvent({
				queryStringParameters: { sub: "someone-else" },
				body: JSON.stringify({ sub: "someone-else" }),
			}),
			{} as any,
			{} as any,
		);

		expect(send.mock.calls[0][0].input.Key.PK).toBe("userUUID#user-1");
	});

	it("returns empty settings and a null updatedAt when nothing is stored yet", async () => {
		send.mockResolvedValueOnce({});

		const result: any = await getHandler(authorizerEvent(), {} as any, {} as any);

		expect(parseBody(result)).toEqual({
			success: true,
			data: { settings: {}, updatedAt: null },
		});
	});

	it("drops stored keys and values the allowlist no longer accepts", async () => {
		send.mockResolvedValueOnce({
			Item: {
				settings: {
					"scores.hideScores": true,
					"scores.retiredKey": true,
					"playerStats.statMode": "per_minute",
				},
				settingsUpdatedAt: "2026-09-28T00:00:00.000Z",
			},
		});

		const result: any = await getHandler(authorizerEvent(), {} as any, {} as any);

		expect(parseBody(result).data.settings).toEqual({ "scores.hideScores": true });
	});

	it("401s without an authorizer context and never touches DynamoDB", async () => {
		const result: any = await getHandler(unauthenticatedEvent(), {} as any, {} as any);

		expect(result.statusCode).toBe(401);
		expect(send).not.toHaveBeenCalled();
	});

	it("500s when DynamoDB fails", async () => {
		send.mockRejectedValueOnce(new Error("boom"));

		const result: any = await getHandler(authorizerEvent(), {} as any, {} as any);

		expect(result.statusCode).toBe(500);
		expect(parseBody(result).success).toBe(false);
	});
});

describe("updateUserSettings", () => {
	const update = (settings: unknown, overrides: Record<string, any> = {}) =>
		updateHandler(
			authorizerEvent({ body: JSON.stringify({ settings }), ...overrides }),
			{} as any,
			{} as any,
		) as Promise<any>;

	it("sets only the patched keys inside the existing settings map", async () => {
		send.mockResolvedValueOnce({
			Attributes: {
				settings: {
					"scores.hideScores": true,
					"playerStats.statMode": "totals",
				},
				settingsUpdatedAt: "2026-09-28T00:00:00.000Z",
			},
		});

		const result = await update({ "playerStats.statMode": "totals" });

		expect(send).toHaveBeenCalledTimes(1);
		const { input } = send.mock.calls[0][0];
		expect(input.Key).toEqual({ PK: "userUUID#user-1", SK: "metadata#" });
		expect(input.ConditionExpression).toBe("attribute_exists(#settings)");
		expect(input.UpdateExpression).toContain("#settings.#k0 = :v0");
		expect(input.ExpressionAttributeNames["#k0"]).toBe("playerStats.statMode");
		expect(input.ExpressionAttributeValues[":v0"]).toBe("totals");
		// Only the one key: a patch must never overwrite the whole map.
		expect(input.UpdateExpression).not.toMatch(/#settings = /);

		expect(result.statusCode).toBe(200);
		expect(parseBody(result)).toEqual({
			success: true,
			data: {
				settings: {
					"scores.hideScores": true,
					"playerStats.statMode": "totals",
				},
				updatedAt: "2026-09-28T00:00:00.000Z",
			},
		});
	});

	it("creates the settings map when the user has none yet", async () => {
		send.mockRejectedValueOnce(conditionalCheckFailed());
		send.mockResolvedValueOnce({
			Attributes: {
				settings: { "scores.useShortNames": false },
				settingsUpdatedAt: "2026-09-28T00:00:00.000Z",
			},
		});

		const result = await update({ "scores.useShortNames": false });

		expect(send).toHaveBeenCalledTimes(2);
		const { input } = send.mock.calls[1][0];
		expect(input.Key).toEqual({ PK: "userUUID#user-1", SK: "metadata#" });
		expect(input.ConditionExpression).toBe("attribute_not_exists(#settings)");
		expect(input.ExpressionAttributeValues[":settings"]).toEqual({
			"scores.useShortNames": false,
		});
		expect(result.statusCode).toBe(200);
	});

	it("retries the per-key update if another request created the map first", async () => {
		send.mockRejectedValueOnce(conditionalCheckFailed());
		send.mockRejectedValueOnce(conditionalCheckFailed());
		send.mockResolvedValueOnce({
			Attributes: {
				settings: { "scores.hideScores": true },
				settingsUpdatedAt: "2026-09-28T00:00:00.000Z",
			},
		});

		const result = await update({ "scores.hideScores": true });

		expect(send).toHaveBeenCalledTimes(3);
		expect(send.mock.calls[2][0].input.ConditionExpression).toBe(
			"attribute_exists(#settings)",
		);
		expect(result.statusCode).toBe(200);
	});

	it("accepts an empty patch, which marks settings as initialized", async () => {
		send.mockRejectedValueOnce(conditionalCheckFailed());
		send.mockResolvedValueOnce({
			Attributes: { settings: {}, settingsUpdatedAt: "2026-09-28T00:00:00.000Z" },
		});

		const result = await update({});

		expect(result.statusCode).toBe(200);
		expect(parseBody(result).data).toEqual({
			settings: {},
			updatedAt: "2026-09-28T00:00:00.000Z",
		});
	});

	it("uses the authorizer sub even when the body names another user", async () => {
		send.mockResolvedValueOnce({ Attributes: { settings: {} } });

		await updateHandler(
			authorizerEvent({
				body: JSON.stringify({
					sub: "someone-else",
					userUUID: "someone-else",
					settings: { "scores.hideScores": true },
				}),
			}),
			{} as any,
			{} as any,
		);

		expect(send.mock.calls[0][0].input.Key.PK).toBe("userUUID#user-1");
	});

	it("400s on an unknown key and writes nothing", async () => {
		const result = await update({ "scores.hideScores": true, "admin.isAdmin": true });

		expect(result.statusCode).toBe(400);
		expect(parseBody(result)).toEqual({
			success: false,
			error: "Unknown setting: admin.isAdmin",
		});
		expect(send).not.toHaveBeenCalled();
	});

	it("400s on a prototype key rather than treating it as known", async () => {
		const result = await updateHandler(
			authorizerEvent({ body: '{"settings":{"__proto__":true}}' }),
			{} as any,
			{} as any,
		) as any;

		expect(result.statusCode).toBe(400);
		expect(send).not.toHaveBeenCalled();
	});

	it.each([
		["playerStats.statMode", "per_minute"],
		["playerStats.seasonFormat", 2010],
		["scores.conferenceFilter", "NORTH"],
		["scores.selectedView", "list"],
		["scores.hideScores", "true"],
		["playerStats.showCareerSummary", null],
	])("400s on an invalid value for %s (%j)", async (key, value) => {
		const result = await update({ [key]: value });

		expect(result.statusCode).toBe(400);
		expect(parseBody(result).error).toBe(`Invalid value for ${key}`);
		expect(send).not.toHaveBeenCalled();
	});

	it.each([
		["not json", "{"],
		["a missing settings object", JSON.stringify({})],
		["settings as an array", JSON.stringify({ settings: [] })],
		["settings as null", JSON.stringify({ settings: null })],
		["no body at all", null],
	])("400s on %s", async (_label, body) => {
		const result = await updateHandler(
			authorizerEvent({ body }),
			{} as any,
			{} as any,
		) as any;

		expect(result.statusCode).toBe(400);
		expect(send).not.toHaveBeenCalled();
	});

	it("401s without an authorizer context and never touches DynamoDB", async () => {
		const result = await updateHandler(
			unauthenticatedEvent({
				body: JSON.stringify({ settings: { "scores.hideScores": true } }),
			}),
			{} as any,
			{} as any,
		) as any;

		expect(result.statusCode).toBe(401);
		expect(send).not.toHaveBeenCalled();
	});

	it("500s when DynamoDB fails for a reason other than the map check", async () => {
		send.mockRejectedValueOnce(new Error("boom"));

		const result = await update({ "scores.hideScores": true });

		expect(result.statusCode).toBe(500);
		expect(parseBody(result).success).toBe(false);
	});
});
