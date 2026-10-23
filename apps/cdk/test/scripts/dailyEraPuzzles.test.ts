import { describe, it, expect, vi } from "vitest";
import {
	answerSeasonsForRow,
	buildGroup,
	buildPuzzleEntry,
	eraTeamName,
	exclusionReason,
	findIdentityCollisions,
	forbiddenIdTokens,
	formatRunLabel,
	groupTwins,
	isOpaqueId,
	isPresentRow,
	jerseyIdentity,
	mediaIdFromJerseyUrl,
	newImageKey,
	newPuzzleId,
	parsePuzzleList,
	planAppend,
	seasonEndYearFromLabel,
	seededShuffle,
	selectPoolRows,
	type PoolRow,
} from "../../scripts/lib/dailyEraPuzzles";
import type { DailyEraPuzzle } from "../../models/daily-era";

const CDN = "https://d2s6ea2hcvgd9x.cloudfront.net/jerseys/historical";

const row = (overrides: Partial<PoolRow> = {}): PoolRow => ({
	franchise: "MEM",
	franchiseName: "Memphis Grizzlies",
	name: "Vancouver Grizzlies 1995-2000 Home and Road Jersey",
	league: "NBA",
	slot: "home-road",
	startYear: 1996,
	endYear: 1999,
	years: "1995-96 – 1998-99",
	seasons: ["1995-96", "1997-98", "1998-99"],
	jersey: `${CDN}/31d308_d7be6e06a283493ea15be25ca7e6bd3a.avif`,
	...overrides,
});

const hornets = row({
	franchise: "NOH",
	franchiseName: "New Orleans Pelicans",
	name: "New Orleans/Oklahoma City Hornets 2005-2007 Home and Road Jersey",
	startYear: 2006,
	endYear: 2007,
	seasons: [],
	jersey: `${CDN}/31d308_aaaa.avif`,
});

const withSeasons = (mediaId: string, endYears: number[], overrides: Partial<PoolRow> = {}) =>
	row({
		startYear: endYears[0],
		endYear: endYears[endYears.length - 1],
		seasons: endYears.map((y) => `${y - 1}-${String(y).slice(-2)}`),
		jersey: `${CDN}/31d308_${mediaId}.avif`,
		...overrides,
	});

// A byte source that hands out the given base64url strings in order.
const stubBytes = (...draws: string[]) => {
	const source = vi.fn((_n: number) => Buffer.from(draws[Math.min(source.mock.calls.length - 1, draws.length - 1)], "base64url"));
	return source;
};

describe("selectPoolRows / isPresentRow", () => {
	it("keeps home/road rows that have a franchise", () => {
		const rows = [row(), row({ slot: "alternate" }), row({ franchise: "" })];
		expect(selectPoolRows(rows)).toEqual([rows[0]]);
	});

	it("spots rows still in use", () => {
		expect(isPresentRow(row({ name: "Miami Heat 2015-Present Home and Road Jersey" }))).toBe(true);
		expect(isPresentRow(row())).toBe(false);
	});
});

describe("jersey identity", () => {
	it("takes the Wix media id from the image URL", () => {
		expect(mediaIdFromJerseyUrl(row().jersey)).toBe("31d308_d7be6e06a283493ea15be25ca7e6bd3a");
		expect(mediaIdFromJerseyUrl("https://example.com/jerseys/bad-id!.avif")).toBeNull();
		expect(jerseyIdentity(row())).toEqual({
			franchise: "MEM",
			name: "Vancouver Grizzlies 1995-2000 Home and Road Jersey",
			startYear: 1996,
			mediaId: "31d308_d7be6e06a283493ea15be25ca7e6bd3a",
		});
	});

	it("reports two rows sharing a media id", () => {
		expect(findIdentityCollisions([row(), row({ name: "Other" })])).toHaveLength(1);
	});

	it("allows the same name and start year with different images", () => {
		expect(findIdentityCollisions([row(), row({ jersey: `${CDN}/31d308_other.avif` })])).toEqual([]);
	});

	it("reports a row whose URL has no media id", () => {
		expect(findIdentityCollisions([row({ jersey: "not a url" })])).toHaveLength(1);
	});
});

describe("answer seasons", () => {
	it("converts season labels to ending years", () => {
		expect(seasonEndYearFromLabel("1999-00")).toBe(2000);
		expect(seasonEndYearFromLabel("1995-96")).toBe(1996);
	});

	it("uses the listed seasons, gaps included", () => {
		expect(answerSeasonsForRow(row())).toEqual([1996, 1998, 1999]);
	});

	it("falls back to the start-end span when no seasons are listed", () => {
		expect(answerSeasonsForRow(row({ seasons: [], startYear: 1971, endYear: 1973 }))).toEqual([1971, 1972, 1973]);
	});

	it("labels each contiguous run", () => {
		expect(formatRunLabel([1996, 1998, 1999])).toBe("1995-96, 1997-98 – 1998-99");
		expect(formatRunLabel([2000])).toBe("1999-00");
	});
});

