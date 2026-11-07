import { describe, it, expect } from "vitest";
import { toUniform, validateTeamData } from "../../utilities/team-validation";

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
        ["a NaN slot", { slot: NaN, player }],
        ["an array player", { slot: 0, player: [] }],
    ])("rejects a roster with %s", ([, entry]) => {
        expect(validateTeamData({ ...valid, roster: [entry] }).valid).toBe(false);
    });

    it("rejects a coach without isCustom", () => {
        expect(validateTeamData({ ...valid, coach: { name: "Phil" } }).valid).toBe(false);
    });

    it.for(["coach", "gm", "arena"])("rejects an array %s", (field) => {
        expect(validateTeamData({ ...valid, [field]: [] }).valid).toBe(false);
    });

    it("rejects an arena with a non-numeric capacity", () => {
        expect(
            validateTeamData({ ...valid, arena: { name: "X", capacity: "big" } }).valid,
        ).toBe(false);
    });
    it.for(["2d", "3d"])("accepts cardStyle %s", (cardStyle) => {
        expect(validateTeamData({ ...valid, cardStyle })).toEqual({ valid: true });
    });

    it.for(["4d", 3, null].map((cardStyle) => ({ cardStyle })))(
        "rejects cardStyle $cardStyle",
        ({ cardStyle }) => {
            expect(validateTeamData({ ...valid, cardStyle })).toEqual({
                valid: false,
                error: "cardStyle must be 2d or 3d",
            });
        },
    );

    const uniform = { primary: "#112233", secondary: "#AABBCC", trim: "#ffffff" };

    it("accepts a hex uniform and a null one", () => {
        expect(validateTeamData({ ...valid, uniform })).toEqual({ valid: true });
        expect(validateTeamData({ ...valid, uniform: null })).toEqual({ valid: true });
    });

    it.for([[], "red"].map((value) => ({ value })))("rejects uniform $value", ({ value }) => {
        expect(validateTeamData({ ...valid, uniform: value })).toEqual({
            valid: false,
            error: "uniform must be null or {primary, secondary, trim}",
        });
    });

    it.each([
        ["a missing trim", { primary: "#112233", secondary: "#112233" }, "trim"],
        ["a short hex", { ...uniform, primary: "#fff" }, "primary"],
        ["a colour name", { ...uniform, secondary: "blue" }, "secondary"],
    ])("rejects a uniform with %s", (_, value, field) => {
        expect(validateTeamData({ ...valid, uniform: value })).toEqual({
            valid: false,
            error: `uniform ${field} must be a #rrggbb colour`,
        });
    });

    it("keeps only the three colours of a uniform", () => {
        expect(toUniform({ ...uniform, extra: "x" })).toEqual(uniform);
    });
});
