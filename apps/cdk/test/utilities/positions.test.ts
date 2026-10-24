import { describe, expect, it } from "vitest";
import { nbaPositions } from "../../utilities/positions";

describe("nbaPositions", () => {
	it("drops 2K's placeholders and keeps the order", () => {
		expect(nbaPositions(["SG", "N"])).toEqual(["SG"]);
		expect(nbaPositions(["PG", "S"])).toEqual(["PG"]);
		expect(nbaPositions(["C", "PF"])).toEqual(["C", "PF"]);
	});

	it("drops anything that isn't a position string", () => {
		expect(nbaPositions(["pg", "", 3, null, "SF"])).toEqual(["SF"]);
		expect(nbaPositions(["N"])).toEqual([]);
	});
});
