import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import CreateCustomArenaModal from "@/components/TeamBuilder/CreateCustomArenaModal.vue";
import type { CourtDesign, CustomArena, CustomArenaPayload } from "@/models/api";
import type { ArenaImageChanges } from "@/composables/useCustomArenas";
import { installFakeCanvas, installFakeImages } from "../helpers/fakeCanvas";

vi.mock("@/utils/arenaImage", () => ({
    resizeArenaPhoto: async () => new Blob(["jpeg"], { type: "image/jpeg" }),
    resizeCourtLogo: async () => new Blob(["png"], { type: "image/png" }),
}));

class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const SAVED = "https://cdn.example/arenas/a/drawing-1.png";

const court: CourtDesign = {
    version: 1,
    wood: "honey",
    paint: "#0f6b3c",
    apron: null,
    lines: "#ffffff",
    centerLogo: "none",
    baselineText: "Pioneers",
    sidelineText: "Est. 2026",
};

const arena = (extra: Partial<CustomArena> = {}): CustomArena => ({
    arenaUUID: "a",
    name: "Arena a",
    location: "",
    capacity: null,
    openedYear: null,
    court,
    created: "2026-10-01T00:00:00.000Z",
    isCustom: true,
    ...extra,
});

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

const mountModal = async (editingArena: CustomArena | null) => {
    const wrapper = mount(CreateCustomArenaModal, {
        props: { open: true, editingArena, "onUpdate:open": () => {} },
        attachTo: document.body,
    });
    await flushPromises();
    return wrapper;
};

const openTab = async (label: string) => {
    const trigger = [...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent?.trim() === label)!;
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    await flushPromises();
};

const button = (label: string) =>
    [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined;

const drawingCanvas = () => document.querySelector('canvas[aria-label="Court drawing"]') as HTMLCanvasElement;

// Shown at a quarter of its 2080x1160 resolution.
const drawStroke = async (from: [number, number] = [10, 10], to: [number, number] = [100, 60]) => {
    const el = drawingCanvas();
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 520, height: 290, right: 520, bottom: 290, x: 0, y: 0 }) as DOMRect;
    el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: from[0], clientY: from[1] }));
    el.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: to[0], clientY: to[1] }));
    el.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: to[0], clientY: to[1] }));
    await flushPromises();
};

