import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the axios instance created in src/network/api.ts. `api` is built via
// axios.create(), so mock that factory to return a stub with the verbs we use.
// vi.hoisted keeps the stub defined before vi.mock's hoisted factory runs.
// `interceptors.request.use` is stubbed too — api.ts registers the
// Authorization-header interceptor immediately after axios.create(), so the
// real instance shape needs at least this much to avoid crashing the import.
// Its behaviour is covered in apiInterceptors.test.ts.
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

import {
    teamApi,
    dataApi,
    customPlayerApi,
    feedbackApi,
    PLAYER_STATS_CONCURRENCY,
} from "@/network/api";

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

describe("feedbackApi.send", () => {
    it("POSTs to /api/feedback/send and returns response.data", async () => {
        const payload = { message: "Love the jersey picker", subject: "Kudos" };
        const body = { success: true, data: { messageId: "ses-1" } };
        mockInstance.post.mockResolvedValue({ data: body });

        const result = await feedbackApi.send(payload);

        expect(mockInstance.post).toHaveBeenCalledWith(
            "/api/feedback/send",
            payload,
        );
        expect(result).toEqual(body);
    });
});

describe("teamApi.listTeams", () => {
    it("GETs /api/teams/list and returns response.data", async () => {
        const body = { success: true, data: { teams: [] } };
        mockInstance.get.mockResolvedValue({ data: body });

        const result = await teamApi.listTeams();

        expect(mockInstance.get).toHaveBeenCalledWith("/api/teams/list");
        expect(result).toEqual(body);
    });
});

describe("teamApi.getTeam", () => {
    it("GETs the uuid-scoped path", async () => {
        const body = { success: true, data: { teamUUID: "t1" } };
        mockInstance.get.mockResolvedValue({ data: body });

        const result = await teamApi.getTeam("t1");

        expect(mockInstance.get).toHaveBeenCalledWith("/api/teams/get/t1");
        expect(result).toEqual(body);
    });
});

describe("teamApi.updateTeam", () => {
    it("PUTs to /api/teams/update with the payload", async () => {
        const payload = { teamUUID: "t1", title: "Renamed" } as any;
        mockInstance.put.mockResolvedValue({ data: { success: true } });

        const result = await teamApi.updateTeam(payload);

        expect(mockInstance.put).toHaveBeenCalledWith(
            "/api/teams/update",
            payload,
        );
        expect(result).toEqual({ success: true });
    });
});

describe("teamApi.deleteTeam", () => {
    it("DELETEs the uuid-scoped path", async () => {
        mockInstance.delete.mockResolvedValue({ data: { success: true } });

        const result = await teamApi.deleteTeam("t1");

        expect(mockInstance.delete).toHaveBeenCalledWith(
            "/api/teams/delete/t1",
        );
        expect(result).toEqual({ success: true });
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

    // The limiter is module state shared by every test in this file, so each
    // test below settles all of its requests before it ends.
    const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    it("keeps at most PLAYER_STATS_CONCURRENCY requests in flight for a 13-player team", async () => {
        const pending: Array<(value: unknown) => void> = [];
        let inFlight = 0;
        let peak = 0;
        mockInstance.get.mockImplementation(() => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            return new Promise((resolve) => {
                pending.push((value) => {
                    inFlight--;
                    resolve(value);
                });
            });
        });

        const ids = Array.from({ length: 13 }, (_, i) => `player${i}`);
        const results = ids.map((id) => dataApi.getPlayerStats(id));

        await flush();
        expect(mockInstance.get).toHaveBeenCalledTimes(PLAYER_STATS_CONCURRENCY);

        pending.shift()!({ data: { data: [], rating: 0 } });
        await flush();
        expect(mockInstance.get).toHaveBeenCalledTimes(PLAYER_STATS_CONCURRENCY + 1);

        while (pending.length) {
            pending.shift()!({ data: { data: [], rating: 0 } });
            await flush();
        }

        expect(await Promise.all(results)).toHaveLength(13);
        expect(mockInstance.get).toHaveBeenCalledTimes(13);
        expect(peak).toBe(PLAYER_STATS_CONCURRENCY);
    });

    it("a failed request frees its slot", async () => {
        const pending: Array<{
            resolve: (value: unknown) => void;
            reject: (reason: unknown) => void;
        }> = [];
        mockInstance.get.mockImplementation(
            () =>
                new Promise((resolve, reject) => {
                    pending.push({ resolve, reject });
                }),
        );

        const results = Array.from({ length: PLAYER_STATS_CONCURRENCY + 1 }, (_, i) =>
            dataApi.getPlayerStats(`player${i}`),
        );
        const outcomes = results.map((r) => r.then(() => "ok", () => "failed"));

        await flush();
        expect(mockInstance.get).toHaveBeenCalledTimes(PLAYER_STATS_CONCURRENCY);

        pending[0].reject(new Error("502"));
        await flush();
        expect(mockInstance.get).toHaveBeenCalledTimes(PLAYER_STATS_CONCURRENCY + 1);

        pending.slice(1).forEach((p) => p.resolve({ data: { data: [] } }));
        await flush();
        pending.slice(PLAYER_STATS_CONCURRENCY).forEach((p) => p.resolve({ data: { data: [] } }));

        expect(await Promise.all(outcomes)).toEqual(["failed", "ok", "ok", "ok"]);
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
