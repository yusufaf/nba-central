import { describe, it, expect, vi, beforeEach } from "vitest";

/*
 * How a team's arena reference is stored and read back (#116). An in-memory
 * main table stands in for DynamoDB, so the rules are checked against what
 * ends up stored rather than against scripted replies:
 *   - save keeps a custom arena link only when the arena is the caller's own
 *   - read replaces the stored copy with the live arena, or flags it missing
 */

type Item = Record<string, any>;

const db: Item[] = [];
const keyOf = (item: Item) => `${item.PK}|${item.SK}`;
const find = (key: Item) => db.find((item) => keyOf(item) === keyOf(key));

const dynamoSend = vi.fn(async (command: any) => {
	const input = command.input;
	switch (command.constructor.name) {
		case "GetCommand": {
			const found = find(input.Key);
			return { Item: found ? structuredClone(found) : undefined };
		}
		case "PutCommand":
			db.push(structuredClone(input.Item));
			return {};
		case "QueryCommand": {
			const values = input.ExpressionAttributeValues;
			const matching = db.filter((item) => item.PK2 === values[":pk2"] && item.SK2 === values[":sk2"]);
			return { Items: matching.map((item) => structuredClone(item)) };
		}
		case "UpdateCommand": {
			const found = find(input.Key);
			if (!found) {
				throw Object.assign(new Error("conditional"), { name: "ConditionalCheckFailedException" });
			}
			const values = input.ExpressionAttributeValues;
			if (":arena" in values) found.arena = values[":arena"];
			if (":lastViewed" in values) found.lastViewed = values[":lastViewed"];
			return { Attributes: structuredClone(found) };
		}
		default:
			throw new Error(`unexpected command ${command.constructor.name}`);
	}
});

vi.mock("@aws-sdk/lib-dynamodb", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/lib-dynamodb")>();
	return { ...actual, DynamoDBDocumentClient: { from: () => ({ send: dynamoSend }) } };
});

vi.mock("@aws-sdk/client-dynamodb", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-dynamodb")>();
	return { ...actual, DynamoDBClient: vi.fn() };
});

process.env.mainTable = "team-builder-test-main";

const { handler: createTeamHandler } = await import("lambdas/createTeam/src/createTeam");
const { handler: updateTeamHandler } = await import("lambdas/updateTeam/src/updateTeam");
const { handler: getTeamHandler } = await import("lambdas/getTeam/src/getTeam");
const { handler: getPublicTeamHandler } = await import("lambdas/getPublicTeam/src/getPublicTeam");

const ME = "user-1";
const OTHER = "user-2";

const authed = (overrides: Record<string, any> = {}, sub = ME) => ({
	requestContext: { authorizer: { lambda: { sub, username: `${sub}-name` } } },
	pathParameters: {},
	body: null,
	...overrides,
});

const parseBody = (result: any) => JSON.parse(result.body);

const court = {
	version: 1,
	wood: "maple",
	paint: "#5a2d82",
	apron: null,
	lines: "#ffffff",
	centerLogo: "team",
	baselineText: "",
	sidelineText: "",
};

const arenaItem = (owner: string, arenaUUID: string, extra: Item = {}): Item => ({
	PK: `userUUID#${owner}`,
	SK: `customArena#${arenaUUID}`,
	entityType: "customArena",
	created: "2026-10-01T00:00:00.000Z",
	updated: "2026-10-01T00:00:00.000Z",
	arenaUUID,
	name: "Harbor Pavilion",
	location: "Seattle, Washington",
	capacity: 18600,
	openedYear: 2026,
	court,
	photoUrl: `https://cdn.example/arenas/${arenaUUID}/photo-1.jpg`,
	photoKey: `arenas/${arenaUUID}/photo-1.jpg`,
	createdBy: `${owner}-name`,
	...extra,
});

const builtIn = {
	name: "Climate Pledge Arena",
	location: "Seattle, Washington",
	capacity: 17100,
	openedYear: 1962,
	imgLink: "https://upload.wikimedia.org/x/500px-Climate.jpg",
};

const teamPayload = (arena: Item | null) => ({ title: "Sonics", roster: [], coach: null, gm: null, arena });

const create = (arena: Item | null, sub = ME) =>
	createTeamHandler(authed({ body: JSON.stringify(teamPayload(arena)) }, sub), {} as any, {} as any) as Promise<any>;

