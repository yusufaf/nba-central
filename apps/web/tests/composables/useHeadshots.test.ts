import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { headshotUrl, headshotsLoaded, resetHeadshots } from "@/composables/useHeadshots";
import { LIVE_DATA_BASE_URL } from "@/constants/liveData";
import headshots from "../fixtures/liveData/headshots.json";

beforeEach(() => {
    resetHeadshots();
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("useHeadshots", () => {
    it("fetches headshots.json once for many cards and maps ids to CDN URLs", async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify(headshots)));
        vi.stubGlobal("fetch", fetchMock);

        expect(headshotUrl("jamesle01")).toBeUndefined();
        headshotUrl("doncilu01");
        await headshotsLoaded();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(headshotUrl("jamesle01")).toBe(`${LIVE_DATA_BASE_URL}/headshots/1966.png`);
        expect(headshotUrl("doncilu01")).toBe(`${LIVE_DATA_BASE_URL}/headshots/3945274.png`);
    });

    it("has no URL for an image not mirrored yet or an unknown player", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(headshots))));
        await headshotsLoaded();
        expect(headshotUrl("hardyja02")).toBeUndefined();
        expect(headshotUrl("nobody01")).toBeUndefined();
    });

    it("has no URLs when the file fails to load", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response("missing", { status: 404 })));
        await headshotsLoaded();
        expect(headshotUrl("jamesle01")).toBeUndefined();
        expect(console.error).toHaveBeenCalled();
    });
});
