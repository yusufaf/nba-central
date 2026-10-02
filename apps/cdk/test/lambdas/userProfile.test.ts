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
	// A plain function, not an arrow: it has to work with `new`.
	return { ...actual, S3Client: vi.fn(function () { return { send: s3Send }; }) };
});

process.env.mainTable = "team-builder-test-main";
process.env.usersTable = "team-builder-test-users";
process.env.assetsBucket = "team-builder-test-assets";
process.env.assetsCdnDomain = "cdn.example";

const { handler: statsHandler } = await import("lambdas/getUserStats/src/getUserStats");
const { handler: uploadHandler } = await import("lambdas/uploadAvatar/src/uploadAvatar");

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

beforeEach(() => {
	send.mockReset();
	s3Send.mockReset();
});

describe("getUserStats", () => {
	const stats = () => statsHandler(authorizerEvent(), {} as any, {} as any) as Promise<any>;

	// Answers each Query by its SK prefix. Pages are served in order, so a
	// prefix with two pages proves the handler follows LastEvaluatedKey.
	const respondByPrefix = (pages: Record<string, Record<string, unknown>[]>) => {
		const served: Record<string, number> = {};
		send.mockImplementation(async (command: any) => {
			const prefix = command.input.ExpressionAttributeValues[":sk"];
			const index = served[prefix] ?? 0;
			served[prefix] = index + 1;
			return pages[prefix]?.[index] ?? { Count: 0 };
		});
	};

	it("counts each kind of item under the caller's own partition", async () => {
		respondByPrefix({
			"team#": [
				{
					Items: [{ public: true }, { public: false }, {}],
					LastEvaluatedKey: { PK: "a", SK: "b" },
				},
				{ Items: [{ public: true }] },
			],
			"customCoach#": [{ Count: 2 }],
			"customGM#": [{ Count: 5, LastEvaluatedKey: { PK: "a", SK: "b" } }, { Count: 1 }],
			"customPlayer#": [{ Count: 0 }],
		});

		const result = await stats();

		expect(result.statusCode).toBe(200);
		expect(parseBody(result)).toEqual({
			success: true,
			data: {
				teams: 4,
				publishedTeams: 2,
				customCoaches: 2,
				customGMs: 6,
				customPlayers: 0,
			},
		});

		for (const [command] of send.mock.calls) {
			expect(command.input.TableName).toBe("team-builder-test-main");
			expect(command.input.ExpressionAttributeValues[":pk"]).toBe("userUUID#user-1");
		}
		const pagedGM = send.mock.calls
			.map(([command]) => command.input)
			.filter((input) => input.ExpressionAttributeValues[":sk"] === "customGM#");
		expect(pagedGM[1].ExclusiveStartKey).toEqual({ PK: "a", SK: "b" });
	});

	it("only reads the published flag of each team, and only counts the rest", async () => {
		respondByPrefix({});

		await stats();

		const inputs = send.mock.calls.map(([command]) => command.input);
		const teams = inputs.find((input) => input.ExpressionAttributeValues[":sk"] === "team#");
		expect(teams.ProjectionExpression).toBe("#pub");
		for (const input of inputs.filter((i) => i !== teams)) {
			expect(input.Select).toBe("COUNT");
		}
	});

	it("ignores any user id in the query or body", async () => {
		respondByPrefix({});

		await statsHandler(
			authorizerEvent({
				queryStringParameters: { sub: "someone-else" },
				body: JSON.stringify({ userUUID: "someone-else" }),
			}),
			{} as any,
			{} as any,
		);

		for (const [command] of send.mock.calls) {
			expect(command.input.ExpressionAttributeValues[":pk"]).toBe("userUUID#user-1");
		}
	});

	it("401s without an authorizer context and never touches DynamoDB", async () => {
		const result: any = await statsHandler(unauthenticatedEvent(), {} as any, {} as any);

		expect(result.statusCode).toBe(401);
		expect(send).not.toHaveBeenCalled();
	});

	it("500s when DynamoDB fails", async () => {
		send.mockRejectedValue(new Error("boom"));

		const result = await stats();

		expect(result.statusCode).toBe(500);
		expect(parseBody(result).success).toBe(false);
	});
});

