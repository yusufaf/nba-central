import { describe, it, expect } from "vitest";
import {
    BANNER_KINDS,
    BANNER_SUBTITLE_MAX,
    BANNER_TITLE_MAX,
    BANNERS_MAX,
    RIBBON_TEXT_MAX,
    SCOREBOARD_TEXT_MAX,
    SEAT_PATTERNS,
} from "../../models/custom-entities";
import { toVenue, validateArenaData, venueError } from "../../utilities/custom-entities-validation";
import * as web from "../../../web/src/constants/venue";

const VENUE = {
    version: 1,
    seats: { primary: "#1e293b", secondary: "#B91C1C", pattern: "sections" },
    upperDeck: true,
};

const withSeats = (seats: Record<string, unknown>) => ({ ...VENUE, seats: { ...VENUE.seats, ...seats } });

const SCOREBOARD = { text: "HARBOR", accent: "#c8102e" };
const RIBBON = { text: "WELCOME", color: "#f59e0b" };
const FULL = { ...VENUE, scoreboard: SCOREBOARD, ribbon: RIBBON };

describe("venueError", () => {
    it("accepts a full venue, every pattern and both upper-deck values", () => {
        expect(venueError(VENUE)).toBeNull();
        for (const pattern of SEAT_PATTERNS) expect(venueError(withSeats({ pattern }))).toBeNull();
        expect(venueError({ ...VENUE, upperDeck: false })).toBeNull();
    });

    it("rejects anything that isn't an object", () => {
        for (const value of [null, [], "x", 1]) expect(venueError(value)).toBe("Venue must be an object");
    });

    it("rejects any version but 1", () => {
        expect(venueError({ ...VENUE, version: 2 })).toBe("Venue version must be 1");
        expect(venueError({ ...VENUE, version: "1" })).toBe("Venue version must be 1");
        const { version: _version, ...noVersion } = VENUE;
        expect(venueError(noVersion)).toBe("Venue version must be 1");
    });

    it("rejects malformed seats", () => {
        expect(venueError({ ...VENUE, seats: "red" })).toBe("Venue seats must be {primary, secondary, pattern}");
        expect(venueError({ ...VENUE, seats: [] })).toBe("Venue seats must be {primary, secondary, pattern}");
    });

    it("rejects a colour that isn't #rrggbb", () => {
        expect(venueError(withSeats({ primary: "red" }))).toBe("Venue seats primary must be a #rrggbb colour");
        expect(venueError(withSeats({ primary: "#fff" }))).toBe("Venue seats primary must be a #rrggbb colour");
        expect(venueError(withSeats({ secondary: "#12345g" }))).toBe("Venue seats secondary must be a #rrggbb colour");
    });

    it("rejects an unknown pattern", () => {
        expect(venueError(withSeats({ pattern: "stripes" }))).toBe(
            "Venue seats pattern must be one of solid, sections, rows, gradient",
        );
    });

    it("rejects an upper deck that isn't a boolean", () => {
        for (const upperDeck of ["yes", 1, null]) {
            expect(venueError({ ...VENUE, upperDeck })).toBe("Venue upper deck must be true or false");
        }
    });
});

