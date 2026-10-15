import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const load = async () => await import("@/lib/analytics");

beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.resetModules();
});

afterEach(() => {
    delete (window as any).umami;
});

describe("track", () => {
    it("forwards to window.umami when present", async () => {
        const { track } = await load();
        const umamiTrack = vi.fn();
        (window as any).umami = { track: umamiTrack };
        track("share_clicked", { method: "copy" });
        expect(umamiTrack).toHaveBeenCalledWith("share_clicked", { method: "copy" });
    });

    it("is a no-op without umami (dev, blockers)", async () => {
        const { track } = await load();
        expect(() => track("team_saved")).not.toThrow();
    });

    it("never lets a tracker error escape", async () => {
        const { track } = await load();
        (window as any).umami = { track: () => { throw new Error("boom"); } };
        expect(() => track("team_saved")).not.toThrow();
    });
});

describe("first_action", () => {
    it("is sent once, after the first user action", async () => {
        const { track } = await load();
        const umamiTrack = vi.fn();
        (window as any).umami = { track: umamiTrack };
        track("share_clicked", { method: "copy" });
        track("team_saved");
        const firsts = umamiTrack.mock.calls.filter(([name]) => name === "first_action");
        expect(firsts).toEqual([["first_action", { action: "share_clicked" }]]);
    });

    it("ignores passive events and still claims on the next action", async () => {
        const { track } = await load();
        const umamiTrack = vi.fn();
        (window as any).umami = { track: umamiTrack };
        track("builder_opened", { entry: "new" });
        track("public_team_viewed");
        expect(umamiTrack.mock.calls.some(([name]) => name === "first_action")).toBe(false);
        track("player_added", { from: "search", slot: "starter" });
        expect(umamiTrack).toHaveBeenCalledWith("first_action", { action: "player_added" });
    });

    it("does not spend the claim while the tracker is missing", async () => {
        const { track } = await load();
        track("team_saved");
        const umamiTrack = vi.fn();
        (window as any).umami = { track: umamiTrack };
        track("share_clicked");
        expect(umamiTrack).toHaveBeenCalledWith("first_action", { action: "share_clicked" });
    });

    it("is sent once per tab session, across a reload", async () => {
        const umamiTrack = vi.fn();
        (window as any).umami = { track: umamiTrack };
        sessionStorage.setItem("nba-central:first-action", "1");
        const { track } = await load();
        track("team_saved");
        expect(umamiTrack.mock.calls.some(([name]) => name === "first_action")).toBe(false);
    });

    it("is sent exactly once when storage is blocked", async () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        const { track } = await load();
        const umamiTrack = vi.fn();
        (window as any).umami = { track: umamiTrack };
        expect(() => {
            track("team_saved");
            track("share_clicked");
        }).not.toThrow();
        expect(umamiTrack.mock.calls.filter(([name]) => name === "first_action")).toHaveLength(1);
    });
});
