import { describe, it, expect } from "vitest";
import {
    validateGMData,
    validateCoachData,
    validatePlayerData,
    validateArenaData,
} from "../../utilities/custom-entities-validation";

describe("validateGMData", () => {
    it("accepts a valid GM", () => {
        expect(validateGMData({ name: "Pat Riley", teams: ["LAL", "MIA"] })).toEqual({
            valid: true,
        });
    });

    it("accepts a GM with no teams", () => {
        expect(validateGMData({ name: "Solo" })).toEqual({ valid: true });
    });

    it("rejects a missing name", () => {
        expect(validateGMData({}).valid).toBe(false);
    });

    it.for([null, 42, "Pat", []].map((body) => ({ body })))(
        "rejects a non-object body ($body)",
        ({ body }) => {
            expect(validateGMData(body)).toEqual({
                valid: false,
                error: "Invalid request body",
            });
        },
    );

    it("rejects a name over 100 chars", () => {
        expect(validateGMData({ name: "x".repeat(101) }).valid).toBe(false);
    });

    it("rejects non-array teams", () => {
        expect(validateGMData({ name: "A", teams: "LAL" }).valid).toBe(false);
    });

    it("rejects a team code of wrong length", () => {
        expect(validateGMData({ name: "A", teams: ["L"] }).valid).toBe(false);
    });

    it("rejects a lowercase team code", () => {
        expect(validateGMData({ name: "A", teams: ["lal"] }).valid).toBe(false);
    });
});

describe("validateCoachData", () => {
    const valid = { name: "Phil", overallRating: 90, specialty: "Balanced" };

    it("accepts a valid coach", () => {
        expect(validateCoachData(valid)).toEqual({ valid: true });
    });

    it.for([null, 42, "Phil", []].map((body) => ({ body })))(
        "rejects a non-object body ($body)",
        ({ body }) => {
            expect(validateCoachData(body)).toEqual({
                valid: false,
                error: "Invalid request body",
            });
        },
    );

    it("rejects a non-number rating", () => {
        expect(validateCoachData({ ...valid, overallRating: "90" }).valid).toBe(
            false,
        );
    });

    it("rejects an out-of-range rating", () => {
        expect(validateCoachData({ ...valid, overallRating: 100 }).valid).toBe(
            false,
        );
    });

    it("rejects an invalid specialty", () => {
        expect(validateCoachData({ ...valid, specialty: "Wizardry" }).valid).toBe(
            false,
        );
    });
});

describe("validatePlayerData", () => {
    const valid = {
        name: "LeBron",
        position: "SF",
        heightFeet: 6,
        heightInches: 9,
        weightPounds: 250,
        overallRating: 96,
    };

    it("accepts a valid player", () => {
        expect(validatePlayerData(valid)).toEqual({ valid: true });
    });

    it.for([null, 42, "LeBron", []].map((body) => ({ body })))(
        "rejects a non-object body ($body)",
        ({ body }) => {
            expect(validatePlayerData(body)).toEqual({
                valid: false,
                error: "Invalid request body",
            });
        },
    );

    it("rejects an invalid position", () => {
        expect(validatePlayerData({ ...valid, position: "QB" }).valid).toBe(false);
    });

    it("rejects out-of-range height (feet)", () => {
        expect(validatePlayerData({ ...valid, heightFeet: 9 }).valid).toBe(false);
    });

    it("rejects out-of-range height (inches)", () => {
        expect(validatePlayerData({ ...valid, heightInches: 12 }).valid).toBe(
            false,
        );
    });

    it("rejects out-of-range weight", () => {
        expect(validatePlayerData({ ...valid, weightPounds: 50 }).valid).toBe(
            false,
        );
    });

    it("rejects out-of-range rating", () => {
        expect(validatePlayerData({ ...valid, overallRating: 120 }).valid).toBe(
            false,
        );
    });
});

describe("validateArenaData", () => {
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
    const valid = {
        name: "Harbor Pavilion",
        location: "Seattle, Washington",
        capacity: 18600,
        openedYear: 2026,
        court: null,
    };

    it("accepts a valid arena, with or without a court", () => {
        expect(validateArenaData(valid)).toEqual({ valid: true });
        expect(validateArenaData({ ...valid, court })).toEqual({ valid: true });
    });

    it("accepts an empty location and no capacity or opened year", () => {
        expect(
            validateArenaData({ ...valid, location: "", capacity: null, openedYear: null }),
        ).toEqual({ valid: true });
    });

    it("rejects a missing, blank or over-long name", () => {
        expect(validateArenaData({ ...valid, name: undefined }).valid).toBe(false);
        expect(validateArenaData({ ...valid, name: "   " }).valid).toBe(false);
        expect(validateArenaData({ ...valid, name: "x".repeat(61) }).valid).toBe(false);
        expect(validateArenaData({ ...valid, name: "x".repeat(60) }).valid).toBe(true);
    });

    it("rejects a non-string or over-long location", () => {
        expect(validateArenaData({ ...valid, location: 7 }).valid).toBe(false);
        expect(validateArenaData({ ...valid, location: "x".repeat(61) }).valid).toBe(false);
    });

    it("takes capacity as a whole number from 1 to 200,000", () => {
        for (const capacity of [0, 200_001, 1.5, "18600", Number.NaN]) {
            expect(validateArenaData({ ...valid, capacity }).valid).toBe(false);
        }
        for (const capacity of [1, 200_000]) {
            expect(validateArenaData({ ...valid, capacity }).valid).toBe(true);
        }
    });

    it("takes the opened year from 1850 to 2100, future years included", () => {
        for (const openedYear of [1849, 2101, 2026.5, "2026"]) {
            expect(validateArenaData({ ...valid, openedYear }).valid).toBe(false);
        }
        for (const openedYear of [1850, 2100]) {
            expect(validateArenaData({ ...valid, openedYear }).valid).toBe(true);
        }
    });

    it("checks every court setting", () => {
        const bad = [
            { version: 2 },
            { wood: "oak" },
            { paint: "purple" },
            { paint: "#fff" },
            { apron: "#12345g" },
            { lines: null },
            { centerLogo: "both" },
            { baselineText: "x".repeat(21) },
            { sidelineText: "x".repeat(25) },
            { sidelineText: 4 },
            { paint: ["#5a2d82"] },
            { lines: ["#ffffff"] },
        ];
        for (const override of bad) {
            expect(validateArenaData({ ...valid, court: { ...court, ...override } }).valid).toBe(
                false,
            );
        }
        expect(validateArenaData({ ...valid, court: "maple" }).valid).toBe(false);
    });
});
