import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import GMSection from "@/components/TeamBuilder/GMSection.vue";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("vue-sonner", () => ({ toast }));

const api = vi.hoisted(() => ({
    coach: { list: vi.fn(), delete: vi.fn() },
    gm: { list: vi.fn(), delete: vi.fn(), create: vi.fn(), update: vi.fn() },
    player: { list: vi.fn() },
}));
vi.mock("@/network/api", () => ({
    customCoachApi: api.coach,
    customGMApi: api.gm,
    customPlayerApi: api.player,
    dataApi: { getPlayers: vi.fn() },
}));

const { currentUser } = await vi.hoisted(async () => {
    const { ref } = await import("vue");
    return { currentUser: ref<{ id: string; username: string | null; memberSince: Date | null } | null>(null) };
});
vi.mock("@/composables/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser }) }));

beforeEach(() => {
    vi.clearAllMocks();
    currentUser.value = { id: "user-1", username: "someone", memberSince: null };
    api.coach.list.mockResolvedValue({
        success: true,
        data: { customCoaches: [{ coachUUID: "c1", name: "Coach Vega", overallRating: 80, specialty: "Balanced" }] },
    });
    api.gm.list.mockResolvedValue({
        success: true,
        data: { customGMs: [{ gmUUID: "g1", name: "Exec Ortiz", teams: ["SEA"] }] },
    });
    api.coach.delete.mockResolvedValue({ success: true });
    api.gm.delete.mockResolvedValue({ success: true });
    api.gm.update.mockResolvedValue({ success: true, data: {} });
});

vi.mock("@/components/scene3d", async () => {
    const { defineComponent, h } = await import("vue");
    return {
        PersonPreview3DAsync: defineComponent({ name: "PreviewStub", setup: () => () => h("div", { "data-testid": "preview-stub" }) }),
        Scene3DUnavailable: defineComponent({ name: "UnavailableStub", setup: () => () => h("p") }),
    };
});
vi.mock("@/utils/webgl", () => ({ isWebGLAvailable: () => true }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
} as unknown as typeof ResizeObserver;

// The row's trash button, then the confirm dialog's Delete.
const deleteFromList = async (itemSelector: string, name: string) => {
    const item = [...document.querySelectorAll(itemSelector)].find((el) => el.textContent?.includes(name))!;
    (item.querySelector("svg.lucide-trash")!.closest("button") as HTMLButtonElement).click();
    await flushPromises();
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find((el) => el.textContent?.includes("Delete Custom"))!;
    const confirm = [...dialog.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Delete")!;
    confirm.click();
    await flushPromises();
};


// Sheet and DropdownMenu both portal their content to document.body via
// Teleport, so everything below queries the live document directly instead
// of the wrapper's own render tree, which Teleport moves this content out of.
const mountGMDrawerOpen = () =>
    mount(GMSection, {
        props: {
            selectedDrawerSide: "right",
            teamGM: null,
            "onUpdate:teamGM": () => {},
            showGMDrawer: true,
            "onUpdate:showGMDrawer": () => {},
        },
        attachTo: document.body,
    });

const findButton = (label: string) =>
    [...document.querySelectorAll("button")].find((b) =>
        b.textContent?.trim().startsWith(label),
    ) as HTMLButtonElement;

const filterCheckbox = (label: string) =>
    [...document.querySelectorAll('[role="menuitemcheckbox"]')].find(
        (el) => el.textContent?.trim() === label,
    ) as HTMLElement;

const gmNames = () =>
    [...document.querySelectorAll(".gm-item .gm-name-improved")].map(
        (el) => el.textContent?.trim(),
    );

describe("GMSection filters", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("narrows the list when a conference filter is ticked, instead of doing nothing", async () => {
        // Regression test for two stacked bugs: the dead :checked/
        // @update:checked binding (same reka-ui modelValue mismatch as
        // ArenaSection), and the predicate itself, which used to be an
        // unimplemented stub ("Filter logic would go here when
        // implemented") that returned every GM unfiltered.
        const wrapper = mountGMDrawerOpen();
        await nextTick();
        await nextTick();

        const allCount = gmNames().length;
        expect(allCount).toBeGreaterThan(0);

        findButton("Filters").click();
        await nextTick();
        filterCheckbox("Western Conference").click();
        await nextTick();

        expect(findButton("Filters").textContent).toContain("1");
        expect(gmNames().length).toBeLessThan(allCount);
        expect(gmNames().length).toBeGreaterThan(0);
        wrapper.unmount();
    });

    it("resolves execs.json's 'ABBR (year-year)' team entries to a conference, not just a bare abbreviation", async () => {
        // execs.json gives teams like "BOS (2003-21)" - Basketball-Reference
        // abbreviation plus a year range, never a full team name. Matching
        // that raw string against WESTERN_TEAMS/EASTERN_TEAMS (full names)
        // can never succeed, which is what made every conference filter
        // here return zero GMs even after the checkbox wiring was fixed.
        const wrapper = mountGMDrawerOpen();
        await nextTick();
        await nextTick();

        findButton("Filters").click();
        await nextTick();
        filterCheckbox("Western Conference").click();
        await nextTick();
        const westCount = gmNames().length;

        filterCheckbox("Western Conference").click();
        await nextTick();
        filterCheckbox("Eastern Conference").click();
        await nextTick();
        const eastCount = gmNames().length;

        expect(westCount).toBeGreaterThan(0);
        expect(eastCount).toBeGreaterThan(0);
        wrapper.unmount();
    });

    it("OR-s multiple selected conferences instead of AND-ing them", async () => {
        // Unlike ArenaSection, GM data isn't a clean 1:1 team-to-conference
        // mapping - some GMs' entire resume predates the current 30-team
        // structure (e.g. "FTW (1957)", the Fort Wayne Pistons), so their
        // conference is unresolvable and they legitimately match neither
        // filter. The real regression to catch is AND-ing: both filters
        // selected together must recover the union of each one selected
        // alone, not something smaller (which is what "every selected
        // filter must match" - AND - would produce). Each scenario gets its
        // own fresh mount rather than toggling one dropdown through
        // select/deselect/reselect, which reka's menu doesn't reliably keep
        // open across under jsdom's synthetic click events.
        const selectFilters = async (...labels: string[]) => {
            const wrapper = mountGMDrawerOpen();
            await nextTick();
            await nextTick();
            findButton("Filters").click();
            await nextTick();
            for (const label of labels) {
                filterCheckbox(label).click();
                await nextTick();
            }
            const names = new Set(gmNames());
            wrapper.unmount();
            return names;
        };

        const westOnly = await selectFilters("Western Conference");
        const eastOnly = await selectFilters("Eastern Conference");
        const both = await selectFilters("Western Conference", "Eastern Conference");

        expect(westOnly.size).toBeGreaterThan(0);
        expect(eastOnly.size).toBeGreaterThan(0);
        expect(both).toEqual(new Set([...westOnly, ...eastOnly]));
    });
});

describe("deleting a custom GM", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("clears a loaded team's GM, whose link is uuid", async () => {
        const update = vi.fn();
        mount(GMSection, {
            props: {
                selectedDrawerSide: "right",
                teamGM: { name: "Exec Ortiz", isCustom: true, uuid: "g1" } as never,
                "onUpdate:teamGM": update,
                showGMDrawer: true,
                "onUpdate:showGMDrawer": () => {},
            },
            attachTo: document.body,
        });
        await flushPromises();

        await deleteFromList(".gm-item", "Exec Ortiz");

        expect(api.gm.delete).toHaveBeenCalledWith("g1");
        expect(update).toHaveBeenCalledWith(null);
    });
});

describe("the GM creator", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    const mountSection = () =>
        mount(GMSection, {
            props: {
                selectedDrawerSide: "right",
                teamGM: null,
                "onUpdate:teamGM": () => {},
                showGMDrawer: true,
                "onUpdate:showGMDrawer": () => {},
            },
            attachTo: document.body,
        });

    it("opens in staff mode from Create Custom GM", async () => {
        mountSection();
        await flushPromises();
        findButton("Create Custom GM").click();
        await flushPromises();
        const tabs = [...document.querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim());
        expect(tabs).toContain("Outfit");
        expect(document.body.textContent).toContain("Create GM");
    });

    it("saves an edit with its look and tells the builder", async () => {
        const wrapper = mountSection();
        await flushPromises();
        (document.querySelector('[aria-label="Edit Exec Ortiz"]') as HTMLButtonElement).click();
        await flushPromises();
        (document.querySelector('button[type="submit"]') as HTMLButtonElement).click();
        await flushPromises();

        expect(api.gm.update).toHaveBeenCalledWith(
            "g1",
            expect.objectContaining({ name: "Exec Ortiz", teams: ["SEA"], appearance: expect.any(Object) }),
        );
        const [saved] = wrapper.emitted("customStaffSaved")!.at(-1) as [{ uuid: string; name: string }];
        expect(saved).toMatchObject({ uuid: "g1", name: "Exec Ortiz" });
    });
});
