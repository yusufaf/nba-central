import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ASSETS_CDN_BASE_URL, LIVE_DATA_BASE_URL } from "@/constants/liveData";

const respond = (status: number, body: unknown) =>
    ({ ok: status < 400, status, json: async () => body }) as Response;

// The module caches each file for the page's life, so every test imports it fresh.
const load = async () => {
    vi.resetModules();
    return import("@/network/teamSeasons");
};

beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("team-season files", () => {
    it("reads the index from live/ and a season file from its path, once each", async () => {
        const { getTeamSeasonsIndex, getTeamSeasonFile } = await load();
        vi.mocked(fetch).mockImplementation(async (url) =>
            String(url).endsWith("index.json")
                ? respond(200, { version: 1, seasons: [] })
                : respond(200, { version: 1, teams: [] }),
        );
        await getTeamSeasonsIndex();
        await getTeamSeasonsIndex();
        await getTeamSeasonFile("team-seasons/NBA-1996.json");
        await getTeamSeasonFile("team-seasons/NBA-1996.json");
        expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
            `${LIVE_DATA_BASE_URL}/team-seasons/index.json`,
            `${ASSETS_CDN_BASE_URL}/team-seasons/NBA-1996.json`,
        ]);
    });

    it("tries again after a failed fetch", async () => {
        const { getTeamSeasonsIndex } = await load();
        vi.mocked(fetch)
            .mockResolvedValueOnce(respond(503, {}))
            .mockResolvedValueOnce(respond(200, { version: 1, seasons: [] }));
        await expect(getTeamSeasonsIndex()).rejects.toThrow("503");
        await expect(getTeamSeasonsIndex()).resolves.toMatchObject({ seasons: [] });
    });

    it("refuses a file of the wrong shape", async () => {
        const { getTeamSeasonsIndex } = await load();
        vi.mocked(fetch).mockResolvedValue(respond(200, { version: 2, seasons: [] }));
        await expect(getTeamSeasonsIndex()).rejects.toThrow("not a version 1");
    });

    it("answers null for the current season when it has no file, and asks again next time", async () => {
        const { getCurrentTeamSeason } = await load();
        vi.mocked(fetch)
            .mockResolvedValueOnce(respond(404, {}))
            .mockResolvedValueOnce(respond(200, { version: 1, teams: [] }));
        await expect(getCurrentTeamSeason()).resolves.toBeNull();
        await expect(getCurrentTeamSeason()).resolves.toMatchObject({ teams: [] });
    });
});
