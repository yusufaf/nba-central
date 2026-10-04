import { describe, it, expect, vi, beforeEach } from "vitest";

/*
 * In-memory stand-ins for the main table, the assets bucket and the CDN, so
 * the arena handlers are checked against stored state: who can see, change
 * or delete what, and what is left behind afterwards.
 */

type Item = Record<string, any>;

const db: Item[] = [];
const bucket = new Map<string, { ContentType?: string; CacheControl?: string }>();
const invalidated: string[] = [];
const faults = { failUpdate: false, failDeleteObjects: false };

const keyOf = (item: Item) => `${item.PK}|${item.SK}`;
const find = (key: Item) => db.find((item) => keyOf(item) === keyOf(key));

const conditionalCheckFailed = () =>
	Object.assign(new Error("The conditional request failed"), {
		name: "ConditionalCheckFailedException",
	});

// Enough of UpdateExpression for these handlers: "SET a = :a, #b = :b REMOVE c, d".
const applyUpdate = (item: Item, input: Item) => {
	const names = input.ExpressionAttributeNames ?? {};
	const values = input.ExpressionAttributeValues ?? {};
	const name = (token: string) => names[token.trim()] ?? token.trim();
	const [, set = "", remove = ""] =
		/^(?:SET\s+(.*?))?\s*(?:REMOVE\s+(.*))?$/.exec(input.UpdateExpression.trim()) ?? [];
	const old: Item = {};
	for (const clause of set.split(",").filter(Boolean)) {
		const [field, value] = clause.split("=");
		old[name(field)] = item[name(field)];
		item[name(field)] = values[value.trim()];
	}
	for (const field of remove.split(",").filter(Boolean)) {
		old[name(field)] = item[name(field)];
		delete item[name(field)];
	}
	return old;
};

const dynamoSend = vi.fn(async (command: any) => {
	const input = command.input;
	switch (command.constructor.name) {
		case "GetCommand": {
			const found = find(input.Key);
			return { Item: found ? structuredClone(found) : undefined };
		}
		case "PutCommand": {
			const existing = find(input.Item);
			if (existing) db.splice(db.indexOf(existing), 1);
			db.push(structuredClone(input.Item));
			return {};
		}
		case "QueryCommand": {
			const pk = input.ExpressionAttributeValues[":pk"];
			const prefix = input.ExpressionAttributeValues[":sk"] ?? "";
			const matching = db.filter((item) => item.PK === pk && item.SK.startsWith(prefix));
			if (input.Select === "COUNT") return { Count: matching.length };
			return { Items: matching.map((item) => structuredClone(item)) };
		}
		case "UpdateCommand": {
			if (faults.failUpdate) throw new Error("update failed");
			const found = find(input.Key);
			if (!found) {
				if (input.ConditionExpression?.includes("attribute_exists")) {
					throw conditionalCheckFailed();
				}
				throw new Error("update without a condition would create an item");
			}
			const old = applyUpdate(found, input);
			if (input.ReturnValues === "ALL_NEW") return { Attributes: structuredClone(found) };
			if (input.ReturnValues === "UPDATED_OLD") return { Attributes: old };
			return {};
		}
		case "DeleteCommand": {
			const found = find(input.Key);
			if (!found) {
				if (input.ConditionExpression) throw conditionalCheckFailed();
				return {};
			}
			db.splice(db.indexOf(found), 1);
			return {};
		}
		default:
			throw new Error(`unexpected command ${command.constructor.name}`);
	}
});

const s3Send = vi.fn(async (command: any) => {
	const input = command.input;
	expect(input.Bucket).toBe("team-builder-test-assets");
	switch (command.constructor.name) {
		case "PutObjectCommand":
			bucket.set(input.Key, { ContentType: input.ContentType, CacheControl: input.CacheControl });
			return {};
		case "DeleteObjectCommand":
			bucket.delete(input.Key);
			return {};
		case "ListObjectsV2Command":
			return {
				Contents: [...bucket.keys()]
					.filter((key) => key.startsWith(input.Prefix))
					.map((Key) => ({ Key })),
				IsTruncated: false,
			};
		case "DeleteObjectsCommand":
			if (faults.failDeleteObjects) throw new Error("delete failed");
			for (const { Key } of input.Delete.Objects) bucket.delete(Key);
			return { Errors: [] };
		default:
			throw new Error(`unexpected command ${command.constructor.name}`);
	}
});

