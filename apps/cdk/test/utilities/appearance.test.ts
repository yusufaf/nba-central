import { describe, it, expect } from "vitest";
import {
    ACCESSORIES,
    APPEARANCE_FRAMES,
    FACIAL_HAIR_STYLES,
    HAIR_STYLES,
    MAX_ACCESSORIES,
    AGE_LOOKS,
    OUTFIT_STYLES,
    POSES,
    STAFF_ACCESSORIES,
    STAFF_HEIGHT_INCHES,
} from "../../models/custom-entities";
import {
    appearanceError,
    staffAppearanceError,
    toAppearance,
    toStaffAppearance,
    validateCoachData,
    validateGMData,
    validatePlayerData,
} from "../../utilities/custom-entities-validation";
import * as web from "../../../web/src/constants/appearance";

const LOOK = {
    version: 1,
    frame: "m",
    skin: "#8d5a3b",
    hair: { style: "parted", color: "#3b2a1e" },
    facialHair: { style: "beard", color: "#3B2A1E" },
    build: { girth: 0.5, shoulders: -1, wingspan: 1 },
    accessories: [{ id: "headband", color: "#ffffff" }],
    jerseyNumber: "8",
    pose: "relaxed",
};

const withLook = (change: Record<string, unknown>) => ({ ...LOOK, ...change });
const without = (key: string) => {
    const copy: Record<string, unknown> = { ...LOOK };
    delete copy[key];
    return copy;
};

