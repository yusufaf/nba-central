import { describe, it, expect, vi, beforeEach } from "vitest";

/*
 * An in-memory stand-in for the two tables, the assets bucket and the CDN,
 * so the handlers run against stored state rather than scripted replies.
 * That is what lets "a second run is a no-op" and "a retry after a partial
 * failure finishes the job" be tested as behaviour.
 */

type Item = Record<string, any>;

const PAGE_SIZE = 3;

const db = {
	main: [] as Item[],
	users: [] as Item[],
	// Fails the next N BatchWriteItem calls by handing back every request
	// as unprocessed.
	unprocessedBatches: 0,
	failQuery: false,
};
const bucket = new Set<string>();
const s3 = { failDeleteObjects: false, failList: false, deletedPerCall: [] as number[] };
const cdn = { failInvalidation: false };

const tableFor = (name: string) =>
	name === "team-builder-test-users" ? db.users : db.main;

const keyOf = (item: Item) => `${item.PK}|${item.SK}`;

const conditionalCheckFailed = () => {
	const error = new Error("The conditional request failed");
	error.name = "ConditionalCheckFailedException";
	return error;
};

const project = (item: Item, input: Item) => {
	if (!input.ProjectionExpression) return { ...item };
	const names = input.ExpressionAttributeNames ?? {};
	const fields = input.ProjectionExpression.split(",").map(
		(field: string) => names[field.trim()] ?? field.trim(),
	);
	return Object.fromEntries(fields.filter((f: string) => f in item).map((f: string) => [f, item[f]]));
};

const dynamoSend = vi.fn(async (command: any) => {
	const input = command.input;
	switch (command.constructor.name) {
		case "QueryCommand": {
			if (db.failQuery) throw new Error("query failed");
			const pk = input.ExpressionAttributeValues[":pk"];
			const prefix = input.ExpressionAttributeValues[":sk"] ?? "";
			const matching = tableFor(input.TableName)
				.filter((item) => item.PK === pk && item.SK.startsWith(prefix))
				.sort((a, b) => a.SK.localeCompare(b.SK));
			const start = input.ExclusiveStartKey
				? matching.findIndex((item) => item.SK === input.ExclusiveStartKey.SK) + 1
				: 0;
			const page = matching.slice(start, start + PAGE_SIZE);
			const last = page[page.length - 1];
			return {
				Items: page.map((item) => project(item, input)),
				LastEvaluatedKey:
					start + PAGE_SIZE < matching.length ? { PK: last.PK, SK: last.SK } : undefined,
			};
		}
		case "GetCommand": {
			const found = tableFor(input.TableName).find(
				(item) => keyOf(item) === keyOf(input.Key),
			);
			return { Item: found ? { ...found } : undefined };
		}
		case "UpdateCommand": {
			const table = tableFor(input.TableName);
			const found = table.find((item) => keyOf(item) === keyOf(input.Key));
			if (!found) throw conditionalCheckFailed();
			found.public = input.ExpressionAttributeValues[":false"];
			found.SK2 = input.ExpressionAttributeValues[":private"];
			delete found.cardUrl;
			return {};
		}
		case "DeleteCommand": {
			const table = tableFor(input.TableName);
			const index = table.findIndex((item) => keyOf(item) === keyOf(input.Key));
			if (index < 0) return {};
			const [removed] = table.splice(index, 1);
			return input.ReturnValues === "ALL_OLD" ? { Attributes: removed } : {};
		}
		case "BatchWriteCommand": {
			const [[tableName, requests]] = Object.entries(input.RequestItems) as [string, any[]][];
			if (requests.length > 25) throw new Error("too many items in one batch");
			if (db.unprocessedBatches > 0) {
				db.unprocessedBatches--;
				return { UnprocessedItems: { [tableName]: requests } };
			}
			const table = tableFor(tableName);
			for (const { DeleteRequest } of requests) {
				const index = table.findIndex((item) => keyOf(item) === keyOf(DeleteRequest.Key));
				if (index >= 0) table.splice(index, 1);
			}
			return { UnprocessedItems: {} };
		}
		default:
			throw new Error(`unexpected command ${command.constructor.name}`);
	}
});

