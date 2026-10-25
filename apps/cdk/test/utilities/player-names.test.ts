import { describe, it, expect } from "vitest";
import {
	exactName,
	indexByName,
	normalizeName,
	resolveMatch,
	type PoolPlayer,
} from "utilities/player-names";

const player = (
	id: string,
	first_name: string,
	last_name: string,
	{
		feet = 6,
		inches = 6,
		active = true,
	}: { feet?: number | null; inches?: number | null; active?: boolean } = {},
): PoolPlayer => ({
	id,
	first_name,
	last_name,
	height_feet: feet,
	height_inches: inches,
	active,
});

describe("normalizeName", () => {
	it("folds diacritics, periods and suffixes", () => {
		expect(normalizeName("Nikola Jokić")).toBe(normalizeName("Nikola Jokic"));
		expect(normalizeName("P.J. Washington")).toBe(normalizeName("PJ Washington"));
		expect(normalizeName("Tim Hardaway Jr.")).toBe(normalizeName("Tim Hardaway"));
		expect(exactName("Tim Hardaway Jr.")).not.toBe(exactName("Tim Hardaway"));
	});

	it("applies aliases", () => {
		expect(normalizeName("Penny Hardaway")).toBe("anfernee hardaway");
	});
});

describe("indexByName", () => {
	it("groups a family under one key and skips empty names", () => {
		const index = indexByName([
			player("hardati01", "Tim", "Hardaway"),
			player("hardati02", "Tim", "Hardaway Jr."),
			player("blank01", "", ""),
		]);
		expect(index.get("tim hardaway")?.map((p) => p.id)).toEqual([
			"hardati01",
			"hardati02",
		]);
		expect(index.has("")).toBe(false);
	});
});

describe("resolveMatch", () => {
	it("returns null for no candidates", () => {
		expect(
			resolveMatch([], { name: "Nobody", heightInches: 78, currentOnly: true }),
		).toBeNull();
	});

	it("settles father/son by suffix before height", () => {
		const father = player("ricegl01", "Glen", "Rice", { feet: 6, inches: 8 });
		const son = player("ricegl02", "Glen", "Rice Jr.", { feet: 6, inches: 7 });
		expect(
			resolveMatch([father, son], {
				name: "Glen Rice Jr.",
				heightInches: 80,
				currentOnly: false,
			}),
		).toBe(son);
	});

	it("prefers the one active candidate when currentOnly", () => {
		const retired = player("paytoga01", "Gary", "Payton", { active: false });
		const current = player("paytoga02", "Gary", "Payton");
		const query = { name: "Gary Payton", heightInches: null, currentOnly: true };
		expect(resolveMatch([retired, current], query)).toBe(current);
		expect(
			resolveMatch([retired, current], { ...query, currentOnly: false }),
		).toBeNull();
	});

	it("breaks remaining ties by height within 1 inch, else null", () => {
		const tall = player("smithjo01", "John", "Smith", { feet: 6, inches: 10 });
		const short = player("smithjo02", "John", "Smith", { feet: 6, inches: 2 });
		const query = { name: "John Smith", currentOnly: false };
		expect(resolveMatch([tall, short], { ...query, heightInches: 83 })).toBe(tall);
		expect(resolveMatch([tall, short], { ...query, heightInches: 78 })).toBeNull();
		expect(resolveMatch([tall, short], { ...query, heightInches: null })).toBeNull();
	});
});
