import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadStandings, resetStandings, standingFor, standingsState } from "@/composables/useStandings";
import { LIVE_DATA_BASE_URL, STANDINGS_REFRESH_MS } from "@/constants/liveData";
import standings from "../fixtures/liveData/standings.json";

const ok = () => new Response(JSON.stringify(standings));

beforeEach(() => {
    resetStandings();
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe("useStandings", () => {
    it("fetches standings.json once for many tooltips", async () => {
        const fetchMock = vi.fn(async () => ok());
        vi.stubGlobal("fetch", fetchMock);

        await Promise.all([loadStandings(), loadStandings()]);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(`${LIVE_DATA_BASE_URL}/standings.json`);
        expect(standingFor("20")?.team.abbreviation).toBe("PHI");
        expect(standingsState.value).toBe("ready");
    });

    it("fetches nothing until a tooltip asks", () => {
        const fetchMock = vi.fn(async () => ok());
        vi.stubGlobal("fetch", fetchMock);

        expect(standingFor("20")).toBeUndefined();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(standingsState.value).toBe("idle");
    });

    it("is loading as soon as a load starts", () => {
        vi.stubGlobal("fetch", vi.fn(async () => ok()));
        void loadStandings();
        expect(standingsState.value).toBe("loading");
    });

    it("says so when the file can't be loaded, and tries again on the next open", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response("", { status: 404 }))
            .mockImplementation(async () => ok());
        vi.stubGlobal("fetch", fetchMock);

        await loadStandings();
        expect(standingsState.value).toBe("error");
        expect(standingFor("20")).toBeUndefined();
        expect(console.error).toHaveBeenCalled();

        await loadStandings();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(standingFor("20")?.team.abbreviation).toBe("PHI");
    });

    it("refetches only once the refresh interval has passed", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const fetchMock = vi.fn(async () => ok());
        vi.stubGlobal("fetch", fetchMock);

        await loadStandings();
        vi.setSystemTime(Date.now() + STANDINGS_REFRESH_MS - 1);
        await loadStandings();
        expect(fetchMock).toHaveBeenCalledTimes(1);

        vi.setSystemTime(Date.now() + 2);
        await loadStandings();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("keeps the standings it has when a refetch fails", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const fetchMock = vi
            .fn()
            .mockImplementationOnce(async () => ok())
            .mockResolvedValueOnce(new Response("", { status: 503 }));
        vi.stubGlobal("fetch", fetchMock);

        await loadStandings();
        vi.setSystemTime(Date.now() + STANDINGS_REFRESH_MS + 1);
        await loadStandings();

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(standingsState.value).toBe("ready");
        expect(standingFor("20")?.team.abbreviation).toBe("PHI");
    });

    it("drops a load that was in flight when it was reset", async () => {
        let release: (res: Response) => void = () => {};
        vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (release = resolve))));

        const pending = loadStandings();
        resetStandings();
        release(ok());
        await pending;

        expect(standingFor("20")).toBeUndefined();
        expect(standingsState.value).toBe("idle");
    });
});
