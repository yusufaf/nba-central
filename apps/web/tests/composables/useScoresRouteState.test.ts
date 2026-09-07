import { describe, it, expect, beforeEach } from "vitest";
import { defineComponent } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { useScoresRouteState } from "@/composables/useScoresRouteState";

// Fixed "today" so assertions don't depend on when the suite runs.
const TODAY = new Date(2026, 5, 8);
const MIN_DATE = new Date(2000, 0, 1);

const mountWithRoute = async (initialQuery: Record<string, string> = {}) => {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: "/scores", name: "scores", component: { template: "<div/>" } }],
    });

    let state!: ReturnType<typeof useScoresRouteState>;
    const TestComponent = defineComponent({
        setup() {
            state = useScoresRouteState({ minDate: MIN_DATE, maxDate: TODAY });
            return () => null;
        },
    });

    const search = new URLSearchParams(initialQuery).toString();
    await router.push(`/scores${search ? `?${search}` : ""}`);

    const wrapper = mount(TestComponent, { global: { plugins: [router] } });
    await flushPromises();

    return { wrapper, router, state };
};

describe("useScoresRouteState", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("defaults to maxDate and writes it into the URL when ?date is absent", async () => {
        const { router, state } = await mountWithRoute();
        await flushPromises();

        expect(state.selectedDate.value.getFullYear()).toBe(2026);
        expect(state.selectedDate.value.getMonth()).toBe(5);
        expect(state.selectedDate.value.getDate()).toBe(8);
        expect(router.currentRoute.value.query.date).toBe("2026-06-08");
    });

    it("reads a valid ?date= param as a local date, not UTC", async () => {
        const { state } = await mountWithRoute({ date: "2026-05-20" });

        expect(state.selectedDate.value.getFullYear()).toBe(2026);
        expect(state.selectedDate.value.getMonth()).toBe(4);
        expect(state.selectedDate.value.getDate()).toBe(20);
    });

    it("falls back to maxDate and rewrites the URL for an unparseable date", async () => {
        const { state, router } = await mountWithRoute({ date: "not-a-date" });
        await flushPromises();

        expect(router.currentRoute.value.query.date).toBe("2026-06-08");
        expect(state.selectedDate.value.getDate()).toBe(8);
    });

    it("clamps a date past maxDate back to maxDate", async () => {
        const { state, router } = await mountWithRoute({ date: "2030-01-01" });
        await flushPromises();

        expect(router.currentRoute.value.query.date).toBe("2026-06-08");
        expect(state.selectedDate.value.getDate()).toBe(8);
    });

    it("clamps a date before minDate back to maxDate", async () => {
        const { state, router } = await mountWithRoute({ date: "1990-01-01" });
        await flushPromises();

        expect(router.currentRoute.value.query.date).toBe("2026-06-08");
        expect(state.selectedDate.value.getDate()).toBe(8);
    });

    it("writing selectedDate updates the URL", async () => {
        const { state, router } = await mountWithRoute();
        await flushPromises();

        state.selectedDate.value = new Date(2026, 5, 1);
        await flushPromises();

        expect(router.currentRoute.value.query.date).toBe("2026-06-01");
    });

    it("falls back to maxDate instead of throwing when the date picker emits null", async () => {
        // v-calendar's DatePicker emits null through v-model when a day is
        // re-clicked to deselect it, since Scores.vue doesn't set
        // is-required - the setter has to tolerate that even though the
        // type says Date.
        const { state, router } = await mountWithRoute();
        await flushPromises();

        expect(() => {
            state.selectedDate.value = null as unknown as Date;
        }).not.toThrow();
        await flushPromises();

        expect(router.currentRoute.value.query.date).toBe("2026-06-08");
    });

    it("reads a valid conference filter from the query", async () => {
        const { state } = await mountWithRoute({ conf: "EAST" });
        expect(state.conferenceFilter.value).toBe("EAST");
    });

    it("ignores an invalid conference value and falls back to preferences", async () => {
        const { state } = await mountWithRoute({ conf: "NOT_A_CONF" });
        expect(state.conferenceFilter.value).toBe("ALL");
    });

    it("writing conferenceFilter updates both the URL and localStorage", async () => {
        const { state, router } = await mountWithRoute();
        state.conferenceFilter.value = "WEST";
        await flushPromises();

        expect(router.currentRoute.value.query.conf).toBe("WEST");
        const stored = JSON.parse(localStorage.getItem("nba-scores-preferences")!);
        expect(stored.conferenceFilter).toBe("WEST");
    });

    it("ignores an invalid view value and falls back to preferences", async () => {
        const { state } = await mountWithRoute({ view: "Grid" });
        expect(state.selectedView.value).toBe("Default");
    });

    it("writing selectedView updates both the URL and localStorage", async () => {
        const { state, router } = await mountWithRoute();
        state.selectedView.value = "List";
        await flushPromises();

        expect(router.currentRoute.value.query.view).toBe("List");
        const stored = JSON.parse(localStorage.getItem("nba-scores-preferences")!);
        expect(stored.selectedView).toBe("List");
    });
});
