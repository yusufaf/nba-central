import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@/network/api", () => ({
    teamApi: {
        listTeams: vi.fn(),
        createTeam: vi.fn(),
        updateTeam: vi.fn(),
        deleteTeam: vi.fn(),
        publish: vi.fn(),
    },
}));

import { useUserTeamsStore } from "@/stores/userTeams";
import { teamApi } from "@/network/api";
import type {
    SavedTeam,
    SaveTeamPayload,
    TeamSummary,
    UpdateTeamPayload,
} from "@/models/api";

const savedTeam = (overrides: Partial<SavedTeam> = {}): SavedTeam => ({
    teamUUID: "t1",
    userUUID: "u1",
    username: "someone",
    title: "Team One",
    description: "",
    city: "",
    country: "",
    logoUrl: "",
    jerseyUrl: "",
    playerCount: 0,
    roster: [],
    coach: null,
    gm: null,
    arena: null,
    favorited: false,
    label: "",
    public: false,
    lastViewed: 1,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
});

const teamSummary = (overrides: Partial<TeamSummary> = {}): TeamSummary => {
    const {
        roster: _roster,
        coach: _coach,
        gm: _gm,
        arena: _arena,
        ...summary
    } = savedTeam(overrides);
    return summary;
};

const savePayload: SaveTeamPayload = {
    title: "Team One",
    roster: [],
    coach: null,
    gm: null,
    arena: null,
};
const updatePayload: UpdateTeamPayload = { ...savePayload, teamUUID: "t1" };

const sampleTeams: TeamSummary[] = [
    teamSummary({ teamUUID: "t1", title: "Team One", playerCount: 5 }),
    teamSummary({ teamUUID: "t2", title: "Team Two", playerCount: 3 }),
];

beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
});

describe("useUserTeamsStore.fetch", () => {
    it("populates teams and clears loading on success", async () => {
        vi.mocked(teamApi.listTeams).mockResolvedValue({
            success: true,
            data: { teams: sampleTeams },
        });

        const store = useUserTeamsStore();
        await store.fetch();

        expect(store.teams).toEqual(sampleTeams);
        expect(store.loading).toBe(false);
        expect(store.error).toBeNull();
    });

    it("sets error from an unsuccessful response", async () => {
        vi.mocked(teamApi.listTeams).mockResolvedValue({
            success: false,
            error: "nope",
        });

        const store = useUserTeamsStore();
        await store.fetch();

        expect(store.error).toBe("nope");
        expect(store.loading).toBe(false);
    });

    it("sets error on a thrown exception", async () => {
        vi.mocked(teamApi.listTeams).mockRejectedValue(new Error("boom"));

        const store = useUserTeamsStore();
        await store.fetch();

        expect(store.error).toBe("boom");
        expect(store.loading).toBe(false);
    });
});

describe("useUserTeamsStore.save", () => {
    it("returns the created team on success", async () => {
        const created = savedTeam();
        vi.mocked(teamApi.createTeam).mockResolvedValue({
            success: true,
            data: created,
        });

        const store = useUserTeamsStore();
        const result = await store.save(savePayload);

        expect(result).toEqual(created);
    });

    it("throws on an unsuccessful response", async () => {
        vi.mocked(teamApi.createTeam).mockResolvedValue({
            success: false,
            error: "invalid",
        });

        const store = useUserTeamsStore();
        await expect(store.save(savePayload)).rejects.toThrow("invalid");
    });
});

describe("useUserTeamsStore.update", () => {
    it("returns the updated team on success", async () => {
        const updated = savedTeam({ title: "Renamed" });
        vi.mocked(teamApi.updateTeam).mockResolvedValue({
            success: true,
            data: updated,
        });

        const store = useUserTeamsStore();
        const result = await store.update(updatePayload);

        expect(result).toEqual(updated);
    });

    it("throws on an unsuccessful response", async () => {
        vi.mocked(teamApi.updateTeam).mockResolvedValue({
            success: false,
            error: "invalid",
        });

        const store = useUserTeamsStore();
        await expect(store.update(updatePayload)).rejects.toThrow("invalid");
    });
});

describe("useUserTeamsStore.remove", () => {
    it("removes the team from state on success", async () => {
        vi.mocked(teamApi.deleteTeam).mockResolvedValue({
            success: true,
            data: undefined,
        });

        const store = useUserTeamsStore();
        store.teams = sampleTeams;
        await store.remove("t1");

        expect(store.teams.map((t) => t.teamUUID)).toEqual(["t2"]);
    });

    it("leaves state untouched and throws on an unsuccessful response", async () => {
        vi.mocked(teamApi.deleteTeam).mockResolvedValue({
            success: false,
            error: "nope",
        });

        const store = useUserTeamsStore();
        store.teams = sampleTeams;

        await expect(store.remove("t1")).rejects.toThrow("nope");
        expect(store.teams).toEqual(sampleTeams);
    });
});

describe("useUserTeamsStore.publish", () => {
    it("returns the updated team and patches the cached summary", async () => {
        const store = useUserTeamsStore();
        store.teams = [teamSummary({ teamUUID: "t1", title: "One", public: false })];
        vi.mocked(teamApi.publish).mockResolvedValue({
            success: true,
            data: savedTeam({ public: true, cardUrl: "https://cdn/x.png" }),
        });

        const saved = await store.publish({ teamUUID: "t1", public: true, cardPng: "abc" });

        expect(teamApi.publish).toHaveBeenCalledWith({ teamUUID: "t1", public: true, cardPng: "abc" });
        expect(saved.public).toBe(true);
        expect(store.teams[0]).toMatchObject({ public: true, cardUrl: "https://cdn/x.png" });
    });

    it("throws the API error message on failure", async () => {
        const store = useUserTeamsStore();
        vi.mocked(teamApi.publish).mockResolvedValue({ success: false, error: "nope" });
        await expect(store.publish({ teamUUID: "t1", public: true })).rejects.toThrow("nope");
    });
});
