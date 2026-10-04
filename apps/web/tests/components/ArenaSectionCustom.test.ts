import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import ArenaSection from "@/components/TeamBuilder/ArenaSection.vue";
import type { CustomArena } from "@/models/api";

const harbor: CustomArena = {
    arenaUUID: "a1",
    name: "Harbor Pavilion",
    location: "Seattle, Washington",
    capacity: 18600,
    openedYear: 2026,
    court: null,
    created: "2026-10-01T00:00:00.000Z",
    isCustom: true,
};
const foundry: CustomArena = {
    ...harbor,
    arenaUUID: "a2",
    name: "The Foundry",
    photoUrl: "https://cdn.example/arenas/a2/photo-1.jpg",
};

const court = {
    version: 1 as const,
    wood: "maple" as const,
    paint: "#4b2a7b",
    apron: "#4b2a7b",
    lines: "#ffffff",
    centerLogo: "upload" as const,
    baselineText: "Harbor Pavilion",
    sidelineText: "Seattle",
};

const api = vi.hoisted(() => ({
    list: vi.fn(),
    delete: vi.fn(),
}));

vi.mock("@/network/api", () => ({
    customArenaApi: { list: api.list, delete: api.delete },
}));

vi.mock("@/composables/useCurrentUser", () => ({
    useCurrentUser: () => ({ currentUser: ref({ id: "user-1", username: "someone", memberSince: null }) }),
}));

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const mountSection = (teamArena: unknown, showArenaDrawer = true, teamLogo = "") => {
    const updates: unknown[] = [];
    const wrapper = mount(ArenaSection, {
        props: {
            selectedDrawerSide: "right",
            teamLogo,
            teamArena,
            "onUpdate:teamArena": (value: unknown) => updates.push(value),
            showArenaDrawer,
            "onUpdate:showArenaDrawer": () => {},
        },
        attachTo: document.body,
    });
    return { wrapper, updates };
};

// The Sheet and menus portal to document.body, outside the wrapper's tree.
const settle = async () => {
    await flushPromises();
    await nextTick();
    await nextTick();
};

const headings = () =>
    [...document.querySelectorAll(".arena-group-heading")].map((el) => el.textContent?.trim());
const customNames = () =>
    [...document.querySelectorAll('[data-testid="custom-arena-item"] .arena-name-improved')].map(
        (el) => el.textContent?.trim(),
    );
const allNames = () =>
    [...document.querySelectorAll(".arena-item .arena-name-improved")].map((el) => el.textContent?.trim());

const findButton = (label: string) =>
    [...document.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(label)) as HTMLButtonElement;

beforeEach(() => {
    api.list.mockResolvedValue({ success: true, data: { customArenas: [harbor, foundry] } });
    api.delete.mockResolvedValue({ success: true });
});

afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
});