describe("venueError, optional parts (#296)", () => {
    it("accepts a version-only venue and any subset of parts", () => {
        expect(venueError({ version: 1 })).toBeNull();
        expect(venueError({ version: 1, scoreboard: SCOREBOARD })).toBeNull();
        expect(venueError({ version: 1, ribbon: RIBBON })).toBeNull();
        expect(venueError(VENUE)).toBeNull();
        expect(venueError(FULL)).toBeNull();
    });

    it("needs the seats and the upper deck together, or neither", () => {
        const { upperDeck: _upperDeck, ...seatsOnly } = VENUE;
        const { seats: _seats, ...deckOnly } = VENUE;
        expect(venueError(seatsOnly)).toBe("Venue seats and upper deck must be set together");
        expect(venueError(deckOnly)).toBe("Venue seats and upper deck must be set together");
    });

    it("accepts texts at the limits and empty texts", () => {
        expect(venueError({ ...FULL, scoreboard: { ...SCOREBOARD, text: "x".repeat(16) } })).toBeNull();
        expect(venueError({ ...FULL, ribbon: { ...RIBBON, text: "x".repeat(32) } })).toBeNull();
        expect(venueError({ ...FULL, scoreboard: { ...SCOREBOARD, text: "" }, ribbon: { ...RIBBON, text: "" } })).toBeNull();
    });

    it("rejects a malformed scoreboard", () => {
        for (const scoreboard of [null, "HARBOR", [], 1]) {
            expect(venueError({ ...FULL, scoreboard })).toBe("Venue scoreboard must be {text, accent}");
        }
        for (const text of ["x".repeat(17), 7, undefined]) {
            expect(venueError({ ...FULL, scoreboard: { ...SCOREBOARD, text } })).toBe(
                "Venue scoreboard text must be at most 16 characters",
            );
        }
        for (const accent of ["red", "#fff", undefined]) {
            expect(venueError({ ...FULL, scoreboard: { ...SCOREBOARD, accent } })).toBe(
                "Venue scoreboard accent must be a #rrggbb colour",
            );
        }
    });

    it("rejects a malformed ribbon", () => {
        for (const ribbon of [null, "WELCOME", [], 1]) {
            expect(venueError({ ...FULL, ribbon })).toBe("Venue ribbon must be {text, color}");
        }
        for (const text of ["x".repeat(33), 7, undefined]) {
            expect(venueError({ ...FULL, ribbon: { ...RIBBON, text } })).toBe(
                "Venue ribbon text must be at most 32 characters",
            );
        }
        for (const color of ["amber", "#f59e0", undefined]) {
            expect(venueError({ ...FULL, ribbon: { ...RIBBON, color } })).toBe(
                "Venue ribbon colour must be a #rrggbb colour",
            );
        }
    });
});

const BANNER = { kind: "title", title: "CHAMPIONS", subtitle: "1998", color: "#c9a227" };
const withBanner = (banner: Record<string, unknown>) => ({ version: 1, banners: [{ ...BANNER, ...banner }] });

describe("venueError, banners (#297)", () => {
    it("accepts 0, 1 and 8 banners of both kinds", () => {
        expect(venueError({ version: 1, banners: [] })).toBeNull();
        expect(venueError({ version: 1, banners: [BANNER] })).toBeNull();
        const eight = Array.from({ length: 8 }, (_, i) => ({ ...BANNER, kind: BANNER_KINDS[i % 2] }));
        expect(venueError({ ...FULL, banners: eight })).toBeNull();
    });

    it("accepts texts at the limits and empty texts", () => {
        expect(venueError(withBanner({ title: "x".repeat(16), subtitle: "x".repeat(24) }))).toBeNull();
        expect(venueError(withBanner({ title: "", subtitle: "" }))).toBeNull();
    });

    it("rejects a list that isn't one, or is too long", () => {
        for (const banners of [null, "CHAMPIONS", {}, 1, Array.from({ length: 9 }, () => BANNER)]) {
            expect(venueError({ version: 1, banners })).toBe("Venue banners must be a list of at most 8");
        }
    });

    it("rejects a banner that isn't an object, counting from 1", () => {
        expect(venueError({ version: 1, banners: [BANNER, "x"] })).toBe(
            "Venue banner 2 must be {kind, title, subtitle, color}",
        );
        expect(venueError({ version: 1, banners: [[]] })).toBe("Venue banner 1 must be {kind, title, subtitle, color}");
    });

    it("rejects an unknown kind", () => {
        for (const kind of ["flag", undefined]) {
            expect(venueError(withBanner({ kind }))).toBe("Venue banner 1 kind must be one of title, number");
        }
    });

    it("rejects a long, missing or non-string title or subtitle", () => {
        for (const title of ["x".repeat(17), 7, undefined]) {
            expect(venueError(withBanner({ title }))).toBe("Venue banner 1 title must be at most 16 characters");
        }
        for (const subtitle of ["x".repeat(25), 7, undefined]) {
            expect(venueError(withBanner({ subtitle }))).toBe("Venue banner 1 subtitle must be at most 24 characters");
        }
    });

    it("rejects a colour that isn't #rrggbb", () => {
        for (const color of ["gold", "#fff", undefined]) {
            expect(venueError(withBanner({ color }))).toBe("Venue banner 1 colour must be a #rrggbb colour");
        }
    });
});