const s3Send = vi.fn(async (command: any) => {
	const input = command.input;
	switch (command.constructor.name) {
		case "ListObjectsV2Command": {
			if (s3.failList) throw new Error("list failed");
			const keys = [...bucket].filter((key) => key.startsWith(input.Prefix)).sort();
			const start = input.ContinuationToken ? Number(input.ContinuationToken) : 0;
			const page = keys.slice(start, start + PAGE_SIZE);
			const more = start + PAGE_SIZE < keys.length;
			return {
				Contents: page.map((Key) => ({ Key })),
				IsTruncated: more,
				NextContinuationToken: more ? String(start + PAGE_SIZE) : undefined,
			};
		}
		case "DeleteObjectsCommand": {
			if (s3.failDeleteObjects) throw new Error("delete failed");
			const objects = input.Delete.Objects as { Key: string }[];
			if (objects.length > 1000) throw new Error("too many keys in one delete");
			s3.deletedPerCall.push(objects.length);
			for (const { Key } of objects) bucket.delete(Key);
			return { Errors: [] };
		}
		default:
			throw new Error(`unexpected command ${command.constructor.name}`);
	}
});

const cloudFrontSend = vi.fn(async (command: any) => {
	if (cdn.failInvalidation) throw new Error("invalidation failed");
	return { Invalidation: { Id: "I1", Status: "InProgress" }, input: command.input };
});

vi.mock("@aws-sdk/lib-dynamodb", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/lib-dynamodb")>();
	return { ...actual, DynamoDBDocumentClient: { from: () => ({ send: dynamoSend }) } };
});

vi.mock("@aws-sdk/client-dynamodb", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-dynamodb")>();
	return { ...actual, DynamoDBClient: vi.fn() };
});

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
	// A plain function, not an arrow: it has to work with `new`.
	return { ...actual, S3Client: vi.fn(function () { return { send: s3Send }; }) };
});

vi.mock("@aws-sdk/client-cloudfront", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-cloudfront")>();
	return {
		...actual,
		CloudFrontClient: vi.fn(function () { return { send: cloudFrontSend }; }),
	};
});

process.env.mainTable = "team-builder-test-main";
process.env.usersTable = "team-builder-test-users";
process.env.assetsBucket = "team-builder-test-assets";
process.env.assetsDistributionId = "EDIST123";
// Keeps the UnprocessedItems backoff out of the test's wall clock.
process.env.batchRetryBaseMs = "0";

const { handler: exportHandler } = await import("lambdas/exportUserData/src/exportUserData");
const { handler: deleteHandler } = await import("lambdas/deleteUserData/src/deleteUserData");

const ME = "user-1";
const OTHER = "user-2";

const authorizerEvent = (overrides: Record<string, any> = {}) => ({
	requestContext: {
		authorizer: { lambda: { sub: ME, username: "someone" } },
	},
	body: null,
	...overrides,
});

const unauthenticatedEvent = () => {
	const event = authorizerEvent();
	delete (event as any).requestContext.authorizer.lambda;
	return event;
};

const parseBody = (result: any) => JSON.parse(result.body);

const runExport = (event: any = authorizerEvent()) =>
	exportHandler(event, {} as any, {} as any) as Promise<any>;
const runDelete = (event: any = authorizerEvent()) =>
	deleteHandler(event, {} as any, {} as any) as Promise<any>;

const team = (owner: string, n: number, extra: Item = {}): Item => ({
	PK: `userUUID#${owner}`,
	SK: `team#${owner}-team-${n}`,
	PK2: `team#${owner}-team-${n}`,
	SK2: "private",
	teamUUID: `${owner}-team-${n}`,
	userUUID: owner,
	username: owner === ME ? "someone" : "other",
	title: `Team ${n}`,
	roster: [{ slot: 0, playerId: `p${n}` }],
	coach: null,
	public: false,
	...extra,
});

const publishedTeam = (owner: string, n: number) =>
	team(owner, n, {
		SK2: "public",
		public: true,
		publishedAt: 1000 + n,
		cardUrl: `https://cdn.example/cards/${owner}-team-${n}/1.png`,
	});

const entity = (owner: string, kind: string, n: number): Item => ({
	PK: `userUUID#${owner}`,
	SK: `${kind}#${owner}-${kind}-${n}`,
	userUUID: owner,
	name: `${kind} ${n}`,
});

const arena = (owner: string, n: number): Item => ({
	PK: `userUUID#${owner}`,
	SK: `customArena#${owner}-arena-${n}`,
	userUUID: owner,
	arenaUUID: `${owner}-arena-${n}`,
	name: `Arena ${n}`,
	court: { version: 1, wood: "maple" },
	photoUrl: `https://cdn.example/arenas/${owner}-arena-${n}/photo-1.jpg`,
	photoKey: `arenas/${owner}-arena-${n}/photo-1.jpg`,
});

