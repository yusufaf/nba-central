import { describe, it, expect, vi, afterEach } from "vitest";
import { getHeadshots, getInjuries, getSchedule, getStandings } from "@/network/liveData";
import { LIVE_DATA_BASE_URL } from "@/constants/liveData";
import standings from "../fixtures/liveData/standings.json";

const respond = (body: unknown, status = 200) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("live data client", () => {
    it("fetches each file from the CDN's live/ folder", async () => {
        respond(standings);
        await expect(getStandings()).resolves.toMatchObject({ version: 1 });
        expect(fetch).toHaveBeenCalledWith(`${LIVE_DATA_BASE_URL}/standings.json`);

        respond({ version: 1, games: [] });
        await getSchedule();
        expect(fetch).toHaveBeenCalledWith(`${LIVE_DATA_BASE_URL}/schedule.json`);

        respond({ version: 1, players: {} });
        await getHeadshots();
        expect(fetch).toHaveBeenCalledWith(`${LIVE_DATA_BASE_URL}/headshots.json`);

        respond({ version: 1, generatedAt: "2026-10-26T12:07:00.000Z", players: {} });
        await getInjuries();
        expect(fetch).toHaveBeenCalledWith(`${LIVE_DATA_BASE_URL}/injuries.json`);
    });

    it("throws on a 404", async () => {
        respond({ message: "missing" }, 404);
        await expect(getStandings()).rejects.toThrow("404");
    });

    it("throws on a wrong version or shape", async () => {
        respond({ ...standings, version: 2 });
        await expect(getStandings()).rejects.toThrow("version 1");
        respond({ version: 1 });
        await expect(getSchedule()).rejects.toThrow("version 1");
        respond([]);
        await expect(getHeadshots()).rejects.toThrow("not an object");
        respond({ version: 1, players: {} });
        await expect(getInjuries()).rejects.toThrow("version 1");
    });
});
