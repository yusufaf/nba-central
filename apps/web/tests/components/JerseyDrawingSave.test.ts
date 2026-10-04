import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import JerseyDrawingCanvas from "@/components/TeamBuilder/JerseyDrawingCanvas.vue";
import jerseyTemplate from "@/assets/basketball_jersey.png";
import { installFakeCanvas, installFakeImages } from "../helpers/fakeCanvas";

class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// The jersey on the shared drawing surface: the same template, resolution,
// size limit and saved-drawing behaviour it had on its own canvas.
let canvas: ReturnType<typeof installFakeCanvas>;

beforeEach(() => {
    canvas = installFakeCanvas();
    installFakeImages();
    HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
});

const mountJersey = async (teamJersey = "") => {
    const updates: string[] = [];
    const wrapper = mount(JerseyDrawingCanvas, {
        props: { teamJersey, "onUpdate:teamJersey": (value: string | undefined) => updates.push(value ?? "") },
        attachTo: document.body,
    });
    await flushPromises();
    const el = wrapper.get<HTMLCanvasElement>("canvas").element;
    el.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 300, height: 417.67, right: 300, bottom: 417.67, x: 0, y: 0 }) as DOMRect;
    return { wrapper, el, updates };
};

const stroke = async (el: Element) => {
    for (const [type, x] of [["pointerdown", 10], ["pointermove", 50], ["pointerup", 50]] as const) {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: 20 }));
    }
    await flushPromises();
};

const button = (wrapper: Awaited<ReturnType<typeof mountJersey>>["wrapper"], label: string) =>
    wrapper.findAll("button").find((b) => b.text() === label);

describe("JerseyDrawingCanvas saving", () => {
    it("draws on a 900x1253 canvas over the jersey template, shown at most 20rem wide", async () => {
        const { wrapper, el } = await mountJersey();
        expect([el.width, el.height]).toEqual([900, 1253]);
        expect(wrapper.get('img[data-part="template"]').attributes("src")).toBe(jerseyTemplate);
        expect(wrapper.get(".drawing-surface").attributes("style")).toContain("max-width: 20rem");
    });

    it("writes the template and strokes, flattened, as a PNG data URL after each stroke", async () => {
        const { el, updates } = await mountJersey();
        await stroke(el);

        expect(updates).toHaveLength(1);
        expect(updates[0]).toMatch(/^data:image\/png;base64,/);
        const output = [...canvas.contexts.entries()].find(([c]) => c !== el)![1];
        const draws = output.calls.filter(([name]) => name === "drawImage");
        expect((draws[0][1] as HTMLImageElement).src).toBe(jerseyTemplate);
        expect(draws[1]).toEqual(["drawImage", el, 0, 0]);
    });

    it("keeps the last drawing that fit when one goes over 200 KB, and says why", async () => {
        const { wrapper, el, updates } = await mountJersey();
        canvas.state.dataUrlLength = 210 * 1024 * (4 / 3);
        await stroke(el);

        expect(updates).toEqual([]);
        expect(wrapper.text()).toContain("This drawing is too detailed to save - try Clear and a simpler design.");
    });

    it("draws over a saved drawing, and Start over goes back to the bare template", async () => {
        const saved = "data:image/png;base64,c2F2ZWQ=";
        const { wrapper, updates } = await mountJersey(saved);
        expect(wrapper.get('img[data-part="template"]').attributes("src")).toBe(saved);
        expect(wrapper.text()).toContain("Editing your saved drawing - Undo only covers strokes made in this session.");

        await button(wrapper, "Start over")!.trigger("click");
        await flushPromises();

        expect(updates).toEqual([""]);
        expect(wrapper.get('img[data-part="template"]').attributes("src")).toBe(jerseyTemplate);
        expect(button(wrapper, "Start over")).toBeUndefined();
        expect(wrapper.text()).not.toContain("Editing your saved drawing");
    });

    it("says so, and saves nothing, when the jersey background can't load", async () => {
        const { wrapper, el, updates } = await mountJersey("data:image/png;base64,dead");
        await stroke(el);

        expect(updates).toEqual([]);
        expect(wrapper.text()).toContain(
            "Couldn't load the jersey background, so drawing can't be saved right now - try reopening this dialog.",
        );
    });
});