const settingsItem = (owner: string): Item => ({
	PK: `userUUID#${owner}`,
	SK: "metadata#",
	settings: { "display.fontScale": "112.5" },
	settingsUpdatedAt: "2026-09-01T00:00:00.000Z",
	createdAt: "2026-08-01T00:00:00.000Z",
	avatarUrl: `https://cdn.example/avatars/${owner}/9.webp`,
	avatarKey: `avatars/${owner}/9.webp`,
	avatarUpdatedAt: "2026-09-02T00:00:00.000Z",
});

// Two users with the same kinds of data, so every assertion about "mine"
// is checked against a neighbour that has to survive untouched.
const seed = ({ teams = 2, published = 1, perKind = 1 } = {}) => {
	for (const owner of [ME, OTHER]) {
		for (let n = 0; n < teams; n++) {
			db.main.push(n < published ? publishedTeam(owner, n) : team(owner, n));
			bucket.add(`cards/${owner}-team-${n}/1.png`);
			bucket.add(`cards/${owner}-team-${n}/2.png`);
		}
		for (const kind of ["customCoach", "customGM", "customPlayer"]) {
			for (let n = 0; n < perKind; n++) db.main.push(entity(owner, kind, n));
		}
		db.users.push(settingsItem(owner));
		bucket.add(`avatars/${owner}/9.webp`);
	}
};

const mine = (items: Item[]) => items.filter((item) => item.PK === `userUUID#${ME}`);
const theirs = (items: Item[]) => items.filter((item) => item.PK === `userUUID#${OTHER}`);
const objectsOf = (owner: string) =>
	[...bucket].filter((key) => key.includes(`/${owner}-team-`) || key.startsWith(`avatars/${owner}/`));

beforeEach(() => {
	db.main.length = 0;
	db.users.length = 0;
	db.unprocessedBatches = 0;
	db.failQuery = false;
	bucket.clear();
	s3.failDeleteObjects = false;
	s3.failList = false;
	s3.deletedPerCall = [];
	cdn.failInvalidation = false;
	dynamoSend.mockClear();
	s3Send.mockClear();
	cloudFrontSend.mockClear();
});

