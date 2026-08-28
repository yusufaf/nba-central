import { describe, it, expect } from "vitest";
import { serializeTeam, hydrateTeam } from "@/composables/useTeamPersistence";
import type { SavedTeam } from "@/models/api";

const apiPlayer = (overrides: Record<string, any> = {}) => ({
    id: "jamesle01",
    first_name: "LeBron",
    last_name: "James",
    fullName: "LeBron James",
    position: "SF",
    team: { full_name: "Los Angeles Lakers", abbreviation: "LAL" },
    height_feet: 6,
    height_inches: 9,
    weight_pounds: 250,
    active: true,
    rating: 96,
    ratingSource: "current",
    // UI-only fields that shouldn't survive serialization
    heightAndWeight: "6' 9\", 250lbs",
    playerStats: [{ season: 2025, pts: 27 }],
    ratingHistory: [{ gameVersion: "2K25", overall: 96 }],
    ...overrides,
});

const customPlayer = (overrides: Record<string, any> = {}) => ({
    playerUUID: "uuid-1",
    name: "My Custom Guy",
    fullName: "My Custom Guy",
    position: "PG",
    heightFeet: 6,
    heightInches: 2,
    weightPounds: 190,
    overallRating: 80,
    isCustom: true,
    heightAndWeight: "6' 2\", 190lbs",
    ...overrides,
});

describe("serializeTeam", () => {
    it("sorts the roster by slot regardless of insertion order", () => {
        const selectedPlayersData = new Map<number, any>([
            [5, apiPlayer({ fullName: "Fifth Slot" })],
            [1, apiPlayer({ fullName: "First Slot" })],
        ]);

        const payload = serializeTeam({
            teamName: "Test Team",
            teamDescription: "",
            teamCity: "",
            teamCountry: "",
            teamLogo: "",
            selectedPlayersData,
            teamCoach: null,
            teamArena: null,
            teamGM: null,
        });

        expect(payload.roster.map((r) => r.slot)).toEqual([1, 5]);
        expect(payload.roster.map((r) => r.player.fullName)).toEqual([
            "First Slot",
            "Fifth Slot",
        ]);
    });

    it("strips derived/UI-only fields off each player", () => {
        const selectedPlayersData = new Map<number, any>([[1, apiPlayer()]]);

        const payload = serializeTeam({
            teamName: "Test Team",
            teamDescription: "",
            teamCity: "",
            teamCountry: "",
            teamLogo: "",
            selectedPlayersData,
            teamCoach: null,
            teamArena: null,
            teamGM: null,
        });

        const snapshot = payload.roster[0].player as any;
        expect(snapshot).not.toHaveProperty("playerStats");
        expect(snapshot).not.toHaveProperty("ratingHistory");
        expect(snapshot).not.toHaveProperty("heightAndWeight");
        expect(snapshot.id).toBe("jamesle01");
    });

    it("serializes a custom player without an id/team the same way", () => {
        const selectedPlayersData = new Map<number, any>([[8, customPlayer()]]);

        const payload = serializeTeam({
            teamName: "Test Team",
            teamDescription: "",
            teamCity: "",
            teamCountry: "",
            teamLogo: "",
            selectedPlayersData,
            teamCoach: null,
            teamArena: null,
            teamGM: null,
        });

        expect(payload.roster[0].player.fullName).toBe("My Custom Guy");
        expect(payload.roster[0].player.isCustom).toBe(true);
    });

    it("maps coach/GM/arena refs, including custom UUIDs", () => {
        const payload = serializeTeam({
            teamName: "Test Team",
            teamDescription: "",
            teamCity: "",
            teamCountry: "",
            teamLogo: "",
            selectedPlayersData: new Map(),
            teamCoach: { name: "Steve Kerr", isCustom: false },
            teamArena: { name: "Chase Center", imgLink: "https://example.com/chase.jpg" },
            teamGM: { name: "My GM", isCustom: true, gmUUID: "gm-1" },
        });

        expect(payload.coach).toEqual({ name: "Steve Kerr", isCustom: false, uuid: undefined });
        expect(payload.gm).toEqual({ name: "My GM", isCustom: true, uuid: "gm-1" });
        expect(payload.arena).toEqual({
            name: "Chase Center",
            imgLink: "https://example.com/chase.jpg",
        });
    });

    it("tolerates a null coach, GM, and arena", () => {
        const payload = serializeTeam({
            teamName: "Test Team",
            teamDescription: "",
            teamCity: "",
            teamCountry: "",
            teamLogo: "",
            selectedPlayersData: new Map(),
            teamCoach: null,
            teamArena: null,
            teamGM: null,
        });

        expect(payload.coach).toBeNull();
        expect(payload.gm).toBeNull();
        expect(payload.arena).toBeNull();
        expect(payload.roster).toEqual([]);
    });
});

