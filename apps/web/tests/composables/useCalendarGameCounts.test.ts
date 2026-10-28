import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useCalendarGameCounts } from "@/composables/useCalendarGameCounts";

const now = () => new Date("2026-10-17T16:00Z");
const JANUARY = [{ date: "2026-01-31T17:00Z" }, { date: "2026-02-01T01:30Z" }];
const okResponse = (events: { date: string }[]) => ({
    ok: true,
    status: 200,
    json: async () => ({ events }),
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("useCalendarGameCounts", () => {
    it("requests each page's month and stores its day counts", async () => {
        fetchMock.mockResolvedValue(okResponse(JANUARY));
        const { gameCounts, loadMonths } = useCalendarGameCounts(now);

        await loadMonths([{ month: 1, year: 2026 }]);

        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenCalledWith("/api/scores/month/202601");
        expect(gameCounts.value.get("20260131")).toBe(2);
    });

    it("accepts a single page and skips pages without a month or year", async () => {
        fetchMock.mockResolvedValue(okResponse(JANUARY));
        const { loadMonths } = useCalendarGameCounts(now);

        await loadMonths({ month: 1, year: 2026 });
        await loadMonths([{ month: 2 }, { year: 2026 }]);
        await loadMonths(null);

        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("does not refetch a month that loaded", async () => {
        fetchMock.mockResolvedValue(okResponse(JANUARY));
        const { loadMonths } = useCalendarGameCounts(now);

        await loadMonths([{ month: 1, year: 2026 }]);
        await loadMonths([{ month: 1, year: 2026 }]);

        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("retries a month after the API answers with an error status", async () => {
        fetchMock
            .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) })
            .mockResolvedValueOnce(okResponse(JANUARY));
        const { gameCounts, loadMonths } = useCalendarGameCounts(now);

        await loadMonths([{ month: 1, year: 2026 }]);
        expect(gameCounts.value.size).toBe(0);
        await loadMonths([{ month: 1, year: 2026 }]);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(gameCounts.value.get("20260131")).toBe(2);
    });

    it("retries a month after a network error", async () => {
        fetchMock
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce(okResponse(JANUARY));
        const { gameCounts, loadMonths } = useCalendarGameCounts(now);

        await loadMonths([{ month: 1, year: 2026 }]);
        await loadMonths([{ month: 1, year: 2026 }]);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(gameCounts.value.get("20260131")).toBe(2);
    });

    it("sends one request for a month asked for twice at once", async () => {
        fetchMock.mockResolvedValue(okResponse(JANUARY));
        const { loadMonths } = useCalendarGameCounts(now);
        const page = [{ month: 1, year: 2026 }];

        await Promise.all([loadMonths(page), loadMonths(page)]);

        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("leaves an unpublished future month without counts", async () => {
        fetchMock.mockResolvedValue(okResponse([]));
        const { gameCounts, loadMonths } = useCalendarGameCounts(now);

        await loadMonths([{ month: 6, year: 2027 }]);

        expect(gameCounts.value.size).toBe(0);
    });
});