const storedTeam = (owner: string, teamUUID: string, arena: Item | null, extra: Item = {}): Item => ({
	PK: `userUUID#${owner}`,
	SK: `team#${teamUUID}`,
	PK2: `team#${teamUUID}`,
	SK2: "private",
	teamUUID,
	userUUID: owner,
	username: `${owner}-name`,
	title: "Sonics",
	roster: [],
	coach: null,
	gm: null,
	arena,
	public: false,
	...extra,
});

const storedArenaOf = (teamUUID: string) => db.find((item) => item.SK === `team#${teamUUID}`)?.arena;

beforeEach(() => {
	db.length = 0;
	dynamoSend.mockClear();
});

describe("saving a team's arena", () => {
	it("keeps a built-in arena's full details, without an extra read", async () => {
		const result = await create(builtIn);

		expect(result.statusCode).toBe(200);
		const { data } = parseBody(result);
		expect(storedArenaOf(data.teamUUID)).toEqual(builtIn);
		expect(data.arena).toEqual(builtIn);
		expect(dynamoSend.mock.calls.map(([c]) => c.constructor.name)).toEqual(["PutCommand"]);
	});

	it("links the caller's own arena, copying its details from the arena item", async () => {
		db.push(arenaItem(ME, "a1"));

		const result = await create({
			name: "Stale name",
			location: "Old city",
			capacity: 1,
			isCustom: true,
			arenaUUID: "a1",
			// Resolved fields a client might send back are never stored.
			photoUrl: "https://evil.example/x.jpg",
			court: { ...court, wood: "ebony" },
			missing: true,
		});

		const { data } = parseBody(result);
		expect(storedArenaOf(data.teamUUID)).toEqual({
			name: "Harbor Pavilion",
			location: "Seattle, Washington",
			capacity: 18600,
			openedYear: 2026,
			isCustom: true,
			arenaUUID: "a1",
		});
		// The response is already resolved, so the builder needs no refetch.
		expect(data.arena).toMatchObject({
			arenaUUID: "a1",
			court,
			photoUrl: "https://cdn.example/arenas/a1/photo-1.jpg",
		});
		const [get] = dynamoSend.mock.calls.map(([c]) => c.input);
		expect(get.Key).toEqual({ PK: `userUUID#${ME}`, SK: "customArena#a1" });
	});

	it("drops the link to someone else's arena (a remix) but keeps its details", async () => {
		db.push(arenaItem(OTHER, "b1"));

		const result = await create({
			name: "Harbor Pavilion",
			location: "Seattle, Washington",
			capacity: 18600,
			openedYear: 2026,
			isCustom: true,
			arenaUUID: "b1",
		});

		const { data } = parseBody(result);
		expect(storedArenaOf(data.teamUUID)).toEqual({
			name: "Harbor Pavilion",
			location: "Seattle, Washington",
			capacity: 18600,
			openedYear: 2026,
			isCustom: true,
		});
		expect(data.arena).not.toHaveProperty("photoUrl");
		expect(data.arena).not.toHaveProperty("court");
		// Only the caller's own partition was ever looked at.
		const gets = dynamoSend.mock.calls.filter(([c]) => c.constructor.name === "GetCommand");
		expect(gets.map(([c]) => c.input.Key.PK)).toEqual([`userUUID#${ME}`]);
	});

	it("drops the link to a deleted arena on update, keeping the text", async () => {
		db.push(storedTeam(ME, "t1", { name: "Gone", isCustom: true, arenaUUID: "a9", capacity: 500 }));

		const result: any = await updateTeamHandler(
			authed({
				body: JSON.stringify({
					...teamPayload({ name: "Gone", isCustom: true, arenaUUID: "a9", capacity: 500 }),
					teamUUID: "t1",
				}),
			}),
			{} as any,
			{} as any,
		);

		expect(result.statusCode).toBe(200);
		expect(storedArenaOf("t1")).toEqual({ name: "Gone", isCustom: true, capacity: 500 });
	});

	it("re-links on update when the arena is the caller's", async () => {
		db.push(storedTeam(ME, "t1", null), arenaItem(ME, "a1", { name: "Renamed" }));

		const result: any = await updateTeamHandler(
			authed({
				body: JSON.stringify({ ...teamPayload({ name: "x", isCustom: true, arenaUUID: "a1" }), teamUUID: "t1" }),
			}),
			{} as any,
			{} as any,
		);

		expect(result.statusCode).toBe(200);
		expect(storedArenaOf("t1")).toMatchObject({ name: "Renamed", arenaUUID: "a1" });
		expect(parseBody(result).data.arena.photoUrl).toBe("https://cdn.example/arenas/a1/photo-1.jpg");
	});

	it("rejects an arena ref with the wrong field types", async () => {
		for (const arena of [
			{ name: "" },
			{ name: "X", capacity: "19,200" },
			{ name: "X", openedYear: "2001" },
			{ name: "X", isCustom: "yes" },
			{ name: "X", arenaUUID: 7 },
			{ name: "X", location: 3 },
		]) {
			expect((await create(arena)).statusCode).toBe(400);
		}
		expect(db).toEqual([]);
	});
});