describe("exportUserData", () => {
	it("401s without an authorizer context and reads nothing", async () => {
		const result = await runExport(unauthenticatedEvent());

		expect(result.statusCode).toBe(401);
		expect(dynamoSend).not.toHaveBeenCalled();
	});

	it("exports the caller's teams, custom entities, settings and avatar, versioned", async () => {
		seed({ teams: 2, published: 1, perKind: 2 });

		const result = await runExport();

		expect(result.statusCode).toBe(200);
		expect(result.headers["Cache-Control"]).toBe("no-store");
		const { success, data } = parseBody(result);
		expect(success).toBe(true);
		expect(data).toMatchObject({
			version: 1,
			user: { id: ME, username: "someone" },
			settings: { "display.fontScale": "112.5" },
			settingsUpdatedAt: "2026-09-01T00:00:00.000Z",
			avatarUrl: `https://cdn.example/avatars/${ME}/9.webp`,
		});
		expect(Number.isNaN(Date.parse(data.exportedAt))).toBe(false);
		expect(data.teams.map((t: Item) => t.teamUUID).sort()).toEqual([
			`${ME}-team-0`,
			`${ME}-team-1`,
		]);
		expect(data.customCoaches).toHaveLength(2);
		expect(data.customGMs).toHaveLength(2);
		expect(data.customPlayers).toHaveLength(2);
		expect(data.other).toEqual([]);
	});

	it("includes full rosters and published metadata, without table keys", async () => {
		seed({ teams: 1, published: 1 });

		const { data } = parseBody(await runExport());

		const [exported] = data.teams;
		expect(exported).toMatchObject({
			roster: [{ slot: 0, playerId: "p0" }],
			public: true,
			publishedAt: 1000,
			cardUrl: `https://cdn.example/cards/${ME}-team-0/1.png`,
		});
		for (const item of [...data.teams, ...data.customCoaches, ...data.customGMs, ...data.customPlayers]) {
			for (const key of ["PK", "SK", "PK2", "SK2", "userUUID"]) {
				expect(item).not.toHaveProperty(key);
			}
		}
	});

	it("contains nothing another user owns", async () => {
		seed({ teams: 4, published: 2, perKind: 2 });

		const result = await runExport();

		expect(result.body).not.toContain(OTHER);
		for (const [command] of dynamoSend.mock.calls) {
			const pk = command.input.ExpressionAttributeValues?.[":pk"] ?? command.input.Key?.PK;
			expect(pk).toBe(`userUUID#${ME}`);
		}
	});

	it("ignores any user id in the query or body", async () => {
		seed();

		const result = await runExport(
			authorizerEvent({
				queryStringParameters: { sub: OTHER },
				body: JSON.stringify({ userUUID: OTHER }),
			}),
		);

		expect(parseBody(result).data.user.id).toBe(ME);
		expect(result.body).not.toContain(OTHER);
	});

	it("follows LastEvaluatedKey past the first page", async () => {
		seed({ teams: PAGE_SIZE * 2 + 1, published: 0, perKind: 0 });

		const { data } = parseBody(await runExport());

		expect(data.teams).toHaveLength(PAGE_SIZE * 2 + 1);
	});

	it("puts items with an unknown SK prefix under `other`, so nothing is left out", async () => {
		db.main.push({ PK: `userUUID#${ME}`, SK: "customReferee#r1", name: "Ref" });

		const { data } = parseBody(await runExport());

		expect(data.other).toEqual([{ name: "Ref" }]);
	});

	it("lists custom arenas with their court and image URLs", async () => {
		seed({ teams: 0, published: 0, perKind: 0 });
		db.main.push(arena(ME, 1), arena(OTHER, 2));

		const { data } = parseBody(await runExport());

		expect(data.customArenas).toEqual([
			{
				arenaUUID: `${ME}-arena-1`,
				name: "Arena 1",
				court: { version: 1, wood: "maple" },
				photoUrl: `https://cdn.example/arenas/${ME}-arena-1/photo-1.jpg`,
				photoKey: `arenas/${ME}-arena-1/photo-1.jpg`,
			},
		]);
		expect(data.other).toEqual([]);
	});

	it("exports empty collections and null settings for a user with no data", async () => {
		const { data } = parseBody(await runExport());

		expect(data).toMatchObject({
			settings: {},
			settingsUpdatedAt: null,
			avatarUrl: null,
			teams: [],
			customCoaches: [],
			customGMs: [],
			customPlayers: [],
			customArenas: [],
			other: [],
		});
	});

	it("413s rather than exceed the Lambda response limit", async () => {
		const bigRoster = Array.from({ length: 2000 }, (_, slot) => ({
			slot,
			note: "x".repeat(200),
		}));
		for (let n = 0; n < 15; n++) db.main.push(team(ME, n, { roster: bigRoster }));

		const result = await runExport();

		expect(result.statusCode).toBe(413);
		expect(parseBody(result).success).toBe(false);
	});

	it("500s when DynamoDB fails", async () => {
		db.failQuery = true;

		const result = await runExport();

		expect(result.statusCode).toBe(500);
		expect(parseBody(result).success).toBe(false);
	});
});