// A snapshot as it actually comes back from the API - already stripped of
// playerStats/ratingHistory/heightAndWeight, unlike the working `apiPlayer()`
// fixture above.
const snapshotPlayer = (overrides: Record<string, any> = {}) => {
    const {
        heightAndWeight: _heightAndWeight,
        playerStats: _playerStats,
        ratingHistory: _ratingHistory,
        ...snapshot
    } = apiPlayer(overrides);
    return snapshot;
};

describe("hydrateTeam", () => {
    const baseSaved: SavedTeam = {
        teamUUID: "t1",
        userUUID: "u1",
        username: "someone",
        title: "My Team",
        description: "A description",
        city: "Miami",
        country: "USA",
        logoUrl: "https://example.com/logo.png",
        playerCount: 1,
        roster: [{ slot: 1, player: snapshotPlayer() as any }],
        coach: { name: "Steve Kerr", isCustom: false },
        gm: { name: "My GM", isCustom: true, uuid: "gm-1" },
        arena: { name: "Chase Center", imgLink: "https://example.com/chase.jpg" },
        favorited: false,
        label: "",
        lastViewed: 1,
        createdAt: 1,
        updatedAt: 1,
    };

    it("round-trips a full team through serialize -> hydrate", () => {
        const hydrated = hydrateTeam(baseSaved);

        expect(hydrated.teamName).toBe("My Team");
        expect(hydrated.teamDescription).toBe("A description");
        expect(hydrated.teamCity).toBe("Miami");
        expect(hydrated.teamCountry).toBe("USA");
        expect(hydrated.teamLogo).toBe("https://example.com/logo.png");
        expect(hydrated.players.get(1)?.fullName).toBe("LeBron James");
        expect(hydrated.teamCoach).toEqual({ name: "Steve Kerr", isCustom: false });
        expect(hydrated.teamGM).toEqual({ name: "My GM", isCustom: true, uuid: "gm-1" });
        expect(hydrated.teamArena).toEqual({
            name: "Chase Center",
            imgLink: "https://example.com/chase.jpg",
        });

        // Re-serializing the hydrated state reproduces the roster slot/name pairing.
        const reserialized = serializeTeam({
            teamName: hydrated.teamName,
            teamDescription: hydrated.teamDescription,
            teamCity: hydrated.teamCity,
            teamCountry: hydrated.teamCountry,
            teamLogo: hydrated.teamLogo,
            selectedPlayersData: hydrated.players,
            teamCoach: hydrated.teamCoach,
            teamArena: hydrated.teamArena,
            teamGM: hydrated.teamGM,
        });
        expect(reserialized.roster).toEqual([
            { slot: 1, player: hydrated.players.get(1) },
        ]);
    });

    it("survives a null coach, null arena, null GM, and an empty roster", () => {
        const hydrated = hydrateTeam({
            ...baseSaved,
            roster: [],
            coach: null,
            gm: null,
            arena: null,
        });

        expect(hydrated.players.size).toBe(0);
        expect(hydrated.teamCoach).toBeNull();
        expect(hydrated.teamGM).toBeNull();
        expect(hydrated.teamArena).toBeNull();
    });
});
