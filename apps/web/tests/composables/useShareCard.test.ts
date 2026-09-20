import { describe, it, expect, vi } from "vitest";

vi.mock("html-to-image", () => ({
    toPng: vi.fn(async () => "data:image/png;base64,QUJD"),
}));

import { toPng } from "html-to-image";
import { renderShareCard, toShareCardProps } from "@/composables/useShareCard";

describe("toShareCardProps", () => {
    it("takes starters from slots 1-5 in order and maps ratings from either player shape", () => {
        const props = toShareCardProps({
            title: "T",
            city: "C",
            country: "",
            logoUrl: "",
            jerseyUrl: "",
            username: "u",
            roster: [
                { slot: 3, player: { fullName: "Three", position: "SF", rating: 80 } },
                { slot: 6, player: { fullName: "Bench" } },
                { slot: 1, player: { fullName: "One", position: "PG", overallRating: 70, isCustom: true } },
            ],
        } as any);
        expect(props.starters.map((s) => s.fullName)).toEqual(["One", "Three"]);
        expect(props.starters[0].rating).toBe(70);
        expect(props.starters[1].rating).toBe(80);
    });
});

describe("renderShareCard", () => {
    it("mounts the card off-screen, exports at 1200x630, and cleans up", async () => {
        const before = document.body.childElementCount;
        const png = await renderShareCard({
            title: "T", city: "", country: "", logoUrl: "", jerseyUrl: "", username: "u", starters: [],
        });
        expect(png).toBe("QUJD");
        const opts = vi.mocked(toPng).mock.calls[0][1];
        expect(opts).toMatchObject({ width: 1200, height: 630, pixelRatio: 1 });
        expect(document.body.childElementCount).toBe(before);
    });

    it("does not wait forever for an image that never loads or errors", async () => {
        vi.useFakeTimers();
        try {
            const pending = renderShareCard({
                title: "T",
                city: "",
                country: "",
                logoUrl: "https://cdn.example/logo.png",
                jerseyUrl: "",
                username: "u",
                starters: [],
            });
            await vi.advanceTimersByTimeAsync(4000);
            await expect(pending).resolves.toBe("QUJD");
        } finally {
            vi.useRealTimers();
        }
    });
});