describe("deleteUserData", () => {
	it("401s without an authorizer context and touches nothing", async () => {
		seed();

		const result = await runDelete(unauthenticatedEvent());

		expect(result.statusCode).toBe(401);
		expect(dynamoSend).not.toHaveBeenCalled();
		expect(s3Send).not.toHaveBeenCalled();
	});

	it("removes every item and object the caller owns, and nothing of anyone else's", async () => {
		seed({ teams: 3, published: 2, perKind: 2 });
		const othersItems = theirs(db.main).map(keyOf);
		const othersObjects = objectsOf(OTHER);

		const result = await runDelete();

		expect(result.statusCode).toBe(200);
		expect(parseBody(result)).toEqual({
			success: true,
			data: { deletedItems: 3 + 6 + 1, deletedFiles: 3 * 2 + 1 },
		});
		expect(mine(db.main)).toEqual([]);
		expect(mine(db.users)).toEqual([]);
		expect(objectsOf(ME)).toEqual([]);
		expect(theirs(db.main).map(keyOf)).toEqual(othersItems);
		expect(theirs(db.users)).toHaveLength(1);
		expect(objectsOf(OTHER).sort()).toEqual(othersObjects.sort());
	});

	it("deletes the cards of every team, private ones included, and the avatar prefix", async () => {
		seed({ teams: 2, published: 0 });
		// A card left over from before a team was unpublished, and a second
		// avatar from an interrupted upload.
		bucket.add(`avatars/${ME}/8.png`);

		await runDelete();

		const listed = s3Send.mock.calls
			.filter(([command]) => command.constructor.name === "ListObjectsV2Command")
			.map(([command]) => command.input.Prefix)
			.sort();
		expect(listed).toEqual([`avatars/${ME}/`, `cards/${ME}-team-0/`, `cards/${ME}-team-1/`]);
		expect(objectsOf(ME)).toEqual([]);
	});

	it("only ever addresses the caller's partition and prefixes", async () => {
		seed({ teams: 2, published: 1 });

		await runDelete(
			authorizerEvent({
				queryStringParameters: { sub: OTHER },
				pathParameters: { userUUID: OTHER },
				body: JSON.stringify({ userUUID: OTHER, sub: OTHER }),
			}),
		);

		const dynamoKeys = dynamoSend.mock.calls.flatMap(([command]) => {
			const input = command.input;
			if (input.RequestItems) {
				return Object.values(input.RequestItems as Record<string, any[]>)
					.flat()
					.map((request) => request.DeleteRequest.Key.PK);
			}
			return [input.ExpressionAttributeValues?.[":pk"] ?? input.Key?.PK];
		});
		expect(new Set(dynamoKeys)).toEqual(new Set([`userUUID#${ME}`]));
		expect(theirs(db.main)).not.toEqual([]);
		expect(objectsOf(OTHER)).not.toEqual([]);
	});

	it("follows pagination for items and for objects", async () => {
		seed({ teams: PAGE_SIZE * 2 + 1, published: 0, perKind: 0 });
		for (let n = 0; n < PAGE_SIZE + 1; n++) bucket.add(`cards/${ME}-team-0/extra-${n}.png`);

		await runDelete();

		expect(mine(db.main)).toEqual([]);
		expect(objectsOf(ME)).toEqual([]);
	});

	it("deletes more than 25 items in batches of at most 25", async () => {
		seed({ teams: 20, published: 0, perKind: 4 });

		await runDelete();

		const batchSizes = dynamoSend.mock.calls
			.filter(([command]) => command.constructor.name === "BatchWriteCommand")
			.map(([command]) => Object.values(command.input.RequestItems as Record<string, any[]>)[0].length);
		expect(batchSizes).toEqual([25, 7]);
		expect(mine(db.main)).toEqual([]);
	});

	it("retries UnprocessedItems until they are written", async () => {
		seed({ teams: 2, published: 0 });
		db.unprocessedBatches = 2;

		const result = await runDelete();

		expect(result.statusCode).toBe(200);
		expect(mine(db.main)).toEqual([]);
	});

	it("unpublishes public teams before deleting any card, so no page points at a missing image", async () => {
		seed({ teams: 2, published: 2 });
		const order: string[] = [];
		const recordDynamo = dynamoSend.getMockImplementation()!;
		dynamoSend.mockImplementation(async (command: any) => {
			order.push(command.constructor.name);
			return recordDynamo(command);
		});
		const recordS3 = s3Send.getMockImplementation()!;
		s3Send.mockImplementation(async (command: any) => {
			order.push(command.constructor.name);
			return recordS3(command);
		});

		try {
			await runDelete();
		} finally {
			dynamoSend.mockImplementation(recordDynamo);
			s3Send.mockImplementation(recordS3);
		}

		const lastUnpublish = order.lastIndexOf("UpdateCommand");
		expect(order.filter((name) => name === "UpdateCommand")).toHaveLength(2);
		expect(lastUnpublish).toBeLessThan(order.indexOf("DeleteObjectsCommand"));
		expect(order.indexOf("DeleteObjectsCommand")).toBeLessThan(order.indexOf("BatchWriteCommand"));
		// The users item (settings, avatar URL) goes last.
		expect(order[order.length - 1]).toBe("DeleteCommand");
	});

	it("deletes every custom arena's images, and nobody else's", async () => {
		seed({ teams: 1, published: 0 });
		db.main.push(arena(ME, 1), arena(ME, 2), arena(OTHER, 3));
		for (const key of [
			`arenas/${ME}-arena-1/photo-1.jpg`,
			`arenas/${ME}-arena-1/logo-1.png`,
			`arenas/${ME}-arena-2/photo-1.jpg`,
			`arenas/${OTHER}-arena-3/photo-1.jpg`,
		]) {
			bucket.add(key);
		}

		const result = await runDelete();

		expect(result.statusCode).toBe(200);
		expect([...bucket].filter((key) => key.startsWith("arenas/"))).toEqual([
			`arenas/${OTHER}-arena-3/photo-1.jpg`,
		]);
		expect(mine(db.main)).toEqual([]);
		expect(theirs(db.main).some((item) => item.SK === `customArena#${OTHER}-arena-3`)).toBe(true);
		const paths = (cloudFrontSend.mock.calls[0][0] as any).input.InvalidationBatch.Paths.Items;
		expect(paths).toEqual(
			expect.arrayContaining([
				`/arenas/${ME}-arena-1/photo-1.jpg`,
				`/arenas/${ME}-arena-1/logo-1.png`,
				`/arenas/${ME}-arena-2/photo-1.jpg`,
			]),
		);
	});

	it("invalidates exactly the deleted object paths at the assets CDN", async () => {
		seed({ teams: 1, published: 1 });

		await runDelete();

		expect(cloudFrontSend).toHaveBeenCalledTimes(1);
		const { input } = cloudFrontSend.mock.calls[0][0] as any;
		expect(input.DistributionId).toBe("EDIST123");
		expect(input.InvalidationBatch.Paths.Items.sort()).toEqual([
			`/avatars/${ME}/9.webp`,
			`/cards/${ME}-team-0/1.png`,
			`/cards/${ME}-team-0/2.png`,
		]);
		expect(input.InvalidationBatch.Paths.Quantity).toBe(3);
	});

	it("still succeeds when the invalidation fails", async () => {
		seed();
		cdn.failInvalidation = true;

		const result = await runDelete();

		expect(result.statusCode).toBe(200);
		expect(mine(db.main)).toEqual([]);
	});

	it("skips the invalidation when there was nothing to delete from S3", async () => {
		db.main.push(entity(ME, "customCoach", 0));

		await runDelete();

		expect(cloudFrontSend).not.toHaveBeenCalled();
	});

	it("is idempotent: a second run succeeds and deletes nothing", async () => {
		seed({ teams: 2, published: 1 });
		await runDelete();
		const othersBefore = theirs(db.main).map(keyOf);

		const second = await runDelete();

		expect(second.statusCode).toBe(200);
		expect(parseBody(second).data).toEqual({ deletedItems: 0, deletedFiles: 0 });
		expect(theirs(db.main).map(keyOf)).toEqual(othersBefore);
	});

	it("leaves everything retryable when S3 fails: items kept, pages already unpublished", async () => {
		seed({ teams: 2, published: 1 });
		s3.failDeleteObjects = true;

		const failed = await runDelete();

		expect(failed.statusCode).toBe(500);
		expect(parseBody(failed).success).toBe(false);
		expect(mine(db.main)).toHaveLength(2 + 3);
		expect(mine(db.users)).toHaveLength(1);
		expect(mine(db.main).filter((item) => item.SK2 === "public" || item.public)).toEqual([]);

		s3.failDeleteObjects = false;
		const retried = await runDelete();

		expect(retried.statusCode).toBe(200);
		expect(mine(db.main)).toEqual([]);
		expect(mine(db.users)).toEqual([]);
		expect(objectsOf(ME)).toEqual([]);
	});

	it("keeps the users item when items stay unprocessed, and a retry finishes", async () => {
		seed({ teams: 2, published: 0 });
		db.unprocessedBatches = 100;

		const failed = await runDelete();

		expect(failed.statusCode).toBe(500);
		expect(mine(db.users)).toHaveLength(1);

		db.unprocessedBatches = 0;
		const retried = await runDelete();

		expect(retried.statusCode).toBe(200);
		expect(mine(db.main)).toEqual([]);
		expect(mine(db.users)).toEqual([]);
	});

	it("treats a team deleted mid-run as already unpublished", async () => {
		seed({ teams: 1, published: 1 });
		const recordDynamo = dynamoSend.getMockImplementation()!;
		dynamoSend.mockImplementation(async (command: any) => {
			if (command.constructor.name === "UpdateCommand") throw conditionalCheckFailed();
			return recordDynamo(command);
		});

		try {
			const result = await runDelete();
			expect(result.statusCode).toBe(200);
		} finally {
			dynamoSend.mockImplementation(recordDynamo);
		}
	});
});
