import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@/network/api", () => ({
    teamApi: {
        listTeams: vi.fn(),
        createTeam: vi.fn(),
        updateTeam: vi.fn(),
        deleteTeam: vi.fn(),
    },
}));

import { useUserTeamsStore } from "@/stores/userTeams";
import { teamApi } from "@/network/api";

const sampleTeams = [
    { teamUUID: "t1", title: "Team One", playerCount: 5 },
    { teamUUID: "t2", title: "Team Two", playerCount: 3 },
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
        } as any);

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
        } as any);

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
        const created = { teamUUID: "t1" };
        vi.mocked(teamApi.createTeam).mockResolvedValue({
            success: true,
            data: created,
        } as any);

        const store = useUserTeamsStore();
        const result = await store.save({} as any);

        expect(result).toEqual(created);
    });

    it("throws on an unsuccessful response", async () => {
        vi.mocked(teamApi.createTeam).mockResolvedValue({
            success: false,
            error: "invalid",
        } as any);

        const store = useUserTeamsStore();
        await expect(store.save({} as any)).rejects.toThrow("invalid");
    });
});

describe("useUserTeamsStore.update", () => {
    it("returns the updated team on success", async () => {
        const updated = { teamUUID: "t1", title: "Renamed" };
        vi.mocked(teamApi.updateTeam).mockResolvedValue({
            success: true,
            data: updated,
        } as any);

        const store = useUserTeamsStore();
        const result = await store.update({} as any);

        expect(result).toEqual(updated);
    });

    it("throws on an unsuccessful response", async () => {
        vi.mocked(teamApi.updateTeam).mockResolvedValue({
            success: false,
            error: "invalid",
        } as any);

        const store = useUserTeamsStore();
        await expect(store.update({} as any)).rejects.toThrow("invalid");
    });
});

describe("useUserTeamsStore.remove", () => {
    it("removes the team from state on success", async () => {
        vi.mocked(teamApi.deleteTeam).mockResolvedValue({
            success: true,
        } as any);

        const store = useUserTeamsStore();
        store.teams = sampleTeams as any;
        await store.remove("t1");

        expect(store.teams.map((t) => t.teamUUID)).toEqual(["t2"]);
    });

    it("leaves state untouched and throws on an unsuccessful response", async () => {
        vi.mocked(teamApi.deleteTeam).mockResolvedValue({
            success: false,
            error: "nope",
        } as any);

        const store = useUserTeamsStore();
        store.teams = sampleTeams as any;

        await expect(store.remove("t1")).rejects.toThrow("nope");
        expect(store.teams).toEqual(sampleTeams);
    });
});
