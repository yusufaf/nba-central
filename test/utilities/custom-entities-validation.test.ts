import { describe, it, expect } from "vitest";
import {
    validateGMData,
    validateCoachData,
    validatePlayerData,
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