describe("reading a team's arena", () => {
	it("getTeam replaces the stored copy with the live arena", async () => {
		db.push(
			storedTeam(ME, "t1", { name: "Old name", location: "Old", capacity: 1, isCustom: true, arenaUUID: "a1" }),
			arenaItem(ME, "a1"),
		);

		const result: any = await getTeamHandler(authed({ pathParameters: { teamUUID: "t1" } }), {} as any, {} as any);

		expect(parseBody(result).data.arena).toEqual({
			name: "Harbor Pavilion",
			location: "Seattle, Washington",
			capacity: 18600,
			openedYear: 2026,
			isCustom: true,
			arenaUUID: "a1",
			court,
			photoUrl: "https://cdn.example/arenas/a1/photo-1.jpg",
		});
	});

	it("getTeam shows a deleted arena's details, with no photo or court", async () => {
		const stored = {
			name: "Harbor Pavilion",
			location: "Seattle, Washington",
			capacity: 18600,
			openedYear: 2026,
			isCustom: true,
			arenaUUID: "a1",
		};
		db.push(storedTeam(ME, "t1", stored));

		const result: any = await getTeamHandler(authed({ pathParameters: { teamUUID: "t1" } }), {} as any, {} as any);

		expect(parseBody(result).data.arena).toEqual({ ...stored, missing: true });
	});

	it("leaves a built-in arena as stored, without an extra read", async () => {
		db.push(storedTeam(ME, "t1", builtIn));

		const result: any = await getTeamHandler(authed({ pathParameters: { teamUUID: "t1" } }), {} as any, {} as any);

		expect(parseBody(result).data.arena).toEqual(builtIn);
		expect(dynamoSend).toHaveBeenCalledTimes(1);
	});

	it("getPublicTeam resolves through the owner's partition and exposes no owner id", async () => {
		db.push(
			storedTeam(OTHER, "t2", { name: "x", isCustom: true, arenaUUID: "b1" }, { SK2: "public", public: true }),
			arenaItem(OTHER, "b1"),
		);

		const result: any = await getPublicTeamHandler(
			{ requestContext: {}, pathParameters: { teamUUID: "t2" }, body: null },
			{} as any,
			{} as any,
		);

		expect(result.statusCode).toBe(200);
		const { data } = parseBody(result);
		expect(data.arena).toMatchObject({ name: "Harbor Pavilion", court, arenaUUID: "b1" });
		expect(data).not.toHaveProperty("userUUID");
		// `username` is deliberate attribution; the owner's id is never sent.
		expect(result.body).not.toMatch(new RegExp(`"${OTHER}"|/${OTHER}/`));
		for (const key of ["PK", "SK", "createdBy", "photoKey"]) {
			expect(data.arena).not.toHaveProperty(key);
		}
		const get = dynamoSend.mock.calls.find(([c]) => c.constructor.name === "GetCommand")![0];
		expect(get.input.Key).toEqual({ PK: `userUUID#${OTHER}`, SK: "customArena#b1" });
	});

	it("getPublicTeam marks a deleted arena missing", async () => {
		db.push(storedTeam(OTHER, "t2", { name: "Gone", isCustom: true, arenaUUID: "b9" }, { SK2: "public" }));

		const result: any = await getPublicTeamHandler(
			{ requestContext: {}, pathParameters: { teamUUID: "t2" }, body: null },
			{} as any,
			{} as any,
		);

		expect(parseBody(result).data.arena).toEqual({
			name: "Gone",
			isCustom: true,
			arenaUUID: "b9",
			missing: true,
		});
	});
});
