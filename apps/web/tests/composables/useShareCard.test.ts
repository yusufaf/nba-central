import { describe, it, expect, vi } from "vitest";

vi.mock("html-to-image", () => ({
    toPng: vi.fn(async () => "data:image/png;base64,QUJD"),
}));

import { toPng } from "html-to-image";
import { renderShareCard, toShareCardProps } from "@/composables/useShareCard";

const court = {
    version: 1 as const,
    wood: "maple" as const,
    paint: "#4b2a7b",
    apron: "#4b2a7b",
    lines: "#ffffff",
    centerLogo: "team" as const,
    baselineText: "Harbor Pavilion",
    sidelineText: "Seattle",
};

const team = {
    title: "T",
    city: "C",
    country: "",
    logoUrl: "https://cdn.example/team.png",
    jerseyUrl: "",
    username: "u",
    roster: [],
};

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

    it("adds nothing for an arena without a court, so the card is unchanged", () => {
        const props = toShareCardProps({ ...team, arena: { name: "United Center", court: null } });
        expect(Object.keys(props).sort()).toEqual(
            ["city", "country", "jerseyUrl", "logoUrl", "starters", "title", "username"],
        );
    });

    it("takes the court, centre logo and arena name from the resolved arena", () => {
        const arena = {
            name: "Harbor Pavilion",
            court,
            logoUrl: "https://cdn.example/arenas/a1/logo-1.png",
            drawingUrl: "https://cdn.example/arenas/a1/drawing-1.png",
        };
        expect(toShareCardProps({ ...team, arena })).toMatchObject({
            court,
            courtLogoUrl: "https://cdn.example/team.png",
            courtDrawingUrl: arena.drawingUrl,
            arenaName: "Harbor Pavilion",
        });
        const uploaded = toShareCardProps({ ...team, arena: { ...arena, court: { ...court, centerLogo: "upload" as const } } });
        expect(uploaded.courtLogoUrl).toBe(arena.logoUrl);
        const none = toShareCardProps({ ...team, arena: { ...arena, court: { ...court, centerLogo: "none" as const } } });
        expect(none.courtLogoUrl).toBeUndefined();
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

    // html-to-image swaps each image for a fetched data URL and, by default,
    // rejects the whole export when one fails to load. The court's centre
    // logo is an SVG <image> with no @error swap of its own, so a dead logo
    // URL must drop that image, not the card.
    it("leaves out an image that fails to load instead of failing the export", async () => {
        await renderShareCard({
            title: "T", city: "", country: "", logoUrl: "", jerseyUrl: "", username: "u", starters: [],
        });
        const { onImageErrorHandler } = vi.mocked(toPng).mock.calls.at(-1)![1]!;
        expect(onImageErrorHandler).toBeTypeOf("function");
        expect(() => onImageErrorHandler!(new Event("error"))).not.toThrow();
    });
});