describe("toVenue", () => {
    it("copies each banner key by key, in order", () => {
        const second = { ...BANNER, kind: "number", title: "23" };
        const copied = toVenue({ version: 1, banners: [{ ...BANNER, extra: 1 }, second] });
        expect(copied).toEqual({ version: 1, banners: [BANNER, second] });
        expect(copied.banners?.[1]).not.toBe(second);
    });

    it("stores no banners key for an empty list", () => {
        expect(Object.keys(toVenue({ version: 1, banners: [] }))).toEqual(["version"]);
        expect("banners" in toVenue(VENUE)).toBe(false);
    });

    it("copies only the known keys, at both levels", () => {
        const copied = toVenue({ ...VENUE, extra: 1, seats: { ...VENUE.seats, extra: 2 } });
        expect(copied).toEqual(VENUE);
        expect(copied.seats).not.toBe(VENUE.seats);
    });

    it("copies the scoreboard and ribbon key by key", () => {
        const copied = toVenue({
            ...FULL,
            scoreboard: { ...SCOREBOARD, extra: 1 },
            ribbon: { ...RIBBON, extra: 2 },
        });
        expect(copied).toEqual(FULL);
        expect(copied.scoreboard).not.toBe(SCOREBOARD);
        expect(copied.ribbon).not.toBe(RIBBON);
    });

    it("leaves absent parts out instead of setting them to undefined", () => {
        const seated = toVenue(VENUE);
        expect("scoreboard" in seated).toBe(false);
        expect("ribbon" in seated).toBe(false);
        const bare = toVenue({ version: 1, ribbon: RIBBON });
        expect(Object.keys(bare).sort()).toEqual(["ribbon", "version"]);
    });
});

describe("validateArenaData with a venue", () => {
    const arena = { name: "Harbor Pavilion" };

    it("is valid with no venue or a null one", () => {
        expect(validateArenaData(arena)).toEqual({ valid: true });
        expect(validateArenaData({ ...arena, venue: null })).toEqual({ valid: true });
        expect(validateArenaData({ ...arena, venue: VENUE })).toEqual({ valid: true });
    });

    it("reports a bad venue's error", () => {
        expect(validateArenaData({ ...arena, venue: { ...VENUE, version: 2 } })).toEqual({
            valid: false,
            error: "Venue version must be 1",
        });
    });
});

describe("the web copy of the seat patterns", () => {
    it("matches", () => {
        expect(web.SEAT_PATTERNS).toEqual(SEAT_PATTERNS);
    });

    it("matches the text limits", () => {
        expect(web.SCOREBOARD_TEXT_MAX).toBe(SCOREBOARD_TEXT_MAX);
        expect(web.RIBBON_TEXT_MAX).toBe(RIBBON_TEXT_MAX);
    });

    it("matches the banner kinds and limits", () => {
        expect(web.BANNER_KINDS).toEqual(BANNER_KINDS);
        expect(web.BANNERS_MAX).toBe(BANNERS_MAX);
        expect(web.BANNER_TITLE_MAX).toBe(BANNER_TITLE_MAX);
        expect(web.BANNER_SUBTITLE_MAX).toBe(BANNER_SUBTITLE_MAX);
    });
});