describe("appearanceError", () => {
    it("accepts a full valid look", () => {
        expect(appearanceError(LOOK)).toBeNull();
    });

    it.for([null, [], "x", 1].map((value) => ({ value })))("rejects $value as the look", ({ value }) => {
        expect(appearanceError(value)).toBe("Appearance must be an object");
    });

    it.for([2, "1", undefined])("rejects version %s", (version) => {
        expect(appearanceError(withLook({ version }))).toBe("Appearance version must be 1");
    });

    describe("ids", () => {
        it.for(APPEARANCE_FRAMES)("accepts frame %s", (frame) => {
            expect(appearanceError(withLook({ frame }))).toBeNull();
        });
        it("rejects an unknown frame", () => {
            expect(appearanceError(withLook({ frame: "x" }))).toBe("Appearance frame must be one of m, f");
        });

        it.for(HAIR_STYLES)("accepts hair style %s", (style) => {
            expect(appearanceError(withLook({ hair: { style, color: "#000000" } }))).toBeNull();
        });
        it.for(["mohawk", "Long", undefined])("rejects hair style %s", (style) => {
            expect(appearanceError(withLook({ hair: { style, color: "#000000" } }))).toBe(
                "Appearance hair style must be one of none, buzzed, parted, buzzedFemale, long, buns",
            );
        });

        it.for(FACIAL_HAIR_STYLES)("accepts facial hair %s", (style) => {
            expect(appearanceError(withLook({ facialHair: { style, color: "#000000" } }))).toBeNull();
        });
        it("rejects an unknown facial hair", () => {
            expect(appearanceError(withLook({ facialHair: { style: "goatee", color: "#000000" } }))).toBe(
                "Appearance facial hair style must be one of none, beard",
            );
        });

        it.for(ACCESSORIES)("accepts accessory %s", (id) => {
            expect(appearanceError(withLook({ accessories: [{ id, color: "#000000" }] }))).toBeNull();
        });
        it("rejects an unknown accessory", () => {
            expect(appearanceError(withLook({ accessories: [{ id: "cape", color: "#000000" }] }))).toBe(
                "Appearance accessories must be one of headband, armSleeve, goggles, glasses",
            );
        });

        it.for(POSES)("accepts pose %s", (pose) => {
            expect(appearanceError(withLook({ pose }))).toBeNull();
        });
        it.for(["dunk", undefined])("rejects pose %s", (pose) => {
            expect(appearanceError(withLook({ pose }))).toBe("Appearance pose must be one of relaxed, handsOnHips, armsCrossed, celebrate");
        });
    });

    describe("colours", () => {
        const BAD = ["#fff", "red", "112233", undefined, 0x112233];
        it.for(BAD)("rejects skin %s", (skin) => {
            expect(appearanceError(withLook({ skin }))).toBe("Appearance skin must be a #rrggbb colour");
        });
        it.for(BAD)("rejects hair colour %s", (color) => {
            expect(appearanceError(withLook({ hair: { style: "buzzed", color } }))).toBe(
                "Appearance hair color must be a #rrggbb colour",
            );
        });
        it.for(BAD)("rejects facial hair colour %s", (color) => {
            expect(appearanceError(withLook({ facialHair: { style: "none", color } }))).toBe(
                "Appearance facial hair color must be a #rrggbb colour",
            );
        });
        it.for(BAD)("rejects accessory colour %s", (color) => {
            expect(appearanceError(withLook({ accessories: [{ id: "goggles", color }] }))).toBe(
                "Appearance accessory color must be a #rrggbb colour",
            );
        });
        it("rejects hair or facial hair that isn't an object", () => {
            expect(appearanceError(withLook({ hair: "buzzed" }))).toBe("Appearance hair must be {style, color}");
            expect(appearanceError(without("facialHair"))).toBe("Appearance facial hair must be {style, color}");
        });
    });

    describe("build", () => {
        for (const field of ["girth", "shoulders", "wingspan"]) {
            it.for([-1, 0, 1, 0.25])(`accepts ${field} %s`, (value) => {
                expect(appearanceError(withLook({ build: { ...LOOK.build, [field]: value } }))).toBeNull();
            });
            it.for([1.01, -1.01, NaN, Infinity, "0", undefined])(`rejects ${field} %s`, (value) => {
                expect(appearanceError(withLook({ build: { ...LOOK.build, [field]: value } }))).toBe(
                    `Appearance build ${field} must be a number from -1 to 1`,
                );
            });
        }
        it("rejects a build that isn't an object", () => {
            expect(appearanceError(without("build"))).toBe("Appearance build must be {girth, shoulders, wingspan}");
        });
    });

    describe("accessories", () => {
        it("accepts none", () => {
            expect(appearanceError(withLook({ accessories: [] }))).toBeNull();
        });
        it("rejects a non-array", () => {
            expect(appearanceError(withLook({ accessories: "headband" }))).toBe("Appearance accessories must be an array");
        });
        it(`rejects more than ${MAX_ACCESSORIES}`, () => {
            const five = [...ACCESSORIES, "headband"].map((id) => ({ id, color: "#000000" }));
            expect(appearanceError(withLook({ accessories: five }))).toBe("Appearance can have at most 4 accessories");
        });
        it("rejects a repeated accessory", () => {
            const twice = [
                { id: "goggles", color: "#000000" },
                { id: "goggles", color: "#ffffff" },
            ];
            expect(appearanceError(withLook({ accessories: twice }))).toBe("Appearance accessories must not repeat");
        });
        it("rejects a bare id", () => {
            expect(appearanceError(withLook({ accessories: ["goggles"] }))).toBe(
                "Appearance accessories must be one of headband, armSleeve, goggles, glasses",
            );
        });
    });

    describe("jersey number", () => {
        it.for(["0", "00", "99", null])("accepts %s", (jerseyNumber) => {
            expect(appearanceError(withLook({ jerseyNumber }))).toBeNull();
        });
        it("accepts none", () => {
            expect(appearanceError(without("jerseyNumber"))).toBeNull();
        });
        it.for(["07", "100", 7, ""])("rejects %s", (jerseyNumber) => {
            expect(appearanceError(withLook({ jerseyNumber }))).toBe("Appearance jersey number must be 0-99 or 00");
        });
        it("is reported before a bad pose", () => {
            expect(appearanceError(withLook({ jerseyNumber: "07", pose: "dab" }))).toBe(
                "Appearance jersey number must be 0-99 or 00",
            );
        });
    });
});

