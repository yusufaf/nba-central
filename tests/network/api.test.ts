import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the axios instance created in src/network/api.ts. `api` is built via
// axios.create(), so mock that factory to return a stub with the verbs we use.
// vi.hoisted keeps the stub defined before vi.mock's hoisted factory runs.
// `interceptors.request.use` is stubbed too — api.ts registers the
// Authorization-header interceptor immediately after axios.create(), so the
// real instance shape needs at least this much to avoid crashing the import.
const mockInstance = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
        request: { use: vi.fn() },
    },
}));

vi.mock("axios", () => ({
    default: {
        create: () => mockInstance,
    },
}));

import { teamApi, dataApi, customPlayerApi } from "@/network/api";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("teamApi.createTeam", () => {
    it("POSTs to /api/teams/create and returns response.data", async () => {
        const payload = { name: "Dream Team" } as any;
        mockInstance.post.mockResolvedValue({ data: { uuid: "abc" } });

        const result = await teamApi.createTeam(payload);

        expect(mockInstance.post).toHaveBeenCalledWith(
            "/api/teams/create",
            payload,
        );
        expect(result).toEqual({ uuid: "abc" });
    });
});

describe("dataApi.getPlayers", () => {
    it("forwards the query params and returns response.data", async () => {
        const body = { data: [{ id: "jamesle01" }], nextCursor: null };
        mockInstance.get.mockResolvedValue({ data: body });

        const result = await dataApi.getPlayers({
            search: "lebron",
            minRating: 90,
        });

        expect(mockInstance.get).toHaveBeenCalledWith("/api/data/get-players", {
            params: { search: "lebron", minRating: 90 },
        });
        expect(result).toEqual(body);
    });

    it("defaults to an empty param set", async () => {
        mockInstance.get.mockResolvedValue({ data: { data: [] } });

        await dataApi.getPlayers();

        expect(mockInstance.get).toHaveBeenCalledWith("/api/data/get-players", {
            params: {},
        });
    });
});

describe("dataApi.getPlayerStats", () => {
    it("passes the playerId as a query param", async () => {
        const body = { data: [], rating: 96, gameVersion: "NBA 2K26" };
        mockInstance.get.mockResolvedValue({ data: body });

        const result = await dataApi.getPlayerStats("jamesle01");

        expect(mockInstance.get).toHaveBeenCalledWith(
            "/api/data/get-player-stats",
            { params: { playerId: "jamesle01" } },
        );
        expect(result).toEqual(body);
    });
});

describe("customPlayerApi.delete", () => {
    it("DELETEs the uuid-scoped path", async () => {
        mockInstance.delete.mockResolvedValue({ data: { ok: true } });

        const result = await customPlayerApi.delete("uuid-123");

        expect(mockInstance.delete).toHaveBeenCalledWith(
            "/api/custom-entities/player/delete/uuid-123",
        );
        expect(result).toEqual({ ok: true });
    });
});
