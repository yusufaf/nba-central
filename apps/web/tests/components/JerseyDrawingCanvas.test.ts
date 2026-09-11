import { describe, it, expect, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import JerseyDrawingCanvas from "@/components/TeamBuilder/JerseyDrawingCanvas.vue";

// jsdom has no ResizeObserver, which reka-ui's ColorArea/ColorSlider use to
// track their own size. The picker only opens inside a test that drives it,
// so a no-op stub is enough - nothing here asserts on measured layout.
class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom has no Canvas2D context and no setPointerCapture, so these
// assertions stay DOM-only - the swatch/custom-picker wiring, not stroke
// rendering. ColorPicker's Popover content teleports to document.body, same
// as ArenaSection's Sheet/DropdownMenu, so it's queried live off the
// document rather than the wrapper's own render tree.
const mountCanvas = () =>
    mount(JerseyDrawingCanvas, {
        props: {
            teamJersey: "",
            "onUpdate:teamJersey": () => {},
        },
        attachTo: document.body,
    });

const swatchButtons = (wrapper: ReturnType<typeof mountCanvas>) => wrapper.findAll(".jersey-swatch");

const customTrigger = (wrapper: ReturnType<typeof mountCanvas>) =>
    wrapper.get<HTMLButtonElement>(".color-picker-trigger");

const hexInput = () => document.querySelector(".color-picker-hex-input") as HTMLInputElement;

describe("JerseyDrawingCanvas stroke color", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("starts on the White preset, with the custom trigger matching it", () => {
        const wrapper = mountCanvas();

        const selected = swatchButtons(wrapper).filter((btn) => btn.classes("selected"));
        expect(selected).toHaveLength(1);
        expect(selected[0].attributes("aria-label")).toBe("White");
        expect(customTrigger(wrapper).element.style.backgroundColor).toBe("rgb(255, 255, 255)");
        expect(customTrigger(wrapper).classes("selected")).toBe(false);

        wrapper.unmount();
    });

    it("clicking a preset moves the ring to it and syncs the custom trigger's color", async () => {
        const wrapper = mountCanvas();

        const crimson = swatchButtons(wrapper).find((btn) => btn.attributes("aria-label") === "Crimson");
        await crimson?.trigger("click");

        expect(crimson?.classes("selected")).toBe(true);
        expect(customTrigger(wrapper).element.style.backgroundColor).toBe("rgb(223, 32, 48)");
        expect(customTrigger(wrapper).classes("selected")).toBe(false);
        expect(swatchButtons(wrapper).filter((btn) => btn.classes("selected"))).toHaveLength(1);

        wrapper.unmount();
    });

    it("opens the picker on the current color and typing an off-palette hex deselects every preset", async () => {
        const wrapper = mountCanvas();

        await customTrigger(wrapper).trigger("click");
        // Popover's Teleport target isn't attached until after the click's
        // own reactive updates settle.
        await nextTick();
        await nextTick();

        expect(hexInput().value).toBe("#ffffff");

        hexInput().value = "#123456";
        hexInput().dispatchEvent(new Event("input", { bubbles: true }));
        hexInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        await nextTick();

        expect(swatchButtons(wrapper).some((btn) => btn.classes("selected"))).toBe(false);
        expect(customTrigger(wrapper).classes("selected")).toBe(true);
        expect(customTrigger(wrapper).element.style.backgroundColor).toBe("rgb(18, 52, 86)");

        wrapper.unmount();
    });
});
