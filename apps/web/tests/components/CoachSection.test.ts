import { describe, it, expect, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import CoachSection from "@/components/TeamBuilder/CoachSection.vue";
import { CURRENT_SEASON_START_YEAR } from "@/constants/constants";
import coachesData from "@/assets/data/coaches.json";

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
    });

    it("narrows the list when 'Current Season Only' is ticked, instead of doing nothing", async () => {
        // Regression test: fixing the dead :checked/@update:checked binding
        // made this checkbox tick and count, but filteredCoachesData's
        // predicate only ever branched on 'Hall of Famer' - 'Current
        // Season Only' was listed in COACH_FILTERS yet had no matching
        // branch, so ticking it silently changed nothing.
        const expectedCount = (coachesData as { to: number }[]).filter(
            (c) => c.to === CURRENT_SEASON_START_YEAR + 1,
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
