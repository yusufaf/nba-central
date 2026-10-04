import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { h, nextTick } from "vue";
import DrawingCanvas from "@/components/drawing/DrawingCanvas.vue";
import { useDrawing } from "@/composables/useDrawing";
import { installFakeCanvas, installFakeImages } from "../helpers/fakeCanvas";

class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

let canvas: ReturnType<typeof installFakeCanvas>;
let images: ReturnType<typeof installFakeImages>;

beforeEach(() => {
    canvas = installFakeCanvas();
    images = installFakeImages();
    HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
});

type Props = Partial<InstanceType<typeof DrawingCanvas>["$props"]>;

const mountCanvas = (props: Props = {}, slots: Record<string, () => unknown> = {}) => {
    const drawing = props.drawing ?? useDrawing();
    const wrapper = mount(DrawingCanvas, {
        props: { drawing, width: 2080, height: 1160, maxBytes: 1024 * 1024, ...props },
        slots,
        attachTo: document.body,
    });
    return { wrapper, drawing };
};

const canvasOf = (wrapper: ReturnType<typeof mountCanvas>["wrapper"]) =>
    wrapper.get<HTMLCanvasElement>("canvas").element;

// The canvas is shown at a quarter of its resolution, 100px from the left.
const placeCanvas = (el: HTMLCanvasElement, rect = { left: 100, top: 40, width: 520, height: 290 }) => {
    el.getBoundingClientRect = () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => ({}) });
};

const pointer = (el: Element, type: string, clientX = 0, clientY = 0) =>
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY }));

