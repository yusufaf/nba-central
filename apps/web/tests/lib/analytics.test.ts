import { describe, it, expect, vi, afterEach } from "vitest";
import { track } from "@/lib/analytics";

afterEach(() => {
    delete (window as any).umami;
});

describe("track", () => {
    it("forwards to window.umami when present", () => {
        const umamiTrack = vi.fn();
        (window as any).umami = { track: umamiTrack };
        track("share_clicked", { method: "copy" });
        expect(umamiTrack).toHaveBeenCalledWith("share_clicked", { method: "copy" });
    });

    it("is a no-op without umami (dev, blockers)", () => {
        expect(() => track("team_saved")).not.toThrow();
    });

    it("never lets a tracker error escape", () => {
        (window as any).umami = { track: () => { throw new Error("boom"); } };
        expect(() => track("team_saved")).not.toThrow();
    });
});
