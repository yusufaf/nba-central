import { describe, it, expect, vi, afterEach } from "vitest";
import { GameNotFoundError, getGameSummary, getMonthGames, getScoreboard } from "@/network/scores";

const respond = (body: unknown, status = 200) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("scores client", () => {
    it("reads each route from /api/scores", async () => {
        respond({ events: [] });
        await expect(getScoreboard(new Date(2026, 9, 26))).resolves.toEqual({ events: [] });
        expect(fetch).toHaveBeenCalledWith("/api/scores/day/20261026");

        respond({ events: [] });
        await getMonthGames(2026, 1);
        expect(fetch).toHaveBeenCalledWith("/api/scores/month/202601");

        respond({ header: {} });
        await getGameSummary("401859965");
        expect(fetch).toHaveBeenCalledWith("/api/scores/game/401859965");
    });

    it("throws on a 502", async () => {
        respond({ success: false }, 502);
        await expect(getScoreboard(new Date(2026, 9, 26))).rejects.toThrow("502");
    });

    it("throws GameNotFoundError on a 410", async () => {
        respond({ success: false }, 410);
        await expect(getGameSummary("999999999")).rejects.toBeInstanceOf(GameNotFoundError);
    });
});