const drawLine = async (el: Element, from: [number, number], to: [number, number]) => {
    pointer(el, "pointerdown", ...from);
    pointer(el, "pointermove", (from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
    pointer(el, "pointermove", ...to);
    pointer(el, "pointerup", ...to);
    await flushPromises();
};

const commits = (wrapper: ReturnType<typeof mountCanvas>["wrapper"]) =>
    (wrapper.emitted("commit") ?? []).map(([value]) => value as string | null);

describe("DrawingCanvas", () => {
    it("draws at the resolution it is given, whatever size it is shown at", () => {
        const { wrapper } = mountCanvas({ width: 2080, height: 1160 });
        const el = canvasOf(wrapper);
        expect([el.width, el.height]).toEqual([2080, 1160]);
        expect(wrapper.get(".drawing-surface").attributes("style")).toContain("aspect-ratio: 2080 / 1160");
    });

    it("puts ink under the cursor when the canvas is scaled and offset", async () => {
        const { wrapper, drawing } = mountCanvas();
        const el = canvasOf(wrapper);
        placeCanvas(el);

        await drawLine(el, [100, 40], [620, 330]);

        expect(drawing.strokes.value).toHaveLength(1);
        expect(drawing.strokes.value[0].points[0]).toEqual({ x: 0, y: 0 });
        expect(drawing.strokes.value[0].points.at(-1)).toEqual({ x: 2080, y: 1160 });
    });

    it("keeps two gestures as two strokes, and stops a stroke when the pointer leaves (#47)", async () => {
        const { wrapper, drawing } = mountCanvas();
        const el = canvasOf(wrapper);
        placeCanvas(el);

        await drawLine(el, [110, 50], [200, 50]);
        pointer(el, "pointerdown", 300, 200);
        pointer(el, "pointermove", 320, 200);
        pointer(el, "pointerleave", 320, 200);
        pointer(el, "pointermove", 600, 300);
        await flushPromises();

        expect(drawing.strokes.value).toHaveLength(2);
        expect(drawing.strokes.value[1].points).toHaveLength(2);
        const painted = canvas.contexts.get(el)!.paths();
        expect(painted.at(-2)![0]).toEqual(["moveTo", 40, 40]);
        expect(painted.at(-1)![0]).toEqual(["moveTo", 800, 640]);
    });

    it("replays strokes the owner kept when it mounts again, so it never comes back blank (#85)", async () => {
        const drawing = useDrawing();
        const first = mountCanvas({ drawing });
        placeCanvas(canvasOf(first.wrapper));
        await drawLine(canvasOf(first.wrapper), [110, 50], [200, 50]);
        await drawLine(canvasOf(first.wrapper), [300, 200], [400, 250]);
        first.wrapper.unmount();

        const second = mountCanvas({ drawing });
        await flushPromises();
        expect(canvas.contexts.get(canvasOf(second.wrapper))!.paths()).toHaveLength(2);
    });

    it("repaints every stroke after any change, never just a cleared canvas (#85)", async () => {
        const { wrapper, drawing } = mountCanvas();
        const el = canvasOf(wrapper);
        placeCanvas(el);
        await drawLine(el, [110, 50], [200, 50]);
        await drawLine(el, [300, 200], [400, 250]);
        const ctx = canvas.contexts.get(el)!;

        ctx.reset();
        drawing.strokeColor.value = "#df2030";
        await wrapper.setProps({ maxBytes: 2 * 1024 * 1024 });
        await nextTick();
        drawing.strokes.value = [...drawing.strokes.value];
        await nextTick();

        const lastClear = ctx.calls.map(([name]) => name).lastIndexOf("clearRect");
        expect(lastClear).toBeGreaterThanOrEqual(0);
        expect(ctx.calls.slice(lastClear).filter(([name]) => name === "stroke")).toHaveLength(2);
    });

    it("exports the strokes alone on a transparent canvas when there is no template", async () => {
        const { wrapper } = mountCanvas();
        const el = canvasOf(wrapper);
        placeCanvas(el);
        canvas.state.dataUrlLength = 500;

        await drawLine(el, [110, 50], [200, 50]);

        const [dataUrl] = commits(wrapper);
        expect(dataUrl).toMatch(/^data:image\/png;base64,/);
        const output = [...canvas.contexts.entries()].find(([c]) => c !== el)!;
        expect([output[0].width, output[0].height]).toEqual([2080, 1160]);
        expect(output[1].calls.filter(([name]) => name === "drawImage")).toEqual([["drawImage", el, 0, 0]]);
        expect(wrapper.find('img[data-part="template"]').exists()).toBe(false);
    });

    it("flattens a template under the strokes, at the canvas size", async () => {
        const { wrapper } = mountCanvas({ width: 900, height: 1253, template: "/jersey.png" });
        await flushPromises();
        const el = canvasOf(wrapper);
        placeCanvas(el, { left: 0, top: 0, width: 300, height: 417.67 });
        expect(wrapper.get('img[data-part="template"]').attributes("src")).toBe("/jersey.png");

        await drawLine(el, [10, 10], [100, 100]);

        const output = [...canvas.contexts.entries()].find(([c]) => c !== el)![1];
        const draws = output.calls.filter(([name]) => name === "drawImage");
        expect(draws).toHaveLength(2);
        expect(draws[0].slice(2)).toEqual([0, 0, 900, 1253]);
        expect((draws[0][1] as HTMLImageElement).src).toBe("/jersey.png");
        expect(draws[1]).toEqual(["drawImage", el, 0, 0]);
        expect(images.loaded).toContain("/jersey.png");
    });

    it("drops a template that goes away, so the export no longer carries it", async () => {
        const { wrapper } = mountCanvas({ template: "https://cdn.example/arenas/a1/drawing-1.png" });
        await flushPromises();
        await wrapper.setProps({ template: null });
        const el = canvasOf(wrapper);
        placeCanvas(el);

        await drawLine(el, [110, 50], [200, 50]);

        const output = [...canvas.contexts.entries()].find(([c]) => c !== el)![1];
        expect(output.calls.filter(([name]) => name === "drawImage")).toEqual([["drawImage", el, 0, 0]]);
        expect(commits(wrapper)).toHaveLength(1);
    });

    it("says it can't save while the template is still loading, then commits once it has", async () => {
        const { wrapper } = mountCanvas({ template: "https://cdn.example/slow/drawing-1.png" });
        await flushPromises();
        const el = canvasOf(wrapper);
        placeCanvas(el);

        await drawLine(el, [110, 50], [200, 50]);
        expect(commits(wrapper)).toEqual([null]);

        images.release();
        await flushPromises();
        expect(commits(wrapper)).toHaveLength(2);
        expect(commits(wrapper)[1]).toMatch(/^data:image\/png/);
    });

    it("loads a template anonymously, so a CDN image doesn't taint the export", async () => {
        const { wrapper } = mountCanvas({ template: "https://cdn.example/arenas/a1/drawing-1.png" });
        await flushPromises();
        expect(wrapper.get('img[data-part="template"]').attributes("crossorigin")).toBe("anonymous");
    });

    it("refuses to save while the template can't load, and says so", async () => {
        const { wrapper } = mountCanvas({ template: "https://dead.example/drawing.png", templateErrorMessage: "No template." });
        await flushPromises();
        const el = canvasOf(wrapper);
        placeCanvas(el);

        await drawLine(el, [110, 50], [200, 50]);

        expect(commits(wrapper)).toEqual([null]);
        expect(wrapper.text()).toContain("No template.");
    });

    it("rejects a drawing over the size limit with a clear message, and accepts one at it", async () => {
        const { wrapper } = mountCanvas({ maxBytes: 1000, tooLargeMessage: "Too big to save." });
        const el = canvasOf(wrapper);
        placeCanvas(el);

        canvas.state.dataUrlLength = Math.floor((1000 * 4) / 3);
        await drawLine(el, [110, 50], [200, 50]);
        expect(commits(wrapper).at(-1)).toMatch(/^data:image\/png/);
        expect(wrapper.text()).not.toContain("Too big to save.");

        canvas.state.dataUrlLength = 1400;
        await drawLine(el, [300, 50], [400, 50]);
        expect(commits(wrapper).at(-1)).toBeNull();
        expect(wrapper.get('[role="alert"]').text()).toBe("Too big to save.");
    });

    it("commits again after Undo and Clear", async () => {
        const { wrapper, drawing } = mountCanvas();
        const el = canvasOf(wrapper);
        placeCanvas(el);
        await drawLine(el, [110, 50], [200, 50]);
        await drawLine(el, [300, 50], [400, 50]);

        const button = (label: string) => wrapper.findAll("button").find((b) => b.text() === label)!;
        await button("Undo").trigger("click");
        expect(drawing.strokes.value).toHaveLength(1);
        await button("Clear").trigger("click");
        expect(drawing.strokes.value).toHaveLength(0);
        expect(commits(wrapper)).toHaveLength(4);
    });

    it("scales the brush widths to the surface", async () => {
        const drawing = useDrawing({ strokeWidth: 12 });
        const { wrapper } = mountCanvas({ drawing, brushScale: 2 });
        const item = (label: string) => wrapper.findAll("button").find((b) => b.text() === label)!;

        expect(item("Medium").attributes("data-state")).toBe("on");
        await item("Thick").trigger("click");
        expect(drawing.strokeWidth.value).toBe(24);
        await item("Thin").trigger("click");
        expect(drawing.strokeWidth.value).toBe(6);
    });

    it("shows a backdrop under the ink and an overlay above it, neither of them exported", async () => {
        const { wrapper } = mountCanvas(
            {},
            { backdrop: () => h("div", { id: "court-under" }), overlay: () => h("div", { id: "court-text" }) },
        );
        const surface = wrapper.get(".drawing-surface").element;
        const order = [...surface.children].map((el) => el.firstElementChild?.id || el.tagName.toLowerCase());
        expect(order).toEqual(["court-under", "canvas", "court-text"]);
        expect(wrapper.get("#court-text").element.parentElement!.className).toContain("pointer-events-none");
    });
});
