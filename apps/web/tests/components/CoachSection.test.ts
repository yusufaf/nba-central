import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import CoachSection from "@/components/TeamBuilder/CoachSection.vue";
import coachesData from "@/assets/data/coaches.json";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("vue-sonner", () => ({ toast }));

const api = vi.hoisted(() => ({
    coach: { list: vi.fn(), delete: vi.fn() },
    gm: { list: vi.fn(), delete: vi.fn() },
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
});

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
const mountCoachDrawerOpen = () =>
    mount(CoachSection, {
        props: {
            selectedDrawerSide: "right",
            teamCoach: null,
            "onUpdate:teamCoach": () => {},
            showCoachDrawer: true,
            "onUpdate:showCoachDrawer": () => {},
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

const coachNames = () =>
    [...document.querySelectorAll(".coach-item .coach-list-item-name")].map(
        (el) => el.textContent?.trim(),
    );

describe("CoachSection filters", () => {
    afterEach(() => {
        document.body.innerHTML = "";
        vi.useRealTimers();
    });

    it("narrows the list to the season that started Oct 1 when 'Current Season Only' is ticked, instead of doing nothing", async () => {
        // Regression test: fixing the dead :checked/@update:checked binding
        // made this checkbox tick and count, but filteredCoachesData's
        // predicate only ever branched on 'Hall of Famer' - 'Current
        // Season Only' was listed in COACH_FILTERS yet had no matching
        // branch, so ticking it silently changed nothing.
        const latestTo = Math.max(...(coachesData as { to: number }[]).map((c) => c.to));
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(latestTo - 1, 9, 1)); // Oct 1 of the latest season's start
        const expectedCount = (coachesData as { to: number }[]).filter(
            (c) => c.to === latestTo,
        ).length;
        expect(expectedCount).toBeGreaterThan(0);

        const wrapper = mountCoachDrawerOpen();
        await nextTick();
        await nextTick();
        const allCount = coachNames().length;

        findButton("Filters").click();
        await nextTick();
        filterCheckbox("Current Season Only").click();
        await nextTick();

        expect(findButton("Filters").textContent).toContain("1");
        expect(coachNames().length).toBeLessThan(allCount);
        expect(coachNames().length).toBe(expectedCount);
        wrapper.unmount();
    });

    it("AND-s 'Current Season Only' and 'Hall of Famer' instead of OR-ing them", async () => {
        // Unlike ArenaSection/GMSection's conference filters (the same
        // facet, so OR is correct), these two are independent facets -
        // ticking both should narrow further, not union back out.
        const wrapper = mountCoachDrawerOpen();
        await nextTick();
        await nextTick();

        findButton("Filters").click();
        await nextTick();
        filterCheckbox("Current Season Only").click();
        await nextTick();
        const currentOnly = coachNames().length;

        filterCheckbox("Hall of Famer").click();
        await nextTick();
        const both = coachNames().length;

        expect(both).toBeLessThanOrEqual(currentOnly);
        wrapper.unmount();
    });
});

describe("deleting a custom coach", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("clears a loaded team's coach, whose link is uuid", async () => {
        const update = vi.fn();
        mount(CoachSection, {
            props: {
                selectedDrawerSide: "right",
                teamCoach: { name: "Coach Vega", isCustom: true, uuid: "c1" } as never,
                "onUpdate:teamCoach": update,
                showCoachDrawer: true,
                "onUpdate:showCoachDrawer": () => {},
            },
            attachTo: document.body,
        });
        await flushPromises();

        await deleteFromList(".coach-item", "Coach Vega");

        expect(api.coach.delete).toHaveBeenCalledWith("c1");
        expect(update).toHaveBeenCalledWith(null);
    });
});
