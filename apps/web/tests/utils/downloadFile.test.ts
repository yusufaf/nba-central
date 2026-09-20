import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { downloadUrlAsFile, slugFilename } from "@/utils/downloadFile";

describe("slugFilename", () => {
    it("slugifies a team name into a lowercase, hyphenated filename", () => {
        expect(slugFilename("Chicago Bulls '96!", "png")).toBe("chicago-bulls-96.png");
    });

    it("falls back to 'team' for an empty name", () => {
        expect(slugFilename("", "png")).toBe("team.png");
    });
});

describe("downloadUrlAsFile", () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        vi.stubGlobal("URL", {
            ...URL,
            createObjectURL: vi.fn(() => "blob:mock"),
            revokeObjectURL: vi.fn(),
        });
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.unstubAllGlobals();
    });

    it("rejects when the response is not ok", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
        await expect(downloadUrlAsFile("https://cdn.example/x.png", "x.png")).rejects.toThrow(
            "Download failed: 404",
        );
    });

    it("downloads the blob and revokes the object URL only after the deferral delay", async () => {
        vi.useFakeTimers();
        const blob = new Blob(["png"]);
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => blob });
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

        await downloadUrlAsFile("https://cdn.example/x.png", "x.png");

        expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
        expect(clickSpy).toHaveBeenCalled();
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1000);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");

        clickSpy.mockRestore();
        vi.useRealTimers();
    });
});