const cloudFrontSend = vi.fn(async (command: any) => {
	invalidated.push(...command.input.InvalidationBatch.Paths.Items);
	return {};
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
process.env.assetsBucket = "team-builder-test-assets";
process.env.assetsCdnDomain = "cdn.example";
process.env.assetsDistributionId = "EDIST123";

const { handler: createHandler } = await import("lambdas/createCustomArena/src/createCustomArena");
const { handler: listHandler } = await import("lambdas/listCustomArenas/src/listCustomArenas");
const { handler: updateHandler } = await import("lambdas/updateCustomArena/src/updateCustomArena");
const { handler: deleteHandler } = await import("lambdas/deleteCustomArena/src/deleteCustomArena");
const { handler: uploadImageHandler } = await import(
	"lambdas/uploadArenaImage/src/uploadArenaImage"
);
const { handler: deleteImageHandler } = await import(
	"lambdas/deleteArenaImage/src/deleteArenaImage"
);

const ME = "user-1";
const OTHER = "user-2";

const event = (overrides: Record<string, any> = {}, sub: string | null = ME) => ({
	requestContext: {
		authorizer: sub ? { lambda: { sub, username: `${sub}-name` } } : {},
	},
	pathParameters: {},
	body: null,
	...overrides,
});

const run = (handler: any, overrides: Record<string, any> = {}, sub: string | null = ME) =>
	handler(event(overrides, sub), {} as any, {} as any) as Promise<any>;

const parseBody = (result: any) => JSON.parse(result.body);

const court = {
	version: 1,
	wood: "maple",
	paint: "#5a2d82",
	apron: null,
	lines: "#ffffff",
	centerLogo: "team",
	baselineText: "SEATTLE",
	sidelineText: "",
};

const payload = (extra: Item = {}) => ({
	name: "Harbor Pavilion",
	location: "Seattle, Washington",
	capacity: 18600,
	openedYear: 2026,
	court: null,
	...extra,
});

const storedArena = (owner: string, arenaUUID: string, extra: Item = {}): Item => ({
	PK: `userUUID#${owner}`,
	SK: `customArena#${arenaUUID}`,
	entityType: "customArena",
	created: "2026-10-01T00:00:00.000Z",
	updated: "2026-10-01T00:00:00.000Z",
	arenaUUID,
	name: `${owner}'s arena`,
	location: "Somewhere",
	capacity: 15000,
	openedYear: 1999,
	court: null,
	createdBy: `${owner}-name`,
	...extra,
});

const arenasOf = (owner: string) =>
	db.filter((item) => item.PK === `userUUID#${owner}` && item.SK.startsWith("customArena#"));

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const GIF = Buffer.from("GIF89a\x01\x00\x01\x00");
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

beforeEach(() => {
	db.length = 0;
	bucket.clear();
	invalidated.length = 0;
	faults.failUpdate = false;
	faults.failDeleteObjects = false;
	dynamoSend.mockClear();
	s3Send.mockClear();
	cloudFrontSend.mockClear();
	vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
});

describe("createCustomArena", () => {
	it("stores the arena under the caller's partition and returns it without keys", async () => {
		const result = await run(createHandler, {
			body: JSON.stringify(payload({ name: "  Harbor Pavilion  ", court })),
		});

		expect(result.statusCode).toBe(200);
		const { data } = parseBody(result);
		expect(data).toMatchObject({
			name: "Harbor Pavilion",
			location: "Seattle, Washington",
			capacity: 18600,
			openedYear: 2026,
			court,
			isCustom: true,
		});
		for (const key of ["PK", "SK", "createdBy", "entityType"]) {
			expect(data).not.toHaveProperty(key);
		}

		const [item] = arenasOf(ME);
		expect(item).toMatchObject({
			SK: `customArena#${data.arenaUUID}`,
			entityType: "customArena",
			name: "Harbor Pavilion",
			createdBy: `${ME}-name`,
		});
	});

	it("ignores any user id in the body", async () => {
		await run(createHandler, { body: JSON.stringify({ ...payload(), userUUID: OTHER, PK: "x" }) });

		expect(arenasOf(ME)).toHaveLength(1);
		expect(arenasOf(OTHER)).toHaveLength(0);
	});

	it("400s on invalid data and writes nothing", async () => {
		for (const body of [
			payload({ name: "" }),
			payload({ capacity: 0 }),
			payload({ openedYear: 1849 }),
			payload({ court: { ...court, lines: "white" } }),
		]) {
			const result = await run(createHandler, { body: JSON.stringify(body) });
			expect(result.statusCode).toBe(400);
			expect(parseBody(result).success).toBe(false);
		}
		for (const body of ["not json", "null", "[]"]) {
			expect((await run(createHandler, { body })).statusCode).toBe(400);
		}
		expect(db).toEqual([]);
	});

	it("allows 20 arenas per user and refuses the 21st", async () => {
		for (let n = 0; n < 19; n++) db.push(storedArena(ME, `a${n}`));
		// Someone else's arenas don't count against the caller.
		for (let n = 0; n < 20; n++) db.push(storedArena(OTHER, `b${n}`));

		expect((await run(createHandler, { body: JSON.stringify(payload()) })).statusCode).toBe(200);
		const result = await run(createHandler, { body: JSON.stringify(payload()) });

		expect(result.statusCode).toBe(400);
		expect(parseBody(result).error).toBe("You can have up to 20 custom arenas");
		expect(arenasOf(ME)).toHaveLength(20);
	});

	it("401s without an authorizer context", async () => {
		const result = await run(createHandler, { body: JSON.stringify(payload()) }, null);
		expect(result.statusCode).toBe(401);
		expect(db).toEqual([]);
	});
});

describe("listCustomArenas", () => {
	it("lists only the caller's arenas, with their image URLs and no keys", async () => {
		db.push(
			storedArena(ME, "a1", {
				photoUrl: "https://cdn.example/arenas/a1/photo-1.jpg",
				photoKey: "arenas/a1/photo-1.jpg",
			}),
			storedArena(OTHER, "b1"),
		);

		const result = await run(listHandler);

		expect(result.statusCode).toBe(200);
		expect(parseBody(result).data.customArenas).toEqual([
			{
				arenaUUID: "a1",
				name: `${ME}'s arena`,
				location: "Somewhere",
				capacity: 15000,
				openedYear: 1999,
				court: null,
				photoUrl: "https://cdn.example/arenas/a1/photo-1.jpg",
				created: "2026-10-01T00:00:00.000Z",
				isCustom: true,
			},
		]);
	});

	it("returns an empty list when signed out", async () => {
		db.push(storedArena(ME, "a1"));
		const result = await run(listHandler, {}, null);
		expect(parseBody(result)).toEqual({ success: true, data: { customArenas: [] } });
		expect(dynamoSend).not.toHaveBeenCalled();
	});
});

describe("updateCustomArena", () => {
	it("replaces the details and court but keeps the images", async () => {
		db.push(
			storedArena(ME, "a1", {
				photoUrl: "https://cdn.example/arenas/a1/photo-1.jpg",
				photoKey: "arenas/a1/photo-1.jpg",
			}),
		);

		const result = await run(updateHandler, {
			body: JSON.stringify({ ...payload({ name: "Renamed", capacity: null, court }), arenaUUID: "a1" }),
		});

		expect(result.statusCode).toBe(200);
		expect(parseBody(result).data).toMatchObject({
			arenaUUID: "a1",
			name: "Renamed",
			capacity: null,
			court,
			photoUrl: "https://cdn.example/arenas/a1/photo-1.jpg",
		});
		expect(arenasOf(ME)[0]).toMatchObject({
			name: "Renamed",
			capacity: null,
			photoKey: "arenas/a1/photo-1.jpg",
		});
	});

	it("can't edit another user's arena, and never creates one", async () => {
		db.push(storedArena(OTHER, "b1"));

		const result = await run(updateHandler, {
			body: JSON.stringify({ ...payload({ name: "Mine now" }), arenaUUID: "b1" }),
		});

		expect(result.statusCode).toBe(404);
		expect(arenasOf(OTHER)[0].name).toBe(`${OTHER}'s arena`);
		expect(arenasOf(ME)).toEqual([]);
	});

	it("400s without an arenaUUID or with invalid data", async () => {
		db.push(storedArena(ME, "a1"));
		expect((await run(updateHandler, { body: JSON.stringify(payload()) })).statusCode).toBe(400);
		expect(
			(
				await run(updateHandler, {
					body: JSON.stringify({ ...payload({ openedYear: 3000 }), arenaUUID: "a1" }),
				})
			).statusCode,
		).toBe(400);
		expect(arenasOf(ME)[0].openedYear).toBe(1999);
	});
});

describe("deleteCustomArena", () => {
	const seedWithImages = () => {
		db.push(
			storedArena(ME, "a1", { photoKey: "arenas/a1/photo-1.jpg" }),
			storedArena(ME, "a2"),
			storedArena(OTHER, "b1"),
		);
		bucket.set("arenas/a1/photo-1.jpg", {});
		bucket.set("arenas/a1/logo-1.png", {});
		bucket.set("arenas/a2/photo-1.jpg", {});
		bucket.set("arenas/b1/photo-1.jpg", {});
	};

	const remove = (arenaUUID: string, sub: string = ME) =>
		run(deleteHandler, { pathParameters: { arenaUUID } }, sub);

	it("deletes the arena's images, invalidates them, then the item", async () => {
		seedWithImages();

		const result = await remove("a1");

		expect(result.statusCode).toBe(200);
		expect(arenasOf(ME).map((item) => item.arenaUUID)).toEqual(["a2"]);
		expect([...bucket.keys()].sort()).toEqual(["arenas/a2/photo-1.jpg", "arenas/b1/photo-1.jpg"]);
		expect(invalidated.sort()).toEqual(["/arenas/a1/logo-1.png", "/arenas/a1/photo-1.jpg"]);

		const deleteItemCall = dynamoSend.mock.invocationCallOrder[
			dynamoSend.mock.calls.findIndex(([command]) => command.constructor.name === "DeleteCommand")
		];
		const deleteObjectsCall = s3Send.mock.invocationCallOrder[
			s3Send.mock.calls.findIndex(([command]) => command.constructor.name === "DeleteObjectsCommand")
		];
		expect(deleteObjectsCall).toBeLessThan(deleteItemCall);
	});

	it("can't delete another user's arena or touch its images", async () => {
		seedWithImages();

		const result = await remove("b1");

		expect(result.statusCode).toBe(404);
		expect(arenasOf(OTHER)).toHaveLength(1);
		expect(bucket.has("arenas/b1/photo-1.jpg")).toBe(true);
		expect(s3Send).not.toHaveBeenCalled();
	});

	it("keeps the item when the images can't be deleted, so a retry finds them", async () => {
		seedWithImages();
		faults.failDeleteObjects = true;

		expect((await remove("a1")).statusCode).toBe(500);
		expect(arenasOf(ME)).toHaveLength(2);

		faults.failDeleteObjects = false;
		expect((await remove("a1")).statusCode).toBe(200);
		expect(bucket.has("arenas/a1/photo-1.jpg")).toBe(false);
	});

	it("deletes an arena with no images without calling CloudFront", async () => {
		seedWithImages();

		expect((await remove("a2")).statusCode).toBe(200);
		bucket.delete("arenas/a2/photo-1.jpg");
		db.push(storedArena(ME, "a3"));
		cloudFrontSend.mockClear();

		expect((await remove("a3")).statusCode).toBe(200);
		expect(cloudFrontSend).not.toHaveBeenCalled();
	});
});

describe("uploadArenaImage", () => {
	const upload = (arenaUUID: string, body: unknown, sub: string = ME) =>
		run(uploadImageHandler, { pathParameters: { arenaUUID }, body: JSON.stringify(body) }, sub);

	beforeEach(() => {
		db.push(storedArena(ME, "a1"), storedArena(OTHER, "b1"));
	});

	it("stores the photo under the arena's prefix and records it on the item", async () => {
		const result = await upload("a1", { slot: "photo", image: JPEG.toString("base64") });

		expect(result.statusCode).toBe(200);
		const url = "https://cdn.example/arenas/a1/photo-1700000000000.jpg";
		expect(parseBody(result)).toEqual({ success: true, data: { url } });
		expect(bucket.get("arenas/a1/photo-1700000000000.jpg")).toEqual({
			ContentType: "image/jpeg",
			CacheControl: "public, max-age=31536000, immutable",
		});
		expect(arenasOf(ME)[0]).toMatchObject({
			photoUrl: url,
			photoKey: "arenas/a1/photo-1700000000000.jpg",
		});
		// The key is the arena's, so the URL never names the owner.
		expect(url).not.toContain(ME);
	});

	it("takes the type from the bytes, for every slot", async () => {
		for (const [slot, bytes, ext] of [
			["logo", PNG, "png"],
			["drawing", PNG, "png"],
			["photo", WEBP, "webp"],
		] as const) {
			const result = await upload("a1", {
				slot,
				image: bytes.toString("base64"),
				contentType: "image/jpeg",
			});
			expect(result.statusCode).toBe(200);
			expect(arenasOf(ME)[0][`${slot}Key`]).toBe(`arenas/a1/${slot}-1700000000000.${ext}`);
		}
	});

	it("rejects anything that isn't PNG, JPEG or WebP before writing", async () => {
		for (const bytes of [GIF, SVG, Buffer.from("not an image")]) {
			const result = await upload("a1", { slot: "photo", image: bytes.toString("base64") });
			expect(result.statusCode).toBe(400);
			expect(parseBody(result).error).toBe("Photo must be a PNG, JPEG or WebP image");
		}
		expect(bucket.size).toBe(0);
	});

	it("rejects an image over 1 MB and accepts one right at it", async () => {
		const over = Buffer.concat([JPEG, Buffer.alloc(1024 * 1024)]);
		const result = await upload("a1", { slot: "photo", image: over.toString("base64") });
		expect(result.statusCode).toBe(400);
		expect(parseBody(result).error).toBe("Photo must be under 1 MB");
		expect(bucket.size).toBe(0);

		const atLimit = Buffer.concat([JPEG, Buffer.alloc(1024 * 1024 - JPEG.length)]);
		expect((await upload("a1", { slot: "photo", image: atLimit.toString("base64") })).statusCode).toBe(
			200,
		);
	});

	it("takes only a PNG for the drawing, which has to stay transparent", async () => {
		for (const bytes of [JPEG, WEBP]) {
			const result = await upload("a1", { slot: "drawing", image: bytes.toString("base64") });
			expect(result.statusCode).toBe(400);
			expect(parseBody(result).error).toBe("Drawing must be a PNG image");
		}
		expect(bucket.size).toBe(0);
	});

	it("rejects a drawing over 1 MB", async () => {
		const over = Buffer.concat([PNG, Buffer.alloc(1024 * 1024)]);
		const result = await upload("a1", { slot: "drawing", image: over.toString("base64") });
		expect(result.statusCode).toBe(400);
		expect(parseBody(result).error).toBe("Drawing must be under 1 MB");
		expect(bucket.size).toBe(0);
	});

	it("can't write into another user's arena", async () => {
		const result = await upload("b1", { slot: "photo", image: PNG.toString("base64") });

		expect(result.statusCode).toBe(404);
		expect(bucket.size).toBe(0);
		expect(arenasOf(OTHER)[0]).not.toHaveProperty("photoKey");
	});

	it("400s on an unknown slot or a missing image", async () => {
		for (const body of [
			{ slot: "banner", image: PNG.toString("base64") },
			{ slot: "photo" },
			{ image: PNG.toString("base64") },
		]) {
			expect((await upload("a1", body)).statusCode).toBe(400);
		}
		expect(bucket.size).toBe(0);
	});

	it("deletes the image it replaces, and only that slot's", async () => {
		await upload("a1", { slot: "logo", image: PNG.toString("base64") });
		bucket.set("arenas/a1/photo-1600000000000.jpg", {});
		Object.assign(arenasOf(ME)[0], {
			photoKey: "arenas/a1/photo-1600000000000.jpg",
			photoUrl: "https://cdn.example/arenas/a1/photo-1600000000000.jpg",
		});

		await upload("a1", { slot: "photo", image: JPEG.toString("base64") });

		expect([...bucket.keys()].sort()).toEqual([
			"arenas/a1/logo-1700000000000.png",
			"arenas/a1/photo-1700000000000.jpg",
		]);
	});

	it("removes the new object again if recording it fails", async () => {
		faults.failUpdate = true;

		const result = await upload("a1", { slot: "photo", image: PNG.toString("base64") });

		expect(result.statusCode).toBe(500);
		expect(bucket.size).toBe(0);
	});

	it("401s without an authorizer context", async () => {
		const result = await run(
			uploadImageHandler,
			{ pathParameters: { arenaUUID: "a1" }, body: JSON.stringify({ slot: "photo", image: PNG.toString("base64") }) },
			null,
		);
		expect(result.statusCode).toBe(401);
		expect(bucket.size).toBe(0);
	});
});

describe("deleteArenaImage", () => {
	const removeImage = (arenaUUID: string, slot: string, sub: string = ME) =>
		run(deleteImageHandler, { pathParameters: { arenaUUID, slot } }, sub);

	beforeEach(() => {
		db.push(
			storedArena(ME, "a1", {
				photoUrl: "https://cdn.example/arenas/a1/photo-1.jpg",
				photoKey: "arenas/a1/photo-1.jpg",
				logoUrl: "https://cdn.example/arenas/a1/logo-1.png",
				logoKey: "arenas/a1/logo-1.png",
			}),
			storedArena(OTHER, "b1", { photoKey: "arenas/b1/photo-1.jpg" }),
		);
		bucket.set("arenas/a1/photo-1.jpg", {});
		bucket.set("arenas/a1/logo-1.png", {});
		bucket.set("arenas/b1/photo-1.jpg", {});
	});

	it("removes one slot's image and invalidates it", async () => {
		const result = await removeImage("a1", "photo");

		expect(result.statusCode).toBe(200);
		expect(arenasOf(ME)[0]).not.toHaveProperty("photoUrl");
		expect(arenasOf(ME)[0]).not.toHaveProperty("photoKey");
		expect(arenasOf(ME)[0].logoKey).toBe("arenas/a1/logo-1.png");
		expect([...bucket.keys()].sort()).toEqual(["arenas/a1/logo-1.png", "arenas/b1/photo-1.jpg"]);
		expect(invalidated).toEqual(["/arenas/a1/photo-1.jpg"]);
	});

	it("can't remove another user's image", async () => {
		const result = await removeImage("b1", "photo");

		expect(result.statusCode).toBe(404);
		expect(bucket.has("arenas/b1/photo-1.jpg")).toBe(true);
		expect(arenasOf(OTHER)[0].photoKey).toBe("arenas/b1/photo-1.jpg");
	});

	it("succeeds without touching S3 when the slot is already empty", async () => {
		const result = await removeImage("a1", "drawing");

		expect(result.statusCode).toBe(200);
		expect(s3Send).not.toHaveBeenCalled();
	});

	it("400s on an unknown slot", async () => {
		expect((await removeImage("a1", "banner")).statusCode).toBe(400);
	});
});
