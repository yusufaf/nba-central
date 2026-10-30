import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { injuryFor, injuriesLoaded, resetInjuries } from "@/composables/useInjuries";
import injuries from "../fixtures/liveData/injuries.json";

const NOW = new Date("2026-10-26T13:00:00Z");
const HOUR = 60 * 60 * 1000;

const serve = (body: unknown, status = 200) => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
};
const generatedHoursAgo = (hours: number) => ({
    ...injuries,
    generatedAt: new Date(NOW.getTime() - hours * HOUR).toISOString(),
});

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"], now: NOW });
    resetInjuries();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    resetInjuries();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("useInjuries", () => {
    it("fetches injuries.json once for many cards and keys entries by BBRef id", async () => {
        const fetchMock = serve(injuries);

        expect(injuryFor("jamesle01")).toBeUndefined();
        injuryFor("doncilu01");
        await injuriesLoaded();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(injuryFor("jamesle01")).toMatchObject({ status: "Out", kind: "out" });
        expect(injuryFor("doncilu01")?.kind).toBe("day-to-day");
        expect(injuryFor("hardyja02")).toBeUndefined();
    });

    it("drops an entry with an unknown kind or no status", async () => {
        serve({
            ...injuries,
            players: {
                ...injuries.players,
                weird01: { status: "Out", kind: "maybe", comment: "", date: null },
                blank01: { status: "", kind: "out", comment: "", date: null },
            },
        });
        await injuriesLoaded();
        expect(injuryFor("weird01")).toBeUndefined();
        expect(injuryFor("blank01")).toBeUndefined();
        expect(injuryFor("jamesle01")).toBeDefined();
    });

    it("shows nothing from a file over 12 hours old", async () => {
        serve(generatedHoursAgo(13));
        await injuriesLoaded();
        expect(injuryFor("jamesle01")).toBeUndefined();
        expect(console.warn).toHaveBeenCalled();
    });

    it("shows nothing when the file fails to load", async () => {
        serve({ message: "missing" }, 404);
        await injuriesLoaded();
        expect(injuryFor("jamesle01")).toBeUndefined();
        expect(console.error).toHaveBeenCalled();
    });

    it("hides badges once a loaded file passes 12 hours", async () => {
        const fetchMock = serve(generatedHoursAgo(11));
        await injuriesLoaded();
        expect(injuryFor("jamesle01")).toBeDefined();

        // The open tab refetches every 15 minutes and keeps getting the same
        // file, which crosses 12 hours an hour in.
        await vi.advanceTimersByTimeAsync(HOUR);

        expect(injuryFor("jamesle01")).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(5);
        expect(console.warn).toHaveBeenCalled();
    });

    it("picks up a newer file in an open tab", async () => {
        const later = { ...injuries, generatedAt: new Date(NOW.getTime() + 15 * 60_000).toISOString(), players: { doncilu01: injuries.players.doncilu01 } };
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response(JSON.stringify(injuries)))
            .mockResolvedValueOnce(new Response(JSON.stringify(later)));
        vi.stubGlobal("fetch", fetchMock);
        await injuriesLoaded();
        expect(injuryFor("jamesle01")).toBeDefined();

        await vi.advanceTimersByTimeAsync(15 * 60_000);

        expect(injuryFor("jamesle01")).toBeUndefined();
        expect(injuryFor("doncilu01")?.kind).toBe("day-to-day");
    });

    it("retries after a failed fetch", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response("down", { status: 503 }))
            .mockResolvedValueOnce(new Response(JSON.stringify(injuries)));
        vi.stubGlobal("fetch", fetchMock);
        await injuriesLoaded();
        expect(injuryFor("jamesle01")).toBeUndefined();

        await vi.advanceTimersByTimeAsync(15 * 60_000);

        expect(injuryFor("jamesle01")).toBeDefined();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("hides badges at 12 hours even when the refetch before that fails", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response(JSON.stringify(generatedHoursAgo(11 + 40 / 60))))
            .mockRejectedValue(new TypeError("offline"));
        vi.stubGlobal("fetch", fetchMock);
        await injuriesLoaded();
        expect(injuryFor("jamesle01")).toBeDefined();

        // Refetch at 15 minutes fails with 5 minutes left; the retry waits
        // those 5 minutes, not another 15.
        await vi.advanceTimersByTimeAsync(20 * 60_000);

        expect(injuryFor("jamesle01")).toBeUndefined();
    });

    it("drops a response that lands after a reset", async () => {
        let respond: (res: Response) => void = () => {};
        const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (respond = resolve)));
        vi.stubGlobal("fetch", fetchMock);
        const pending = injuriesLoaded();
        resetInjuries();
        respond(new Response(JSON.stringify(injuries)));
        await pending;

        expect(injuryFor("jamesle01")).toBeUndefined();
        await vi.advanceTimersByTimeAsync(15 * 60_000);
        // Only the lookup above refetched; the dropped response armed no timer.
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("doesn't refetch in a loop for a file dated ahead of the clock", async () => {
        const fetchMock = serve({ ...injuries, generatedAt: "2026-11-25T13:00:00Z" });
        await injuriesLoaded();

        await vi.advanceTimersByTimeAsync(60_000);

        expect(injuryFor("jamesle01")).toBeDefined();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
