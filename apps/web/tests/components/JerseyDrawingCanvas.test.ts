import { describe, it, expect, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import JerseyDrawingCanvas from "@/components/TeamBuilder/JerseyDrawingCanvas.vue";

// jsdom has no Canvas2D context and no setPointerCapture, so these assertions
// stay DOM-only - the swatch/custom-input wiring, not stroke rendering.
const mountCanvas = () =>
    mount(JerseyDrawingCanvas, {
        props: {
            teamJersey: "",
            "onUpdate:teamJersey": () => {},
        },
        attachTo: document.body,
    });

const swatchButtons = (wrapper: ReturnType<typeof mountCanvas>) =>
    wrapper.findAll(".jersey-swatch:not(.jersey-swatch-custom)");

const customInput = (wrapper: ReturnType<typeof mountCanvas>) =>
    wrapper.get<HTMLInputElement>(".jersey-swatch-custom");

describe("JerseyDrawingCanvas stroke color", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("starts on the White preset, with the custom input matching it", () => {
        const wrapper = mountCanvas();

        const selected = swatchButtons(wrapper).filter((btn) => btn.classes("selected"));
        expect(selected).toHaveLength(1);
        expect(selected[0].attributes("aria-label")).toBe("White");
        expect(customInput(wrapper).element.value).toBe("#ffffff");
        expect(customInput(wrapper).classes("selected")).toBe(false);

        wrapper.unmount();
    });

    it("clicking a preset moves the ring to it and syncs the custom input", async () => {
        const wrapper = mountCanvas();

        const crimson = swatchButtons(wrapper).find(
            (btn) => btn.attributes("aria-label") === "Crimson",
        );
        await crimson?.trigger("click");

        expect(crimson?.classes("selected")).toBe(true);
        expect(customInput(wrapper).element.value).toBe("#df2030");
        expect(customInput(wrapper).classes("selected")).toBe(false);
        expect(swatchButtons(wrapper).filter((btn) => btn.classes("selected"))).toHaveLength(1);

        wrapper.unmount();
    });

    it("picking an off-palette color deselects every preset and selects the custom control", async () => {
        const wrapper = mountCanvas();

        const input = customInput(wrapper);
        input.element.value = "#123456";
        await input.trigger("input");

        expect(swatchButtons(wrapper).some((btn) => btn.classes("selected"))).toBe(false);
        expect(input.classes("selected")).toBe(true);

        wrapper.unmount();
    });
});