describe("uploadAvatar", () => {
	const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
	const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
	const WEBP = Buffer.concat([
		Buffer.from("RIFF"),
		Buffer.from([0x24, 0, 0, 0]),
		Buffer.from("WEBPVP8 "),
	]);
	const GIF = Buffer.from("GIF89a\x01\x00\x01\x00");
	const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

	const upload = (body: unknown, overrides: Record<string, any> = {}) =>
		uploadHandler(
			authorizerEvent({ body: JSON.stringify(body), ...overrides }),
			{} as any,
			{} as any,
		) as Promise<any>;

	const putCalls = () =>
		s3Send.mock.calls.map(([command]) => command).filter((c) => "Body" in c.input);

	beforeEach(() => {
		vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
		send.mockResolvedValue({ Attributes: {} });
		s3Send.mockResolvedValue({});
	});

	it("stores the image under the caller's own prefix and records it on their item", async () => {
		const result = await upload({ image: PNG.toString("base64") });

		expect(result.statusCode).toBe(200);
		expect(parseBody(result)).toEqual({
			success: true,
			data: { avatarUrl: "https://cdn.example/avatars/user-1/1700000000000.png" },
		});

		const [put] = putCalls();
		expect(put.input).toMatchObject({
			Bucket: "team-builder-test-assets",
			Key: "avatars/user-1/1700000000000.png",
			ContentType: "image/png",
			CacheControl: "public, max-age=31536000, immutable",
		});
		expect(Buffer.compare(put.input.Body, PNG)).toBe(0);

		const [update] = send.mock.calls[0];
		expect(update.input.TableName).toBe("team-builder-test-users");
		expect(update.input.Key).toEqual({ PK: "userUUID#user-1", SK: "metadata#" });
		expect(update.input.ExpressionAttributeValues).toMatchObject({
			":url": "https://cdn.example/avatars/user-1/1700000000000.png",
			":key": "avatars/user-1/1700000000000.png",
		});
	});

	it("takes the type from the bytes, not from anything the client says", async () => {
		for (const [bytes, ext, contentType] of [
			[JPEG, "jpg", "image/jpeg"],
			[WEBP, "webp", "image/webp"],
		] as const) {
			s3Send.mockClear();
			const result = await upload({
				image: bytes.toString("base64"),
				contentType: "image/png",
				fileName: "me.png",
			});

			expect(result.statusCode).toBe(200);
			const [put] = putCalls();
			expect(put.input.Key).toBe(`avatars/user-1/1700000000000.${ext}`);
			expect(put.input.ContentType).toBe(contentType);
		}
	});

	it("rejects other types, whatever they claim to be, before writing anything", async () => {
		for (const bytes of [GIF, SVG, Buffer.from("not an image at all")]) {
			const result = await upload({
				image: bytes.toString("base64"),
				contentType: "image/png",
				fileName: "me.png",
			});

			expect(result.statusCode).toBe(400);
			expect(parseBody(result)).toEqual({
				success: false,
				error: "Avatar must be a PNG, JPEG or WebP image",
			});
		}
		expect(s3Send).not.toHaveBeenCalled();
		expect(send).not.toHaveBeenCalled();
	});

	it("rejects an image over 1 MB", async () => {
		const oversize = Buffer.concat([PNG, Buffer.alloc(1024 * 1024)]);

		const result = await upload({ image: oversize.toString("base64") });

		expect(result.statusCode).toBe(400);
		expect(parseBody(result)).toEqual({
			success: false,
			error: "Avatar must be under 1 MB",
		});
		expect(s3Send).not.toHaveBeenCalled();
	});

	it("accepts an image right at the limit", async () => {
		const atLimit = Buffer.concat([PNG, Buffer.alloc(1024 * 1024 - PNG.length)]);

		const result = await upload({ image: atLimit.toString("base64") });

		expect(result.statusCode).toBe(200);
	});

	it("writes only the caller's avatar, whatever user or key the body names", async () => {
		const result = await upload({
			image: PNG.toString("base64"),
			userUUID: "victim",
			sub: "victim",
			key: "avatars/victim/1.png",
		});

		expect(result.statusCode).toBe(200);
		const [put] = putCalls();
		expect(put.input.Key).toBe("avatars/user-1/1700000000000.png");
		expect(send.mock.calls[0][0].input.Key).toEqual({
			PK: "userUUID#user-1",
			SK: "metadata#",
		});
	});

	it("deletes the upload it replaces", async () => {
		send.mockResolvedValueOnce({
			Attributes: { avatarKey: "avatars/user-1/1600000000000.jpg" },
		});

		const result = await upload({ image: PNG.toString("base64") });

		expect(result.statusCode).toBe(200);
		const deletes = s3Send.mock.calls
			.map(([command]) => command.input)
			.filter((input) => !("Body" in input));
		expect(deletes).toEqual([
			{ Bucket: "team-builder-test-assets", Key: "avatars/user-1/1600000000000.jpg" },
		]);
	});

	it("never deletes an object outside the caller's prefix", async () => {
		send.mockResolvedValueOnce({ Attributes: { avatarKey: "cards/t1/1.png" } });

		await upload({ image: PNG.toString("base64") });

		expect(s3Send).toHaveBeenCalledTimes(1);
	});

	it("still succeeds when the old upload can't be deleted", async () => {
		send.mockResolvedValueOnce({
			Attributes: { avatarKey: "avatars/user-1/1600000000000.jpg" },
		});
		s3Send.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("AccessDenied"));

		const result = await upload({ image: PNG.toString("base64") });

		expect(result.statusCode).toBe(200);
	});

	it("removes the new object again if recording it fails", async () => {
		send.mockRejectedValueOnce(new Error("boom"));

		const result = await upload({ image: PNG.toString("base64") });

		expect(result.statusCode).toBe(500);
		const last = s3Send.mock.calls.at(-1)![0].input;
		expect(last).toEqual({
			Bucket: "team-builder-test-assets",
			Key: "avatars/user-1/1700000000000.png",
		});
	});

	it("400s on a missing or malformed body", async () => {
		for (const body of ["not json", "null", "{}", '{"image":42}', '{"image":""}']) {
			const result: any = await uploadHandler(
				authorizerEvent({ body }),
				{} as any,
				{} as any,
			);
			expect(result.statusCode).toBe(400);
		}
		expect(s3Send).not.toHaveBeenCalled();
	});

	it("401s without an authorizer context and writes nothing", async () => {
		const result: any = await uploadHandler(
			unauthenticatedEvent({ body: JSON.stringify({ image: PNG.toString("base64") }) }),
			{} as any,
			{} as any,
		);

		expect(result.statusCode).toBe(401);
		expect(s3Send).not.toHaveBeenCalled();
		expect(send).not.toHaveBeenCalled();
	});
});
