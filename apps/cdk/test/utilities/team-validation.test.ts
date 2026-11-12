import { describe, it, expect } from "vitest";
import { toRoster, toUniform, validateTeamData } from "../../utilities/team-validation";

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

    it.for(["0", "00", "7", "23", "99"])("accepts roster number %s", (number) => {
        expect(validateTeamData({ ...valid, roster: [{ slot: 0, player, number }] })).toEqual({
            valid: true,
        });
    });

    it("accepts a null or absent roster number", () => {
        expect(validateTeamData({ ...valid, roster: [{ slot: 0, player, number: null }] })).toEqual({
            valid: true,
        });
        expect(validateTeamData(valid)).toEqual({ valid: true });
    });

    it.for(["100", "07", "-1", "", "1a", " 7", 23, true].map((n) => ({ n })))(
        "rejects roster number $n",
        ({ n }) => {
            expect(validateTeamData({ ...valid, roster: [{ slot: 0, player, number: n }] })).toEqual({
                valid: false,
                error: "Roster numbers must be 0-99 or 00",
            });
        },
    );
});

describe("roster appearances", () => {
    const LOOK = {
        version: 1,
        frame: "m",
        skin: "#8d5a3b",
        hair: { style: "parted", color: "#3b2a1e" },
        facialHair: { style: "beard", color: "#3b2a1e" },
        build: { girth: 0, shoulders: 0, wingspan: 0 },
        accessories: [],
        pose: "relaxed",
    };
    const nova = { fullName: "Nova ", isCustom: true, playerUUID: "p1", appearance: LOOK };
    const team = (player: Record<string, unknown>) => ({ title: "Sonics", roster: [{ slot: 0, player }] });

    it("accepts a custom player with a valid look", () => {
        expect(validateTeamData(team(nova))).toEqual({ valid: true });
    });

    it("rejects a custom player's invalid look, naming them", () => {
        expect(validateTeamData(team({ ...nova, appearance: { ...LOOK, hair: { style: "parted", color: "brown" } } }))).toEqual({
            valid: false,
            error: "Nova's look is invalid: Appearance hair color must be a #rrggbb colour",
        });
    });

    it("never rejects a real player for a look, and drops it", () => {
        const real = { fullName: "Gary Payton", appearance: { skin: "pink" } };
        expect(validateTeamData(team(real))).toEqual({ valid: true });
        expect(toRoster([{ slot: 0, player: real } as never])[0].player).toEqual({ fullName: "Gary Payton" });
    });

    it("keeps only the known keys of a custom player's look", () => {
        const [entry] = toRoster([
            { slot: 0, number: "8", player: { ...nova, appearance: { ...LOOK, secret: 1, hair: { ...LOOK.hair, extra: 2 } } } } as never,
        ]);
        expect(entry).toEqual({ slot: 0, number: "8", player: nova });
    });

    it("leaves an entry without a look as it is", () => {
        const entry = { slot: 0, player: { fullName: "Gary Payton" } };
        expect(toRoster([entry])[0]).toBe(entry);
    });
});