describe("eraTeamName", () => {
	it("reads the team name before the years", () => {
		expect(eraTeamName(row().name)).toBe("Vancouver Grizzlies");
		expect(eraTeamName(hornets.name)).toBe("New Orleans/Oklahoma City Hornets");
		expect(eraTeamName("No Year Jersey")).toBeNull();
	});
});

describe("groupTwins", () => {
	const cand = (key: string, franchise = "MEM") => ({ key, franchise, item: key });

	it("merges chains of twins", () => {
		const twins = new Set(["A|B", "B|C"]);
		const isTwin = (a: string, b: string) => twins.has(`${a}|${b}`) || twins.has(`${b}|${a}`);
		expect(groupTwins([cand("C"), cand("A"), cand("B"), cand("D")], isTwin)).toEqual([["A", "B", "C"], ["D"]]);
	});

	it("never compares jerseys across franchises", () => {
		const isTwin = vi.fn(() => true);
		expect(groupTwins([cand("A", "MEM"), cand("B", "OKC")], isTwin)).toEqual([["A"], ["B"]]);
		expect(isTwin).not.toHaveBeenCalled();
	});
});

describe("buildGroup", () => {
	it("shows the earliest jersey and accepts every member's seasons", () => {
		const later = withSeasons("later", [2001, 2002]);
		const earlier = withSeasons("earlier", [1996, 1997]);
		const group = buildGroup([later, earlier]);
		expect(group.shown).toBe(earlier);
		expect(group.answerSeasons).toEqual([1996, 1997, 2001, 2002]);
	});
});

describe("exclusionReason", () => {
	const group = buildGroup([withSeasons("g", [1990, 1991])]);

	it("excludes a group with a jersey still in use", () => {
		const present = withSeasons("p", [2020], { name: "Memphis Grizzlies 2018-Present Home and Road Jersey" });
		expect(exclusionReason(buildGroup([present]), [present])).not.toBeNull();
	});

	it("excludes a group within 3 seasons of an unsafe jersey of the same franchise", () => {
		expect(exclusionReason(group, [withSeasons("d", [1994])])).not.toBeNull();
	});

	it("keeps a group 4 seasons away", () => {
		expect(exclusionReason(group, [withSeasons("d", [1995])])).toBeNull();
	});

	it("ignores other franchises", () => {
		expect(exclusionReason(group, [withSeasons("d", [1990], { franchise: "OKC" })])).toBeNull();
	});
});

describe("seededShuffle", () => {
	const items = [...Array(20).keys()];

	it("is a repeatable permutation", () => {
		const once = seededShuffle(items, 174);
		expect(seededShuffle(items, 174)).toEqual(once);
		expect([...once].sort((a, b) => a - b)).toEqual(items);
		expect(seededShuffle(items, 175)).not.toEqual(once);
	});

	// refresh-daily-era appends in this order to a list that is never
	// rewritten, so the generator must not change underneath it.
	it("keeps its exact order", () => {
		expect(seededShuffle(items, 174)).toEqual([4, 8, 1, 9, 10, 6, 19, 18, 0, 17, 11, 5, 2, 16, 7, 15, 3, 14, 13, 12]);
	});
});

describe("parsePuzzleList", () => {
	const identity = jerseyIdentity(row());
	const entry: DailyEraPuzzle = {
		puzzleId: "abcdefghijkl",
		imageKey: "daily-era/abcdefghijklmnop.webp",
		answerSeasons: [1996, 1998],
		runLabel: "1995-96, 1997-98",
		franchise: "MEM",
		teamName: "Vancouver Grizzlies",
		identities: [identity],
		shownIdentity: identity,
	};

	it("round-trips a valid list", () => {
		expect(parsePuzzleList(JSON.parse(JSON.stringify([entry])))).toEqual([entry]);
	});

	it("rejects an entry missing a field", () => {
		const { imageKey: _imageKey, ...rest } = entry;
		expect(() => parsePuzzleList([rest])).toThrow(/imageKey/);
	});

	it("rejects anything but an array", () => {
		expect(() => parsePuzzleList({})).toThrow();
	});

	it("rejects an entry with no answer seasons", () => {
		expect(() => parsePuzzleList([{ ...entry, answerSeasons: [] }])).toThrow(/answerSeasons/);
	});

	it("rejects answer seasons out of order", () => {
		expect(() => parsePuzzleList([{ ...entry, answerSeasons: [1998, 1996] }])).toThrow(/answerSeasons/);
		expect(() => parsePuzzleList([{ ...entry, answerSeasons: [1996, 1996] }])).toThrow(/answerSeasons/);
	});

	it("rejects a puzzleId used twice", () => {
		expect(() => parsePuzzleList([entry, { ...entry }])).toThrow(/entry 1.*abcdefghijkl/);
	});
});

