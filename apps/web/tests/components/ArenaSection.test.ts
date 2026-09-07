import { describe, it, expect, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ArenaSection from "@/components/TeamBuilder/ArenaSection.vue";

// Sheet and DropdownMenu both portal their content to document.body via
// Teleport, so everything below queries the live document directly instead
// of the wrapper's own render tree, which Teleport moves this content out of.
const mountArenaDrawerOpen = () =>
    mount(ArenaSection, {
        props: {
            selectedDrawerSide: "right",
            teamArena: null,
            "onUpdate:teamArena": () => {},
            showArenaDrawer: true,
            "onUpdate:showArenaDrawer": () => {},
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

const arenaCardNames = () =>
    [...document.querySelectorAll(".arena-item .arena-name-improved")].map(
        (el) => el.textContent?.trim(),
    );

describe("ArenaSection filters", () => {
    // Sheet/DropdownMenu Teleport content straight to document.body, outside
    // the wrapper's own tree - unmount() must run for it to clean up, so an
    // assertion failure mid-test would otherwise leak DOM into the next one.
    afterEach(() => {
        document.body.innerHTML = "";
    });


    it("opens the Filters dropdown and lists both conference options", async () => {
        const wrapper = mountArenaDrawerOpen();
        // Sheet/DropdownMenu's Teleport target isn't attached until after
        // the initial mount tick.
        await nextTick();
        await nextTick();
        findButton("Filters").click();
        await nextTick();

        expect(filterCheckbox("Western Conference")).toBeTruthy();
        expect(filterCheckbox("Eastern Conference")).toBeTruthy();
        wrapper.unmount();
    });

    it("ticks a checkbox and narrows the list on the first click", async () => {
        // Regression test for the dead :checked/@update:checked binding -
        // reka-ui's DropdownMenuCheckboxItem only has modelValue/
        // update:modelValue, so :checked fell through as a no-op attribute
        // and this filter never fired.
        const wrapper = mountArenaDrawerOpen();
        // Sheet/DropdownMenu's Teleport target isn't attached until after
        // the initial mount tick.
        await nextTick();
        await nextTick();
        const allCount = arenaCardNames().length;
        expect(allCount).toBeGreaterThan(0);

        findButton("Filters").click();
        await nextTick();
        filterCheckbox("Western Conference").click();
        await nextTick();

        expect(findButton("Filters").textContent).toContain("1");
        expect(arenaCardNames().length).toBeLessThan(allCount);
        expect(arenaCardNames().length).toBeGreaterThan(0);
        wrapper.unmount();
    });

    it("OR-s multiple selected conferences instead of AND-ing them", async () => {
        // Selecting both conferences used to require a team to be in both
        // WESTERN_TEAMS and EASTERN_TEAMS, which is impossible - the list
        // silently went to zero arenas instead of showing all of them.
        const wrapper = mountArenaDrawerOpen();
        // Sheet/DropdownMenu's Teleport target isn't attached until after
        // the initial mount tick.
        await nextTick();
        await nextTick();
        const allCount = arenaCardNames().length;

        findButton("Filters").click();
        await nextTick();
        filterCheckbox("Western Conference").click();
        await nextTick();
        filterCheckbox("Eastern Conference").click();
        await nextTick();

        expect(arenaCardNames().length).toBe(allCount);
        wrapper.unmount();
    });
});
