import { describe, it, expect } from "vitest";
import { SEAT_PATTERNS } from "../../models/custom-entities";
import { toVenue, validateArenaData, venueError } from "../../utilities/custom-entities-validation";
import * as web from "../../../web/src/constants/venue";

const VENUE = {
    version: 1,
    seats: { primary: "#1e293b", secondary: "#B91C1C", pattern: "sections" },
    upperDeck: true,
};

const withSeats = (seats: Record<string, unknown>) => ({ ...VENUE, seats: { ...VENUE.seats, ...seats } });

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

    it("rejects missing or malformed seats", () => {
        const { seats: _seats, ...noSeats } = VENUE;
        expect(venueError(noSeats)).toBe("Venue seats must be {primary, secondary, pattern}");
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
        for (const upperDeck of ["yes", 1, undefined]) {
            expect(venueError({ ...VENUE, upperDeck })).toBe("Venue upper deck must be true or false");
        }
    });
});

describe("toVenue", () => {
    it("copies only the known keys, at both levels", () => {
        const copied = toVenue({ ...VENUE, extra: 1, seats: { ...VENUE.seats, extra: 2 } });
        expect(copied).toEqual(VENUE);
        expect(copied.seats).not.toBe(VENUE.seats);
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
});