describe("ArenaSection with custom arenas", () => {
    it("pins Your arenas above NBA arenas, each with a Custom badge, edit and delete", async () => {
        const { wrapper } = mountSection(null);
        await settle();

        expect(headings()).toEqual(["Your arenas", "NBA arenas"]);
        expect(allNames().slice(0, 2)).toEqual(["Harbor Pavilion", "The Foundry"]);
        const item = document.querySelector('[data-testid="custom-arena-item"]')!;
        expect(item.textContent).toContain("Custom");
        expect(item.querySelector('[aria-label="Edit Harbor Pavilion"]')).toBeTruthy();
        expect(item.querySelector('[aria-label="Delete Harbor Pavilion"]')).toBeTruthy();
        expect(findButton("Create arena")).toBeTruthy();
        wrapper.unmount();
    });

    it("searches both groups", async () => {
        const { wrapper } = mountSection(null);
        await settle();

        const search = document.querySelector('input[type="search"]') as HTMLInputElement;
        search.value = "foundry";
        search.dispatchEvent(new Event("input"));
        await nextTick();
        expect(allNames()).toEqual(["The Foundry"]);

        search.value = "ball";
        search.dispatchEvent(new Event("input"));
        await nextTick();
        expect(customNames()).toEqual([]);
        expect(allNames()).toEqual(["Ball Arena"]);
        wrapper.unmount();
    });

    it("applies the conference filter to NBA arenas only, hiding yours while it's on", async () => {
        const { wrapper } = mountSection(null);
        await settle();

        findButton("Filters").click();
        await nextTick();
        const western = [...document.querySelectorAll('[role="menuitemcheckbox"]')].find(
            (el) => el.textContent?.trim() === "Western Conference",
        ) as HTMLElement;
        western.click();
        await nextTick();

        expect(customNames()).toEqual([]);
        expect(headings()).toEqual([]);
        expect(allNames().length).toBeGreaterThan(0);
        wrapper.unmount();
    });

    it("attaches a picked custom arena by its arenaUUID", async () => {
        const { wrapper, updates } = mountSection(null);
        await settle();

        (document.querySelector('[data-testid="custom-arena-item"] button') as HTMLButtonElement).click();

        expect(updates).toEqual([harbor]);
        wrapper.unmount();
    });

    it("shows a placeholder, not a broken image, for an arena with no photo, plus its details", async () => {
        const { wrapper } = mountSection(
            { name: "Gone Arena", location: "Nowhere", capacity: 500, openedYear: 1990, isCustom: true },
            false,
        );
        await settle();

        expect(wrapper.find('[data-testid="arena-placeholder"]').exists()).toBe(true);
        expect(wrapper.find(".main-card-section img").exists()).toBe(false);
        expect(wrapper.find(".arena-details").text()).toBe("Nowhere · 500 · opened 1990");
        expect(wrapper.text()).toContain("Custom");
        wrapper.unmount();
    });

    it("shows the live copy of a linked arena, so an edit shows without a reload", async () => {
        const { wrapper } = mountSection(
            { name: "Old name", isCustom: true, arenaUUID: "a2", photoUrl: "https://old.example/x.jpg" },
            false,
        );
        await settle();

        expect(wrapper.find(".arena-name").text()).toBe("The Foundry");
        expect(wrapper.find(".main-card-section img").attributes("src")).toBe(foundry.photoUrl);
        expect(wrapper.find(".arena-details").text()).toBe("Seattle, Washington · 18,600 · opened 2026");
        expect(findButton("Edit arena")).toBeTruthy();
        wrapper.unmount();
    });

    it("keeps a deleted arena's details on the team, without its link or photo", async () => {
        const { wrapper, updates } = mountSection(foundry);
        await settle();

        (document.querySelector('[aria-label="Delete The Foundry"]') as HTMLButtonElement).click();
        await settle();
        const confirm = [...document.querySelectorAll('[role="dialog"] button')].find(
            (b) => b.textContent?.trim() === "Delete",
        ) as HTMLButtonElement;
        confirm.click();
        await settle();

        expect(api.delete).toHaveBeenCalledWith("a2");
        expect(updates.at(-1)).toEqual({
            name: "The Foundry",
            location: "Seattle, Washington",
            capacity: 18600,
            openedYear: 2026,
            isCustom: true,
        });
        wrapper.unmount();
    });

    it("shows a linked arena's court on the card, with the team's logo for a Team logo centre", async () => {
        const withCourt = { ...foundry, court: { ...court, centerLogo: "team" as const } };
        api.list.mockResolvedValue({ success: true, data: { customArenas: [harbor, withCourt] } });
        const { wrapper } = mountSection({ name: "The Foundry", isCustom: true, arenaUUID: "a2" }, false, "https://cdn.example/team.png");
        await settle();

        const thumb = wrapper.find('[data-testid="arena-court"]');
        expect(thumb.find('[data-part="floor"]').exists()).toBe(true);
        expect(thumb.find("image").attributes("href")).toBe("https://cdn.example/team.png");
        expect(wrapper.find(".main-card-section img").exists()).toBe(false);
        wrapper.unmount();
    });

    it("keeps the photo on the card when the arena has no court", async () => {
        const { wrapper } = mountSection({ name: "The Foundry", isCustom: true, arenaUUID: "a2" }, false);
        await settle();
        expect(wrapper.find('[data-testid="arena-court"]').exists()).toBe(false);
        expect(wrapper.find(".main-card-section img").attributes("src")).toBe(foundry.photoUrl);
        wrapper.unmount();
    });

    it("never draws a court that isn't in your own list, like a remixed team's", async () => {
        const { wrapper } = mountSection(
            { name: "Theirs", isCustom: true, arenaUUID: "someone-elses", court },
            false,
        );
        await settle();
        expect(wrapper.find('[data-testid="arena-court"]').exists()).toBe(false);
        wrapper.unmount();
    });

    it("shows each of your arenas by its court in the drawer, or its photo without one", async () => {
        api.list.mockResolvedValue({
            success: true,
            data: { customArenas: [{ ...harbor, court }, foundry] },
        });
        const { wrapper } = mountSection(null);
        await settle();

        const [first, second] = document.querySelectorAll('[data-testid="custom-arena-item"]');
        expect(first.querySelector('[data-part="floor"]')).not.toBeNull();
        expect(first.querySelector("img")).toBeNull();
        expect(second.querySelector('[data-part="floor"]')).toBeNull();
        expect(second.querySelector("img")?.getAttribute("src")).toBe(foundry.photoUrl);
        wrapper.unmount();
    });
});