const submitted = async (wrapper: VueWrapper) => {
    (document.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await flushPromises();
    const events = wrapper.emitted("submit") as [CustomArenaPayload, ArenaImageChanges][] | undefined;
    return events?.at(-1);
};

describe("CreateCustomArenaModal drawing", () => {
    it("has a Drawing tab next to Details and Court", async () => {
        await mountModal(null);
        expect([...document.querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim())).toEqual([
            "Details",
            "Court",
            "Drawing",
        ]);
    });

    it("asks for a court before there is anything to draw on", async () => {
        await mountModal(arena({ court: null }));
        await openTab("Drawing");
        expect(drawingCanvas()).toBeNull();
        expect(document.body.textContent).toContain("Design a court first");
    });

    it("draws over the court, which is shown but not part of the drawing, at 2x its viewBox", async () => {
        await mountModal(arena());
        await openTab("Drawing");

        const el = drawingCanvas();
        expect([el.width, el.height]).toEqual([2080, 1160]);
        const surface = el.parentElement!;
        expect(surface.querySelector('[data-part="floor"]')).not.toBeNull();
        expect(surface.querySelectorAll('[data-part="baseline-text"]')).toHaveLength(2);
        // The text sits over the ink, as it does on every other surface.
        const layers = [...surface.children];
        const textLayer = layers.findIndex((layer) => layer.querySelector('[data-part="baseline-text"]'));
        expect(textLayer).toBeGreaterThan(layers.indexOf(el));
    });

    it("hands back the new drawing as a PNG with the arena", async () => {
        const wrapper = await mountModal(arena());
        await openTab("Drawing");
        await drawStroke();

        const [, images] = (await submitted(wrapper))!;
        expect(images.drawing).toBeInstanceOf(Blob);
        expect((images.drawing as Blob).type).toBe("image/png");
        expect(images.photo).toBeUndefined();
        expect(images.logo).toBeUndefined();
    });

    it("leaves a saved drawing alone when nothing was drawn, and shows it under new ink", async () => {
        const wrapper = await mountModal(arena({ drawingUrl: SAVED }));
        await openTab("Drawing");
        expect(document.querySelector('img[data-part="template"]')?.getAttribute("src")).toBe(SAVED);
        expect(document.body.textContent).toContain("Editing your saved drawing");

        const [, images] = (await submitted(wrapper))!;
        expect("drawing" in images ? images.drawing : undefined).toBeUndefined();
    });

    it("leaves a saved drawing alone after drawing and clearing this session's strokes", async () => {
        const wrapper = await mountModal(arena({ drawingUrl: SAVED }));
        await openTab("Drawing");
        await drawStroke();
        button("Clear")!.click();
        await flushPromises();

        const [, images] = (await submitted(wrapper))!;
        expect(images.drawing).toBeUndefined();
    });

    it("deletes a saved drawing on Start over, and sends nothing for one that was never saved", async () => {
        const saved = await mountModal(arena({ drawingUrl: SAVED }));
        await openTab("Drawing");
        button("Start over")!.click();
        await flushPromises();
        expect(document.querySelector('img[data-part="template"]')).toBeNull();
        expect((await submitted(saved))![1].drawing).toBeNull();
        saved.unmount();

        const fresh = await mountModal(arena());
        await openTab("Drawing");
        await drawStroke();
        button("Start over")!.click();
        await flushPromises();
        expect((await submitted(fresh))![1].drawing).toBeUndefined();
    });

    it("keeps the strokes and Undo across a tab switch, and repaints them (#85)", async () => {
        await mountModal(arena());
        await openTab("Drawing");
        await drawStroke([10, 10], [100, 60]);
        await drawStroke([200, 100], [300, 120]);

        await openTab("Court");
        await openTab("Drawing");

        const ctx = canvas.contexts.get(drawingCanvas())!;
        expect(ctx.paths()).toHaveLength(2);
        expect(button("Undo")!.disabled).toBe(false);
    });

    // The tab remounts the canvas, which reloads the saved drawing under it.
    it("never saves an export older than the strokes while the saved drawing reloads", async () => {
        const slow = "https://cdn.example/slow/arenas/a/drawing-1.png";
        const wrapper = await mountModal(arena({ drawingUrl: slow }));
        await openTab("Drawing");
        images.release();
        await flushPromises();
        canvas.state.dataUrlLength = 400;
        await drawStroke([10, 10], [100, 60]);
        canvas.state.dataUrlLength = 600;
        await drawStroke([200, 100], [300, 120]);

        await openTab("Court");
        await openTab("Drawing");
        button("Undo")!.click();
        await flushPromises();

        const submit = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        expect(submit.disabled).toBe(true);

        canvas.state.dataUrlLength = 500;
        images.release();
        await flushPromises();
        expect(submit.disabled).toBe(false);
        const [, images_] = (await submitted(wrapper))!;
        expect((images_.drawing as Blob).size).toBe(Math.floor(((500 - 22) * 3) / 4));
    });

    it("keeps the drawing when the court settings change, and shows it in the Court preview", async () => {
        const wrapper = await mountModal(arena());
        await openTab("Drawing");
        await drawStroke();

        await openTab("Court");
        button("Walnut")!.click();
        await flushPromises();
        const previewDrawing = document.querySelector('[data-testid="court-preview"] [data-part="drawing"]');
        expect(previewDrawing?.getAttribute("href")).toMatch(/^data:image\/png;base64,/);

        const [data, images] = (await submitted(wrapper))!;
        expect(data.court?.wood).toBe("walnut");
        expect(images.drawing).toBeInstanceOf(Blob);
    });

    it("won't save a drawing over 1 MB, and says why", async () => {
        const wrapper = await mountModal(arena());
        await openTab("Drawing");
        canvas.state.dataUrlLength = Math.ceil((1024 * 1024 * 4) / 3) + 100;
        await drawStroke();

        expect(document.body.textContent).toContain("This drawing is over 1 MB");
        expect((document.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
        expect(await submitted(wrapper)).toBeUndefined();

        canvas.state.dataUrlLength = 1000;
        button("Undo")!.click();
        await flushPromises();
        expect((document.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
    });

    // jsdom can't evaluate container queries, so this checks the wiring:
    // below a 40rem container only the read-only view shows (the real
    // layout is checked in the browser).
    it("swaps the canvas for a read-only court with Clear below a 40rem container", async () => {
        await mountModal(arena({ drawingUrl: SAVED }));
        await openTab("Drawing");

        const editable = document.querySelector('[data-testid="drawing-editor"]')!;
        const readOnly = document.querySelector('[data-testid="drawing-read-only"]')!;
        expect(editable.className.split(" ")).toEqual(expect.arrayContaining(["hidden", "@min-[40rem]:block"]));
        expect(readOnly.className.split(" ")).toContain("@min-[40rem]:hidden");
        expect(readOnly.closest(".\\@container")).not.toBeNull();

        expect(readOnly.querySelector("canvas")).toBeNull();
        expect(readOnly.querySelector('[data-part="drawing"]')?.getAttribute("href")).toBe(SAVED);
        expect(readOnly.textContent).toContain("Drawing on the court needs a wider screen.");
        const readOnlyButtons = [...readOnly.querySelectorAll("button")].map((b) => b.textContent?.trim());
        expect(readOnlyButtons).toEqual(["Clear drawing"]);
    });

    it("clears a saved drawing from the read-only view", async () => {
        const wrapper = await mountModal(arena({ drawingUrl: SAVED }));
        await openTab("Drawing");
        const readOnly = document.querySelector('[data-testid="drawing-read-only"]')!;
        (readOnly.querySelector("button") as HTMLButtonElement).click();
        await flushPromises();

        expect(readOnly.querySelector('[data-part="drawing"]')).toBeNull();
        expect(readOnly.querySelector("button")).toBeNull();
        expect((await submitted(wrapper))![1].drawing).toBeNull();
    });

    it("starts each opening from the arena's saved drawing, not the last session's strokes", async () => {
        const wrapper = await mountModal(arena());
        await openTab("Drawing");
        await drawStroke();

        await wrapper.setProps({ open: false });
        await wrapper.setProps({ open: true, editingArena: arena({ drawingUrl: SAVED }) });
        await flushPromises();
        await openTab("Drawing");

        expect(button("Undo")!.disabled).toBe(true);
        expect(document.querySelector('img[data-part="template"]')?.getAttribute("src")).toBe(SAVED);
        expect((await submitted(wrapper))![1].drawing).toBeUndefined();
    });
});