describe("toAppearance", () => {
    it("keeps a valid look as it is", () => {
        expect(toAppearance(LOOK)).toEqual(LOOK);
    });

    it("drops unknown keys at every level, and staff-only keys", () => {
        const stored = toAppearance({
            ...LOOK,
            secret: "x",
            heightIn: 70,
            outfit: { style: "suit" },
            hair: { ...LOOK.hair, extra: 1 },
            build: { ...LOOK.build, height: 2 },
            accessories: [{ id: "headband", color: "#ffffff", glow: true }],
        });
        expect(stored).toEqual(LOOK);
    });

    it("omits a null jersey number", () => {
        expect(toAppearance(withLook({ jerseyNumber: null }))).not.toHaveProperty("jerseyNumber");
    });
});

describe("validatePlayerData appearance", () => {
    const player = { name: "Nova", position: "PG", heightFeet: 6, heightInches: 3, weightPounds: 195, overallRating: 80 };

    it("accepts a player without, with null, or with a valid look", () => {
        expect(validatePlayerData(player)).toEqual({ valid: true });
        expect(validatePlayerData({ ...player, appearance: null })).toEqual({ valid: true });
        expect(validatePlayerData({ ...player, appearance: LOOK })).toEqual({ valid: true });
    });

    it("rejects an invalid look with its error", () => {
        expect(validatePlayerData({ ...player, appearance: withLook({ skin: "pink" }) })).toEqual({
            valid: false,
            error: "Appearance skin must be a #rrggbb colour",
        });
    });
});

const STAFF_LOOK = {
    version: 1,
    frame: "m",
    skin: "#8d5a3b",
    hair: { style: "parted", color: "#3b2a1e" },
    facialHair: { style: "none", color: "#3b2a1e" },
    build: { girth: 0.2, shoulders: 0, wingspan: -0.5, heightIn: 74 },
    accessories: [{ id: "glasses", color: "#1c1c1c" }],
    outfit: { style: "tracksuit", primary: "#552583", secondary: "#fdb927" },
    ageLook: "veteran",
    pose: "armsCrossed",
};

const withStaff = (change: Record<string, unknown>) => ({ ...STAFF_LOOK, ...change });
const withHeight = (heightIn: unknown) => withStaff({ build: { ...STAFF_LOOK.build, heightIn } });

describe("staffAppearanceError", () => {
    it("accepts a full valid staff look", () => {
        expect(staffAppearanceError(STAFF_LOOK)).toBeNull();
    });

    it.for(OUTFIT_STYLES)("accepts outfit %s", (style) => {
        expect(staffAppearanceError(withStaff({ outfit: { ...STAFF_LOOK.outfit, style } }))).toBeNull();
    });

    it.for(AGE_LOOKS)("accepts age look %s", (ageLook) => {
        expect(staffAppearanceError(withStaff({ ageLook }))).toBeNull();
    });

    it.for([STAFF_HEIGHT_INCHES.min, STAFF_HEIGHT_INCHES.max])("accepts height %s", (heightIn) => {
        expect(staffAppearanceError(withHeight(heightIn))).toBeNull();
    });

    it.for([59, 91, 70.5, "72", undefined])("rejects height %s", (heightIn) => {
        expect(staffAppearanceError(withHeight(heightIn))).toBe(
            "Appearance height must be a whole number of inches from 60 to 90",
        );
    });

    it("rejects a missing or non-object outfit", () => {
        const copy: Record<string, unknown> = { ...STAFF_LOOK };
        delete copy.outfit;
        expect(staffAppearanceError(copy)).toBe("Appearance outfit must be {style, primary, secondary}");
        expect(staffAppearanceError(withStaff({ outfit: "suit" }))).toBe(
            "Appearance outfit must be {style, primary, secondary}",
        );
    });

    it("rejects an unknown outfit style", () => {
        expect(staffAppearanceError(withStaff({ outfit: { ...STAFF_LOOK.outfit, style: "robe" } }))).toBe(
            "Appearance outfit style must be one of suit, polo, tracksuit",
        );
    });

    it.for(["primary", "secondary"])("rejects a bad outfit %s", (field) => {
        expect(staffAppearanceError(withStaff({ outfit: { ...STAFF_LOOK.outfit, [field]: "purple" } }))).toBe(
            `Appearance outfit ${field} must be a #rrggbb colour`,
        );
    });

    it.for(["old", undefined])("rejects age look %s", (ageLook) => {
        expect(staffAppearanceError(withStaff({ ageLook }))).toBe(
            "Appearance age look must be one of young, prime, veteran",
        );
    });

    it("rejects player-only gear", () => {
        expect(staffAppearanceError(withStaff({ accessories: [{ id: "headband", color: "#ffffff" }] }))).toBe(
            "Appearance accessories must be one of glasses",
        );
    });

    it("ignores a jersey number, even an invalid one", () => {
        expect(staffAppearanceError(withStaff({ jerseyNumber: "07" }))).toBeNull();
    });

    it("still checks the shared fields", () => {
        expect(staffAppearanceError(withStaff({ skin: "pink" }))).toBe("Appearance skin must be a #rrggbb colour");
        expect(staffAppearanceError(withStaff({ pose: "dab" }))).toBe(
            "Appearance pose must be one of relaxed, handsOnHips, armsCrossed, celebrate",
        );
    });
});

