import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import CreateCustomArenaModal from "@/components/TeamBuilder/CreateCustomArenaModal.vue";
import type { CourtDesign, CustomArena, CustomArenaPayload } from "@/models/api";
import type { ArenaImageChanges } from "@/composables/useCustomArenas";

let finishResize: (blob: Blob) => void = () => {};
vi.mock("@/utils/arenaImage", () => ({
    resizeArenaPhoto: () => new Promise<Blob>((resolve) => (finishResize = resolve)),
    resizeCourtLogo: async () => new Blob(["png"], { type: "image/png" }),
}));

const arena = (arenaUUID: string, photoUrl?: string, extra: Partial<CustomArena> = {}): CustomArena => ({
    arenaUUID,
    name: `Arena ${arenaUUID}`,
    location: "",
    capacity: null,
    openedYear: null,
    court: null,
    photoUrl,
    created: "2026-10-01T00:00:00.000Z",
    isCustom: true,
    ...extra,
});

const court: CourtDesign = {
    version: 1,
    wood: "honey",
    paint: "#0f6b3c",
    apron: null,
    lines: "#ffffff",
    centerLogo: "none",
    baselineText: "Pioneers",
    sidelineText: "",
};

const mountModal = async (editingArena: CustomArena | null) => {
    const wrapper = mount(CreateCustomArenaModal, {
        props: { open: true, editingArena, teamLogo: "https://cdn.example/team.png", "onUpdate:open": () => {} },
        attachTo: document.body,
    });
    await flushPromises();
    return wrapper;
};

// Reka's tab triggers switch on mousedown, not click.
const openTab = async (label: string) => {
    const trigger = [...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent?.trim() === label)!;
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    await flushPromises();
};

const button = (label: string) =>
    [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label) as HTMLButtonElement;

const typeInto = async (selector: string, value: string) => {
    const input = document.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event("input"));
    await flushPromises();
};

const submitted = async (wrapper: VueWrapper) => {
    (document.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await flushPromises();
    const events = wrapper.emitted("submit") as [CustomArenaPayload, ArenaImageChanges][];
    return events.at(-1)!;
};

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
        const [[, images]] = wrapper.emitted("submit") as [unknown, ArenaImageChanges][];
        expect(images.photo).toBeUndefined();
        wrapper.unmount();
    });

    it("has Details and Court tabs, and a new arena starts with no court", async () => {
        const wrapper = await mountModal(null);
        expect([...document.querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim())).toEqual(["Details", "Court"]);

        await typeInto("#arena-name", "Harbor Pavilion");
        const [data] = await submitted(wrapper);
        expect(data.court).toBeNull();
        wrapper.unmount();
    });

    it("designs a court from the arena name and submits it", async () => {
        const wrapper = await mountModal(null);
        await typeInto("#arena-name", "Harbor Pavilion");
        await openTab("Court");
        button("Design a court").click();
        await flushPromises();

        expect(document.querySelector('[data-testid="court-preview"] svg')).not.toBeNull();
        const [data] = await submitted(wrapper);
        expect(data.court).toMatchObject({ version: 1, wood: "maple", centerLogo: "team", baselineText: "Harbor Pavilion" });
        wrapper.unmount();
    });

    it("loads a saved court, updates the preview on each change, and submits the edit", async () => {
        const wrapper = await mountModal(arena("a", undefined, { court }));
        await openTab("Court");

        const preview = () => document.querySelector('[data-testid="court-preview"]')!;
        const previewText = () => preview().querySelectorAll('[data-part="baseline-text"]')[0].textContent;
        expect(previewText()).toBe("PIONEERS");
        expect((document.querySelector("#court-baseline") as HTMLInputElement).value).toBe("Pioneers");

        const floorFill = () => preview().querySelector('[data-part="floor"] path')?.getAttribute("fill");
        const honeyFill = floorFill();
        button("Walnut").click();
        await flushPromises();
        expect(floorFill()).not.toBe(honeyFill);
        await typeInto("#court-baseline", "The Grove");
        expect(previewText()).toBe("THE GROVE");

        const [data] = await submitted(wrapper);
        expect(data.court).toEqual({ ...court, wood: "walnut", baselineText: "The Grove" });
        wrapper.unmount();
    });

    it("matches the apron to the paint, and follows the paint while matched", async () => {
        const wrapper = await mountModal(arena("a", undefined, { court }));
        await openTab("Court");

        button("Match paint").click();
        await flushPromises();
        (document.querySelector('[aria-label="Red"]') as HTMLButtonElement).click();
        await flushPromises();
        expect(document.querySelector('[data-testid="court-preview"] [data-part="apron"]')?.getAttribute("fill")).toBe("#b91c1c");

        const [data] = await submitted(wrapper);
        expect(data.court).toMatchObject({ paint: "#b91c1c", apron: "#b91c1c" });
        wrapper.unmount();
    });

    it("draws the team's logo in the preview for a Team logo centre", async () => {
        const wrapper = await mountModal(arena("a", undefined, { court: { ...court, centerLogo: "team" } }));
        await openTab("Court");
        expect(document.querySelector('[data-testid="court-preview"] image')?.getAttribute("href")).toBe("https://cdn.example/team.png");
        wrapper.unmount();
    });

    it("needs an image before an Upload centre can be saved, then hands the logo back", async () => {
        globalThis.URL.createObjectURL = vi.fn(() => "blob:logo");
        globalThis.URL.revokeObjectURL = vi.fn();
        const wrapper = await mountModal(arena("a", undefined, { court }));
        await openTab("Court");
        button("Upload").click();
        await flushPromises();

        const submit = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        expect(submit.disabled).toBe(true);
        expect(document.body.textContent).toContain("Choose an image, or pick None or Team logo.");

        const input = document.querySelector("#court-logo") as HTMLInputElement;
        Object.defineProperty(input, "files", {
            value: [new File(["x"], "logo.png", { type: "image/png" })],
            configurable: true,
        });
        input.dispatchEvent(new Event("change"));
        await flushPromises();

        expect(document.querySelector('[data-testid="court-preview"] image')?.getAttribute("href")).toBe("blob:logo");
        const [data, images] = await submitted(wrapper);
        expect(data.court?.centerLogo).toBe("upload");
        expect(images.logo).toBeInstanceOf(Blob);
        wrapper.unmount();
    });

    it("removes the court", async () => {
        const wrapper = await mountModal(arena("a", undefined, { court }));
        await openTab("Court");
        button("Remove court").click();
        await flushPromises();
        expect(button("Design a court")).toBeDefined();
        const [data] = await submitted(wrapper);
        expect(data.court).toBeNull();
        wrapper.unmount();
    });

    // Reka unmounts the Court tab while Details is showing.
    it("keeps the apron and lines modes across a tab round-trip", async () => {
        const wrapper = await mountModal(arena("a", undefined, { court: { ...court, apron: "#0f6b3c" } }));
        await openTab("Court");
        button("Custom").click();
        await flushPromises();
        expect(document.querySelectorAll('[aria-label="Custom color"]')).toHaveLength(2);

        await openTab("Details");
        await openTab("Court");
        const pressed = [...document.querySelectorAll('[data-state="on"]')].map((el) => el.textContent?.trim());
        expect(pressed).toContain("Custom");
        expect(pressed).not.toContain("Match paint");

        (document.querySelector('[aria-label="Red"]') as HTMLButtonElement).click();
        await flushPromises();
        const [data] = await submitted(wrapper);
        expect(data.court).toMatchObject({ paint: "#b91c1c", apron: "#0f6b3c" });
        wrapper.unmount();
    });
});

