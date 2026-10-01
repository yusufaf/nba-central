import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import PageTitle from "@/components/PageTitle.vue";

const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
afterEach(() => warn.mockClear());

const makeRouter = () =>
    createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: "/scores", component: { template: "<div />" } },
            { path: "/news", component: { template: "<div />" } },
        ],
    });

describe("PageTitle", () => {
    // Scores rewrites its ?date= query right after mount. The title used to
    // call useRouter() inside its computeds, which only works during setup,
    // so that re-render threw "inject() can only be used inside setup()".
    it("keeps working when the route changes after mount", async () => {
        const router = makeRouter();
        await router.push("/scores");
        const wrapper = mount(PageTitle, { global: { plugins: [router] } });
        expect(wrapper.text()).toBe("NBA Scoreboard");
        expect(wrapper.classes()).toContain("scores");

        await router.replace("/scores?date=2026-09-30");
        await router.push("/news");
        await wrapper.vm.$nextTick();

        expect(wrapper.classes()).not.toContain("scores");
        expect(warn.mock.calls.flat().join(" ")).not.toMatch(/inject\(\)|Unhandled error/);
    });
});