describe("toStaffAppearance", () => {
    it("keeps a valid staff look as it is", () => {
        expect(toStaffAppearance(STAFF_LOOK)).toEqual(STAFF_LOOK);
    });

    it("drops unknown keys at every level, and the jersey number", () => {
        const stored = toStaffAppearance({
            ...STAFF_LOOK,
            secret: "x",
            jerseyNumber: "8",
            hair: { ...STAFF_LOOK.hair, extra: 1 },
            build: { ...STAFF_LOOK.build, reach: 2 },
            outfit: { ...STAFF_LOOK.outfit, tie: "#000000" },
            accessories: [{ id: "glasses", color: "#1c1c1c", glow: true }],
        });
        expect(stored).toEqual(STAFF_LOOK);
    });
});

describe("validateCoachData and validateGMData appearance", () => {
    const coach = { name: "Coach K", overallRating: 70, specialty: "Balanced" };
    const gm = { name: "Exec", teams: ["LAL"] };

    it.for([
        { kind: "coach", validate: validateCoachData, base: coach },
        { kind: "gm", validate: validateGMData, base: gm },
    ])("accepts a $kind without, with null, or with a valid look", ({ validate, base }) => {
        expect(validate(base)).toEqual({ valid: true });
        expect(validate({ ...base, appearance: null })).toEqual({ valid: true });
        expect(validate({ ...base, appearance: STAFF_LOOK })).toEqual({ valid: true });
    });

    it.for([
        { kind: "coach", validate: validateCoachData, base: coach },
        { kind: "gm", validate: validateGMData, base: gm },
    ])("rejects a $kind's invalid look with its error", ({ validate, base }) => {
        expect(validate({ ...base, appearance: withHeight(100) })).toEqual({
            valid: false,
            error: "Appearance height must be a whole number of inches from 60 to 90",
        });
    });
});

describe("apps/web's copy", () => {
    it("has the same ids and limits", () => {
        expect(web.APPEARANCE_FRAMES).toEqual(APPEARANCE_FRAMES);
        expect(web.HAIR_STYLES).toEqual(HAIR_STYLES);
        expect(web.FACIAL_HAIR_STYLES).toEqual(FACIAL_HAIR_STYLES);
        expect(web.ACCESSORIES).toEqual(ACCESSORIES);
        expect(web.POSES).toEqual(POSES);
        expect(web.MAX_ACCESSORIES).toBe(MAX_ACCESSORIES);
        expect(web.OUTFIT_STYLES).toEqual(OUTFIT_STYLES);
        expect(web.AGE_LOOKS).toEqual(AGE_LOOKS);
        expect(web.STAFF_ACCESSORIES).toEqual(STAFF_ACCESSORIES);
        expect(web.STAFF_HEIGHT_INCHES).toEqual(STAFF_HEIGHT_INCHES);
    });
});
