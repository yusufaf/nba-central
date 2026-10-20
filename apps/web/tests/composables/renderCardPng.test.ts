import { describe, it, expect, vi } from "vitest";
import { defineComponent, h } from "vue";

vi.mock("html-to-image", () => ({
    toPng: vi.fn(async () => "data:image/png;base64,QUJD"),
}));

import { toPng } from "html-to-image";
import { renderCardPng } from "@/composables/renderCardPng";

const Card = defineComponent({
    props: { label: { type: String, required: true } },
    render() {
        return h("div", { "data-testid": "card" }, this.label);
    },
});

describe("renderCardPng", () => {
    it("renders any card off-screen and returns its PNG data URL", async () => {
        const before = document.body.children.length;
        await expect(renderCardPng(Card, { label: "x" })).resolves.toBe("data:image/png;base64,QUJD");

        const [el, options] = vi.mocked(toPng).mock.calls.at(-1)!;
        expect((el as HTMLElement).textContent).toBe("x");
        expect(options).toEqual(expect.objectContaining({ width: 1200, height: 630, pixelRatio: 1, cacheBust: true }));
        expect(document.body.children.length).toBe(before);
    });

    it("removes its host when the export fails", async () => {
        const before = document.body.children.length;
        vi.mocked(toPng).mockRejectedValueOnce(new Error("tainted"));
        await expect(renderCardPng(Card, { label: "x" })).rejects.toThrow("tainted");
        expect(document.body.children.length).toBe(before);
    });
});
