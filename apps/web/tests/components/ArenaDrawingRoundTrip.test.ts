import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import ArenaSection from "@/components/TeamBuilder/ArenaSection.vue";
import { installFakeCanvas, installFakeImages } from "../helpers/fakeCanvas";

// The court drawing from the dialog through useCustomArenas to a stateful
// API stub and back: draw and save, reopen, save unchanged, clear.
const server = vi.hoisted(() => ({ arenas: new Map<string, Record<string, unknown>>(), uploads: 0 }));
const api = vi.hoisted(() => ({
    list: vi.fn(async () => ({ success: true, data: { customArenas: [...server.arenas.values()] } })),
    update: vi.fn(async (arenaUUID: string, data: Record<string, unknown>) => {
        const arena = { ...server.arenas.get(arenaUUID), ...data };
        server.arenas.set(arenaUUID, arena);
        return { success: true, data: arena };
    }),
    uploadImage: vi.fn(async (arenaUUID: string, slot: string) => {
        const url = `https://cdn.example/arenas/${arenaUUID}/${slot}-${++server.uploads}.png`;
        server.arenas.set(arenaUUID, { ...server.arenas.get(arenaUUID), [`${slot}Url`]: url });
        return { success: true, data: { url } };
    }),
    deleteImage: vi.fn(async (arenaUUID: string, slot: string) => {
        const { [`${slot}Url`]: _gone, ...rest } = server.arenas.get(arenaUUID) ?? {};
        server.arenas.set(arenaUUID, rest);
        return { success: true };
    }),
    create: vi.fn(),
    delete: vi.fn(),
}));
vi.mock("@/network/api", () => ({ customArenaApi: api }));

vi.mock("@/composables/useCurrentUser", () => ({
    useCurrentUser: () => ({ currentUser: ref({ id: "user-1", username: "someone", memberSince: null }) }),
}));
vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const court = {
    version: 1,
    wood: "maple",
    paint: "#4b2a7b",
    apron: "#4b2a7b",
    lines: "#ffffff",
    centerLogo: "none",
    baselineText: "Harbor Pavilion",
    sidelineText: "Seattle",
};

beforeEach(() => {
    installFakeCanvas();
    installFakeImages();
    HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
    server.arenas.clear();
    server.arenas.set("a1", {
        arenaUUID: "a1",
        name: "Harbor Pavilion",
        location: "",
        capacity: null,
        openedYear: null,
        court,
        created: "2026-10-01T00:00:00.000Z",
        isCustom: true,
    });
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
});

const settle = async () => {
    await flushPromises();
    await nextTick();
    await flushPromises();
};

const button = (label: string) =>
    [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label) as HTMLButtonElement;

const openEditor = async () => {
    button("Edit arena").click();
    await settle();
    const trigger = [...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent?.trim() === "Drawing")!;
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    await settle();
};

const save = async () => {
    (document.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await settle();
};

const cardDrawing = () =>
    document.querySelector('[data-testid="arena-court"] [data-part="drawing"]')?.getAttribute("href") ?? null;

describe("court drawing round trip", () => {
    it("saves a drawing with the arena, brings it back, and deletes it on clear", async () => {
        const wrapper = mount(ArenaSection, {
            props: {
                selectedDrawerSide: "right",
                teamLogo: "",
                teamArena: { name: "Harbor Pavilion", isCustom: true, arenaUUID: "a1" },
                "onUpdate:teamArena": () => {},
                showArenaDrawer: false,
                "onUpdate:showArenaDrawer": () => {},
            },
            attachTo: document.body,
        });
        await settle();
        expect(cardDrawing()).toBeNull();

        // Draw and save: the arena first, then the drawing slot.
        await openEditor();
        const canvas = document.querySelector('canvas[aria-label="Court drawing"]') as HTMLCanvasElement;
        canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 520, height: 290 }) as DOMRect;
        canvas.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
        canvas.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 90, clientY: 50 }));
        canvas.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 90, clientY: 50 }));
        await settle();
        await save();

        expect(api.update).toHaveBeenCalledTimes(1);
        expect(api.uploadImage).toHaveBeenCalledWith("a1", "drawing", expect.any(String));
        expect(api.update.mock.invocationCallOrder[0]).toBeLessThan(api.uploadImage.mock.invocationCallOrder[0]);
        const url = "https://cdn.example/arenas/a1/drawing-1.png";
        expect(cardDrawing()).toBe(url);

        // Reopen: the saved drawing is under the canvas, and saving
        // without drawing touches no image.
        await openEditor();
        expect(document.querySelector('img[data-part="template"]')?.getAttribute("src")).toBe(url);
        expect(button("Undo").disabled).toBe(true);
        await save();
        expect(api.uploadImage).toHaveBeenCalledTimes(1);
        expect(api.deleteImage).not.toHaveBeenCalled();
        expect(cardDrawing()).toBe(url);

        // Start over removes it from the arena.
        await openEditor();
        button("Start over").click();
        await settle();
        await save();
        expect(api.deleteImage).toHaveBeenCalledWith("a1", "drawing");
        expect(cardDrawing()).toBeNull();

        wrapper.unmount();
    });
});
