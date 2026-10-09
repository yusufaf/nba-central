import { describe, it, expect } from "vitest";
import { serializeTeam, hydrateTeam, remixTitle } from "@/composables/useTeamPersistence";
import type { SavedTeam } from "@/models/api";
import historicalLogosData from "@/assets/data/historicalLogos.json";
import type { Arena, Coach, HistoricalLogo, Player } from "@/models/types";

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
            teamJersey: "",
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
            teamJersey: "",
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
            teamJersey: "",
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
            teamJersey: "",
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

    const emptyState = {
        teamName: "Test Team",
        teamDescription: "",
        teamCity: "",
        teamCountry: "",
        teamLogo: "",
        teamJersey: "",
        selectedPlayersData: new Map(),
        teamCoach: null,
        teamGM: null,
    };

    it("saves a built-in arena's full details, with capacity as a number", () => {
        const payload = serializeTeam({
            ...emptyState,
            teamArena: {
                imgLink: "https://example.com/chase.jpg",
                name: "Chase Center",
                location: "San Francisco, California",
                team: "Golden State Warriors",
                capacity: "18,064",
                openedYear: 2019,
            },
        });

        expect(payload.arena).toEqual({
            name: "Chase Center",
            location: "San Francisco, California",
            capacity: 18064,
            openedYear: 2019,
            imgLink: "https://example.com/chase.jpg",
        });
        expect(payload.arena).not.toHaveProperty("isCustom");
    });

    it("saves a custom arena by arenaUUID with a text copy, never its images or court", () => {
        const payload = serializeTeam({
            ...emptyState,
            teamArena: {
                arenaUUID: "a1",
                name: "Harbor Pavilion",
                location: "Seattle, Washington",
                capacity: null,
                openedYear: 2026,
                court: null,
                photoUrl: "https://cdn.example/arenas/a1/photo-1.jpg",
                created: "2026-10-01T00:00:00.000Z",
                isCustom: true,
            },
        });

        expect(JSON.parse(JSON.stringify(payload.arena))).toEqual({
            name: "Harbor Pavilion",
            location: "Seattle, Washington",
            openedYear: 2026,
            isCustom: true,
            arenaUUID: "a1",
        });
    });

    it("drops the resolved fields of an arena read back from the server", () => {
        const payload = serializeTeam({
            ...emptyState,
            teamArena: {
                name: "Harbor Pavilion",
                capacity: 18600,
                isCustom: true,
                arenaUUID: "a1",
                photoUrl: "https://cdn.example/arenas/a1/photo-1.jpg",
                court: {
                    version: 1,
                    wood: "maple",
                    paint: null,
                    apron: null,
                    lines: "#ffffff",
                    centerLogo: "none",
                    baselineText: "",
                    sidelineText: "",
                },
                missing: true,
            },
        });

        expect(JSON.parse(JSON.stringify(payload.arena))).toEqual({
            name: "Harbor Pavilion",
            capacity: 18600,
            isCustom: true,
            arenaUUID: "a1",
        });
    });

    it("keeps an unlinked custom arena (deleted, or a remix) as custom text", () => {
        const payload = serializeTeam({
            ...emptyState,
            teamArena: { name: "Gone Arena", location: "Nowhere", capacity: 500, isCustom: true },
        });

        expect(JSON.parse(JSON.stringify(payload.arena))).toEqual({
            name: "Gone Arena",
            location: "Nowhere",
            capacity: 500,
            isCustom: true,
        });
    });

    it("tolerates a null coach, GM, and arena", () => {
        const payload = serializeTeam({
            teamName: "Test Team",
            teamDescription: "",
            teamCity: "",
            teamCountry: "",
            teamLogo: "",
            teamJersey: "",
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
        jerseyUrl: "https://example.com/jersey.avif",
        playerCount: 1,
        roster: [{ slot: 1, player: snapshotPlayer() as any }],
        coach: { name: "Steve Kerr", isCustom: false },
        gm: { name: "My GM", isCustom: true, uuid: "gm-1" },
        arena: { name: "Chase Center", imgLink: "https://example.com/chase.jpg" },
        favorited: false,
        label: "",
        public: false,
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
        expect(hydrated.teamJersey).toBe("https://example.com/jersey.avif");
        expect(hydrated.players.get(1)?.fullName).toBe("LeBron James");
        expect(hydrated.teamCoach).toEqual({ name: "Steve Kerr", isCustom: false });
        expect(hydrated.teamGM).toEqual({ name: "My GM", isCustom: true, uuid: "gm-1" });
        // A row saved before arenas kept their details is filled from arenas.json.
        expect(hydrated.teamArena).toEqual({
            name: "Chase Center",
            imgLink: "https://example.com/chase.jpg",
            location: "San Francisco, California",
            capacity: 18064,
            openedYear: 2019,
        });

        // Re-serializing the hydrated state reproduces the roster slot/name pairing.
        const reserialized = serializeTeam({
            teamName: hydrated.teamName,
            teamDescription: hydrated.teamDescription,
            teamCity: hydrated.teamCity,
            teamCountry: hydrated.teamCountry,
            teamLogo: hydrated.teamLogo,
            teamJersey: hydrated.teamJersey,
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

    it("leaves a legacy arena that isn't in arenas.json as its name", () => {
        const hydrated = hydrateTeam({
            ...baseSaved,
            arena: { name: "The Forum", imgLink: "https://example.com/forum.jpg" },
        });

        expect(hydrated.teamArena).toEqual({
            name: "The Forum",
            imgLink: "https://example.com/forum.jpg",
        });
    });

    it("keeps stored details over arenas.json, and never fills a custom arena", () => {
        const stored = hydrateTeam({
            ...baseSaved,
            arena: { name: "Chase Center", location: "SF", capacity: 1, openedYear: 1 },
        });
        expect(stored.teamArena).toMatchObject({ location: "SF", capacity: 1, openedYear: 1 });

        const custom = hydrateTeam({
            ...baseSaved,
            arena: { name: "Chase Center", isCustom: true },
        });
        expect(custom.teamArena).toEqual({ name: "Chase Center", isCustom: true });
    });

    it("upgrades a pre-CDN historical logo path to the era's current URL", () => {
        const [era] = historicalLogosData as HistoricalLogo[];
        const hydrated = hydrateTeam({
            ...baseSaved,
            logoUrl: `/logos/historical/${era.team}-${era.startYear}.png`,
        });

        expect(hydrated.teamLogo).toBe(era.logo);
    });
});

describe("remixTitle", () => {
    it("prefixes once and falls back for an empty title", () => {
        expect(remixTitle("Sharers")).toBe("Remix of Sharers");
        expect(remixTitle("Remix of Sharers")).toBe("Remix of Sharers");
        expect(remixTitle("   ")).toBe("Remix");
    });
});

describe("hydrateTeam from a public team", () => {
    it("accepts the public shape (no userUUID/favorited/label/lastViewed)", () => {
        const hydrated = hydrateTeam({
            teamUUID: "t1",
            username: "yusuf",
            title: "Sharers",
            description: "",
            city: "",
            country: "",
            logoUrl: "",
            jerseyUrl: "",
            playerCount: 1,
            roster: [{ slot: 1, player: apiPlayer() }],
            coach: null,
            gm: null,
            arena: null,
            createdAt: 1,
            updatedAt: 2,
            public: true,
        });
        expect(hydrated.teamName).toBe("Sharers");
        expect(hydrated.players.get(1)?.fullName).toBe("LeBron James");
    });
});

describe("hydrateTeam from a stashed save", () => {
    // A signed-out Save keeps the payload in sessionStorage across sign-in, so
    // it comes back through JSON, not as the object that went in.
    it("restores a payload that went through JSON, so the builder ends up as it was", () => {
        const payload = serializeTeam({
            teamName: "Dream Team",
            teamDescription: "Custom NBA Team",
            teamCity: "Seattle",
            teamCountry: "USA",
            teamLogo: "https://example.com/logo.png",
            teamJersey: "",
            selectedPlayersData: new Map([[3, apiPlayer() as unknown as Player]]),
            teamCoach: { name: "Steve Kerr", isCustom: false } as unknown as Coach,
            teamArena: { name: "Chase Center", location: "San Francisco, California", capacity: "18,064", openedYear: 2019 } as unknown as Arena,
            teamGM: null,
        });

        const hydrated = hydrateTeam(JSON.parse(JSON.stringify(payload)));

        expect(hydrated.teamName).toBe("Dream Team");
        expect(hydrated.teamCity).toBe("Seattle");
        expect(hydrated.players.get(3)?.fullName).toBe("LeBron James");
        expect(hydrated.teamCoach).toEqual({ name: "Steve Kerr", isCustom: false });
        expect(hydrated.teamArena).toMatchObject({ name: "Chase Center", capacity: 18064, openedYear: 2019 });
        expect(hydrated.teamGM).toBeNull();
    });
});
