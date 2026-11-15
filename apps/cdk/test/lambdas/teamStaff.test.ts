import { describe, it, expect, vi, beforeEach } from "vitest";

/*
 * How a team's coach and GM are stored and read back (#294), against the same
 * in-memory main table as teamArenas.test.ts:
 *   - save keeps a custom link only for the caller's own item, under `uuid`
 *     whatever name the client sent it as, and never stores a look
 *   - read returns the live item's name and look, or the stored ref when the
 *     item is gone (a figurine)
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
			if (":coach" in values) found.coach = values[":coach"];
			if (":gm" in values) found.gm = values[":gm"];
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
// Nothing the public reader returns may contain this string (test l), so the
// other owner's fixtures never reuse it in a name, username or uuid.
const OTHER = "owner-b";

const authed = (overrides: Record<string, any> = {}, sub = ME) => ({
	requestContext: { authorizer: { lambda: { sub, username: "someone" } } },
	pathParameters: {},
	body: null,
	...overrides,
});

const parseBody = (result: any) => JSON.parse(result.body);

const STAFF_LOOK = {
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

const coachItem = (owner: string, coachUUID: string, extra: Item = {}): Item => ({
	PK: `userUUID#${owner}`,
	SK: `customCoach#${coachUUID}`,
	entityType: "customCoach",
	created: "2026-11-01T00:00:00.000Z",
	updated: "2026-11-01T00:00:00.000Z",
	coachUUID,
	name: "Coach Vega",
	overallRating: 80,
	specialty: "Balanced",
	appearance: STAFF_LOOK,
	createdBy: "Bea",
	...extra,
});

const gmItem = (owner: string, gmUUID: string, extra: Item = {}): Item => ({
	PK: `userUUID#${owner}`,
	SK: `customGM#${gmUUID}`,
	entityType: "customGM",
	created: "2026-11-01T00:00:00.000Z",
	updated: "2026-11-01T00:00:00.000Z",
	gmUUID,
	name: "Exec Ortiz",
	teams: ["SEA"],
	appearance: { ...STAFF_LOOK, outfit: { style: "suit", primary: "#1d2a44", secondary: "#c9a227" } },
	createdBy: "Bea",
	...extra,
});

const teamPayload = (coach: unknown, gm: unknown = null) => ({ title: "Sonics", roster: [], coach, gm, arena: null });

const create = (payload: Item, sub = ME) =>
	createTeamHandler(authed({ body: JSON.stringify(payload) }, sub), {} as any, {} as any) as Promise<any>;

const getTeam = (teamUUID: string) =>
	getTeamHandler(authed({ pathParameters: { teamUUID } }), {} as any, {} as any) as Promise<any>;

const storedTeam = (owner: string, teamUUID: string, coach: unknown, gm: unknown = null, extra: Item = {}): Item => ({
	PK: `userUUID#${owner}`,
	SK: `team#${teamUUID}`,
	PK2: `team#${teamUUID}`,
	SK2: "private",
	teamUUID,
	userUUID: owner,
	username: "Bea",
	title: "Sonics",
	roster: [],
	coach,
	gm,
	arena: null,
	public: false,
	...extra,
});

const storedOf = (teamUUID: string) => db.find((item) => item.SK === `team#${teamUUID}`)!;
const commandNames = () => dynamoSend.mock.calls.map(([c]) => c.constructor.name);
const getKeys = () =>
	dynamoSend.mock.calls.filter(([c]) => c.constructor.name === "GetCommand").map(([c]) => c.input.Key);

beforeEach(() => {
	db.length = 0;
	dynamoSend.mockClear();
});

describe("saving a team's coach and GM", () => {
	it("(a) stores a real coach as its name, without an extra read", async () => {
		const result = await create(teamPayload({ name: "Phil Jackson", isCustom: false, overallRating: 99 }));

		expect(result.statusCode).toBe(200);
		const { data } = parseBody(result);
		expect(storedOf(data.teamUUID).coach).toEqual({ name: "Phil Jackson", isCustom: false });
		expect(data.coach).toEqual({ name: "Phil Jackson", isCustom: false });
		expect(commandNames()).toEqual(["PutCommand"]);
	});

	it("(b) links the caller's own coach, copies its name and returns its look, storing no look", async () => {
		db.push(coachItem(ME, "c1"));

		const result = await create(
			teamPayload({
				name: "Stale name",
				isCustom: true,
				uuid: "c1",
				appearance: { ...STAFF_LOOK, ageLook: "young" },
				overallRating: 1,
				PK: "userUUID#someone-else",
			}),
		);

		const { data } = parseBody(result);
		expect(storedOf(data.teamUUID).coach).toEqual({ name: "Coach Vega", isCustom: true, uuid: "c1" });
		expect(data.coach).toEqual({ name: "Coach Vega", isCustom: true, uuid: "c1", appearance: STAFF_LOOK });
		expect(getKeys()).toEqual([{ PK: `userUUID#${ME}`, SK: "customCoach#c1" }]);
	});

	it("(c) reads a coachUUID the same as uuid, and stores it as uuid", async () => {
		db.push(coachItem(ME, "c1"));

		const { data } = parseBody(await create(teamPayload({ name: "Coach Vega", isCustom: true, coachUUID: "c1" })));

		expect(storedOf(data.teamUUID).coach).toEqual({ name: "Coach Vega", isCustom: true, uuid: "c1" });
		expect(data.coach.appearance).toEqual(STAFF_LOOK);
	});

	it("(d) drops the link to someone else's coach (a remix) but keeps its name", async () => {
		db.push(coachItem(OTHER, "b1"));

		const { data } = parseBody(await create(teamPayload({ name: "Coach Vega", isCustom: true, uuid: "b1" })));

		expect(storedOf(data.teamUUID).coach).toEqual({ name: "Coach Vega", isCustom: true });
		expect(data.coach).toEqual({ name: "Coach Vega", isCustom: true });
		expect(getKeys().map((key) => key.PK)).toEqual([`userUUID#${ME}`]);
	});

	it("(e) drops the link to a deleted GM on update", async () => {
		db.push(storedTeam(ME, "t1", null, { name: "Gone GM", isCustom: true, uuid: "g9" }));

		const result: any = await updateTeamHandler(
			authed({
				body: JSON.stringify({ ...teamPayload(null, { name: "Gone GM", isCustom: true, uuid: "g9" }), teamUUID: "t1" }),
			}),
			{} as any,
			{} as any,
		);

		expect(result.statusCode).toBe(200);
		expect(storedOf("t1").gm).toEqual({ name: "Gone GM", isCustom: true });
		expect(parseBody(result).data.gm).toEqual({ name: "Gone GM", isCustom: true });
	});

	it("(f) looks a GM up under customGM#, and links it on update", async () => {
		db.push(storedTeam(ME, "t1", null), gmItem(ME, "g1"));

		const result: any = await updateTeamHandler(
			authed({
				body: JSON.stringify({ ...teamPayload(null, { name: "x", isCustom: true, gmUUID: "g1" }), teamUUID: "t1" }),
			}),
			{} as any,
			{} as any,
		);

		expect(getKeys()).toEqual([{ PK: `userUUID#${ME}`, SK: "customGM#g1" }]);
		expect(storedOf("t1").gm).toEqual({ name: "Exec Ortiz", isCustom: true, uuid: "g1" });
		expect(parseBody(result).data.gm.appearance.outfit.style).toBe("suit");
	});
});

describe("reading a team's coach and GM", () => {
	it("(g) getTeam returns the live coach's name and look", async () => {
		db.push(storedTeam(ME, "t1", { name: "Old name", isCustom: true, uuid: "c1" }), coachItem(ME, "c1"));

		const { data } = parseBody(await getTeam("t1"));

		expect(data.coach).toEqual({ name: "Coach Vega", isCustom: true, uuid: "c1", appearance: STAFF_LOOK });
	});

	it("(h) a look edited after the save comes back on the next read", async () => {
		db.push(storedTeam(ME, "t1", { name: "Coach Vega", isCustom: true, uuid: "c1" }), coachItem(ME, "c1"));
		expect(parseBody(await getTeam("t1")).data.coach.appearance.outfit.style).toBe("tracksuit");

		const item = db.find((row) => row.SK === "customCoach#c1")!;
		item.appearance = { ...STAFF_LOOK, outfit: { style: "polo", primary: "#00471b", secondary: "#eee1c6" } };
		item.name = "Coach Vega Sr.";

		const { data } = parseBody(await getTeam("t1"));
		expect(data.coach.appearance.outfit.style).toBe("polo");
		expect(data.coach.name).toBe("Coach Vega Sr.");
	});

	it("(i) a deleted coach comes back as its stored ref, with no look", async () => {
		db.push(storedTeam(ME, "t1", { name: "Coach Vega", isCustom: true, uuid: "c1" }));

		const { data } = parseBody(await getTeam("t1"));

		expect(data.coach).toEqual({ name: "Coach Vega", isCustom: true, uuid: "c1" });
	});

	it("(j) a legacy raw row's stray keys and look never leave", async () => {
		db.push(
			storedTeam(ME, "t1", {
				name: "Coach Vega",
				isCustom: true,
				uuid: "c1",
				appearance: STAFF_LOOK,
				overallRating: 9,
			}),
		);

		const { data } = parseBody(await getTeam("t1"));

		expect(data.coach).toEqual({ name: "Coach Vega", isCustom: true, uuid: "c1" });
	});

	it("(k) real staff cost no extra read", async () => {
		db.push(
			storedTeam(ME, "t1", { name: "Phil Jackson", isCustom: false }, { name: "Jerry Krause", isCustom: false }),
		);

		const { data } = parseBody(await getTeam("t1"));

		expect(data.coach).toEqual({ name: "Phil Jackson", isCustom: false });
		expect(data.gm).toEqual({ name: "Jerry Krause", isCustom: false });
		expect(dynamoSend).toHaveBeenCalledTimes(1);
	});

	it("(l) getPublicTeam resolves through the owner's partition and exposes no owner id", async () => {
		db.push(
			storedTeam(
				OTHER,
				"t2",
				{ name: "x", isCustom: true, uuid: "b1" },
				{ name: "y", isCustom: true, uuid: "b2" },
				{ SK2: "public", public: true },
			),
			coachItem(OTHER, "b1"),
			gmItem(OTHER, "b2"),
		);

		const result: any = await getPublicTeamHandler(
			{ requestContext: {}, pathParameters: { teamUUID: "t2" }, body: null },
			{} as any,
			{} as any,
		);

		expect(result.statusCode).toBe(200);
		const { data } = parseBody(result);
		expect(data.coach).toEqual({ name: "Coach Vega", isCustom: true, uuid: "b1", appearance: STAFF_LOOK });
		expect(data.gm).toMatchObject({ name: "Exec Ortiz", uuid: "b2" });
		for (const key of ["PK", "SK", "createdBy", "overallRating", "teams"]) {
			expect(data.coach).not.toHaveProperty(key);
			expect(data.gm).not.toHaveProperty(key);
		}
		expect(data).not.toHaveProperty("userUUID");
		expect(result.body).not.toContain(OTHER);
		expect(getKeys()).toEqual(
			expect.arrayContaining([
				{ PK: `userUUID#${OTHER}`, SK: "customCoach#b1" },
				{ PK: `userUUID#${OTHER}`, SK: "customGM#b2" },
			]),
		);
	});

	it("(m) a team with no coach or GM key reads back as null on create and on getTeam", async () => {
		const result = await create({ title: "Sonics", roster: [], arena: null });

		expect(result.statusCode).toBe(200);
		const { data } = parseBody(result);
		expect(data.coach).toBeNull();
		expect(data.gm).toBeNull();

		const read = parseBody(await getTeam(data.teamUUID)).data;
		expect(read.coach).toBeNull();
		expect(read.gm).toBeNull();
	});
});
