import { describe, it, expect } from "vitest";
import { validateTeamData } from "../../utilities/team-validation";

describe("validateTeamData", () => {
    const player = { fullName: "Gary Payton" };
    const valid = { title: "Sonics", roster: [{ slot: 0, player }] };

    it("accepts a minimal team", () => {
        expect(validateTeamData(valid)).toEqual({ valid: true });
    });

    it("accepts null and linked coach, gm and arena refs", () => {
        expect(
            validateTeamData({
                ...valid,
                coach: null,
                gm: { name: "Pat", isCustom: false },
                arena: null,
            }),
        ).toEqual({ valid: true });
    });

    it.for([null, 42, "Sonics", []].map((body) => ({ body })))(
        "rejects a non-object body ($body)",
        ({ body }) => {
            expect(validateTeamData(body)).toEqual({
                valid: false,
                error: "Invalid request body",
            });
        },
    );

    it("rejects a blank title", () => {
        expect(validateTeamData({ ...valid, title: "   " }).valid).toBe(false);
    });

    it("rejects a title over 100 chars", () => {
        expect(validateTeamData({ ...valid, title: "x".repeat(101) }).valid).toBe(false);
    });

    it("rejects a roster that is not an array", () => {
        expect(validateTeamData({ ...valid, roster: "x" }).valid).toBe(false);
    });

    it.for([
        ["a null entry", null],
        ["a string slot", { slot: "0", player }],
        ["an empty fullName", { slot: 0, player: { fullName: "" } }],
    ])("rejects a roster with %s", ([, entry]) => {
        expect(validateTeamData({ ...valid, roster: [entry] }).valid).toBe(false);
    });

    it("rejects a coach without isCustom", () => {
        expect(validateTeamData({ ...valid, coach: { name: "Phil" } }).valid).toBe(false);
    });

    it("rejects an arena with a non-numeric capacity", () => {
        expect(
            validateTeamData({ ...valid, arena: { name: "X", capacity: "big" } }).valid,
        ).toBe(false);
    });
});