describe("planAppend", () => {
	const a = withSeasons("a", [1990]);
	const b = withSeasons("b", [1991]);
	const c = withSeasons("c", [2000]);
	const published: DailyEraPuzzle = {
		...buildPuzzleEntry(buildGroup([a]), { puzzleId: "pub", imageKey: "daily-era/x.webp" }),
	};

	it("skips a group that is already published", () => {
		const plan = planAppend([published], [buildGroup([a])]);
		expect(plan).toEqual({ toAppend: [], alreadyPublished: 1, twinsOfPublished: [] });
	});

	it("reports, but does not append, a new twin of a published jersey", () => {
		const plan = planAppend([published], [buildGroup([a, b])]);
		expect(plan.toAppend).toEqual([]);
		expect(plan.twinsOfPublished).toEqual([{ identity: jerseyIdentity(b), puzzleId: "pub" }]);
	});

	it("appends a group with nothing published", () => {
		const group = buildGroup([c]);
		expect(planAppend([published], [group]).toAppend).toEqual([group]);
	});
});

describe("opaque ids", () => {
	const forbidden = ["lal", "heat"];

	it("rejects ids that spell a year or a team", () => {
		expect(isOpaqueId("AAAA1999AAAAAAAA", forbidden)).toBe(false);
		expect(isOpaqueId("xxLaLxxxxxxxxxxx", forbidden)).toBe(false);
		expect(isOpaqueId("xxHEATxxxxxxxxxx", forbidden)).toBe(false);
		expect(isOpaqueId("AbCd_-123xyzQwEr", forbidden)).toBe(true);
	});

	it("forbids current codes, era codes passed in and era nicknames", () => {
		const tokens = forbiddenIdTokens([row(), hornets], ["VAN"]);
		expect(tokens).toEqual(expect.arrayContaining(["mem", "van", "grizzlies", "noh", "hornets"]));
		expect(forbiddenIdTokens([row(), hornets])).not.toContain("van");
	});

	it("redraws an id that spells a year", () => {
		const bytes = stubBytes("AAAA1999AAAAAAAA", "AbCd_-123xyzQwEr");
		expect(newImageKey(forbidden, bytes)).toBe("daily-era/AbCd_-123xyzQwEr.webp");
		expect(bytes).toHaveBeenCalledTimes(2);
	});

	it("gives up rather than loop forever", () => {
		expect(() => newImageKey(forbidden, stubBytes("AAAA1999AAAAAAAA"))).toThrow();
	});

	it("draws keys that carry nothing about the answer", () => {
		const tokens = forbiddenIdTokens([row(), hornets], ["VAN"]);
		const keys = Array.from({ length: 100 }, () => newImageKey(tokens));
		expect(new Set(keys).size).toBe(100);
		for (const key of keys) {
			expect(key).toMatch(/^daily-era\/[A-Za-z0-9_-]{16}\.webp$/);
			expect(isOpaqueId(key.slice("daily-era/".length, -".webp".length), tokens)).toBe(true);
		}
		expect(newPuzzleId(tokens)).toMatch(/^[A-Za-z0-9_-]{12}$/);
	});
});

describe("buildPuzzleEntry", () => {
	const earlier = withSeasons("earlier", [1996, 1997]);
	const later = withSeasons("later", [1999]);
	const entry = buildPuzzleEntry(buildGroup([later, earlier]), {
		puzzleId: "pid",
		imageKey: "daily-era/key.webp",
	});

	it("describes the jersey shown and the seasons accepted", () => {
		expect(entry.shownIdentity).toEqual(jerseyIdentity(earlier));
		expect(entry.identities).toEqual([jerseyIdentity(later), jerseyIdentity(earlier)]);
		expect(entry.answerSeasons).toEqual([1996, 1997, 1999]);
		expect(entry.runLabel).toBe("1995-96 – 1996-97, 1998-99");
		expect(entry.teamName).toBe("Vancouver Grizzlies");
		expect(entry.franchise).toBe("MEM");
	});

	it("carries no image URL", () => {
		expect(entry).not.toHaveProperty("jersey");
		expect(entry.shownIdentity).not.toHaveProperty("jersey");
		for (const identity of entry.identities) expect(identity).not.toHaveProperty("jersey");
		const json = JSON.stringify(entry);
		for (const leak of ["cloudfront", ".avif", "http"]) expect(json).not.toContain(leak);
	});
});
