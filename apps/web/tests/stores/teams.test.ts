import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// Mock the network layer the store depends on.
vi.mock("@/network/api", () => ({
    dataApi: { getTeamLogos: vi.fn() },
    teamApi: {},
}));

import { useTeamsStore } from "@/stores/teams";
import { dataApi } from "@/network/api";
import type { TeamData } from "@/models/api";

const sampleTeams: TeamData[] = [
    { abbreviation: "LAL", displayName: "Lakers", logos: [] },
    { abbreviation: "BOS", displayName: "Celtics", logos: [] },
];

beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
});

describe("useTeamsStore.fetchTeamLogos", () => {
    it("populates teams and clears loading on success", async () => {
        vi.mocked(dataApi.getTeamLogos).mockResolvedValue(sampleTeams);

        const store = useTeamsStore();
        await store.fetchTeamLogos();

        expect(store.teams).toEqual(sampleTeams);
        expect(store.loading).toBe(false);
        expect(store.error).toBeNull();
    });

    it("sets error on failure", async () => {
        vi.mocked(dataApi.getTeamLogos).mockRejectedValue(new Error("boom"));

        const store = useTeamsStore();
        await store.fetchTeamLogos();

        expect(store.error).toBe("boom");
        expect(store.loading).toBe(false);
    });
});

describe("useTeamsStore getters", () => {
    it("sortedTeams sorts by abbreviation", () => {
        const store = useTeamsStore();
        store.teams = sampleTeams;
        expect(store.sortedTeams.map((t) => t.abbreviation)).toEqual([
            "BOS",
            "LAL",
        ]);
    });

    it("getTeamByAbbreviation finds a team", () => {
        const store = useTeamsStore();
        store.teams = sampleTeams;
        expect(store.getTeamByAbbreviation("BOS")?.displayName).toBe("Celtics");
        expect(store.getTeamByAbbreviation("XXX")).toBeUndefined();
    });
});
