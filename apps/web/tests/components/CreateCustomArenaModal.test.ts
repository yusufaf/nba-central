import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import CreateCustomArenaModal from "@/components/TeamBuilder/CreateCustomArenaModal.vue";
import type { CustomArena } from "@/models/api";

let finishResize: (blob: Blob) => void = () => {};
vi.mock("@/utils/arenaImage", () => ({
    resizeArenaPhoto: () => new Promise<Blob>((resolve) => (finishResize = resolve)),
}));

const arena = (arenaUUID: string, photoUrl?: string): CustomArena => ({
    arenaUUID,
    name: `Arena ${arenaUUID}`,
    location: "",
    capacity: null,
    openedYear: null,
    court: null,
    photoUrl,
    created: "2026-10-01T00:00:00.000Z",
    isCustom: true,
});

afterEach(() => {
    document.body.innerHTML = "";
});

describe("CreateCustomArenaModal", () => {
    it("drops a photo whose resize finishes after the dialog moved on to another arena", async () => {
        globalThis.URL.createObjectURL = vi.fn(() => "blob:new");
        globalThis.URL.revokeObjectURL = vi.fn();
        const wrapper = mount(CreateCustomArenaModal, {
            props: { open: true, editingArena: arena("a"), "onUpdate:open": () => {} },
            attachTo: document.body,
        });
        await flushPromises();

        const input = document.querySelector("#arena-photo") as HTMLInputElement;
        Object.defineProperty(input, "files", {
            value: [new File(["x"], "big.png", { type: "image/png" })],
            configurable: true,
        });
        input.dispatchEvent(new Event("change"));
        await nextTick();

        // Closed and reopened for arena B, which has a photo of its own.
        await wrapper.setProps({ open: false });
        await wrapper.setProps({ open: true, editingArena: arena("b", "https://cdn.example/b.jpg") });
        finishResize(new Blob(["jpeg"], { type: "image/jpeg" }));
        await flushPromises();

        const shown = document.querySelector('img[alt="Arena photo"]') as HTMLImageElement;
        expect(shown.getAttribute("src")).toBe("https://cdn.example/b.jpg");

        (document.querySelector('button[type="submit"]') as HTMLButtonElement).click();
        await flushPromises();
        const [[, photo]] = wrapper.emitted("submit") as [unknown, unknown][];
        expect(photo).toBeUndefined();
        wrapper.unmount();
    });
});
