import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, enableAutoUnmount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";

vi.mock("@/network/api", () => ({
    teamApi: { listTeams: vi.fn(), deleteTeam: vi.fn() },
}));
vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const isAuthenticated = ref(false);
const isLoading = ref(false);
vi.mock("@logto/vue", () => ({
    useLogto: () => ({ isAuthenticated, isLoading }),
}));

import Teams from "@/views/Teams.vue";
import { teamApi } from "@/network/api";

enableAutoUnmount(afterEach);

const mountTeams = async () => {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: "/teams", component: Teams },
            { path: "/login", component: { template: "<div />" } },
            { path: "/teambuilder", component: { template: "<div />" } },
        ],
    });
    await router.push("/teams");
    const wrapper = mount(Teams, {
        global: {
            plugins: [router],
            stubs: {
                PageTitle: true,
                PageShell: { template: "<div><slot /></div>" },
                ConfirmDialog: true,
            },
        },
    });
    await flushPromises();
    return { wrapper, router };
};

beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    isAuthenticated.value = false;
    isLoading.value = false;
    vi.mocked(teamApi.listTeams).mockResolvedValue({ success: true, data: { teams: [] } });
});

describe("Teams", () => {
    it("asks a signed-out visitor to sign in and never calls the list API", async () => {
        const { wrapper, router } = await mountTeams();

        expect(teamApi.listTeams).not.toHaveBeenCalled();
        expect(wrapper.text()).toContain("Sign in to see your teams");
        expect(wrapper.text()).not.toContain("401");

        const signIn = wrapper.findAll("button").find((b) => b.text() === "Sign in");
        await signIn!.trigger("click");
        await flushPromises();
        expect(router.currentRoute.value.path).toBe("/login");
    });

    it("lists a signed-in user's teams", async () => {
        isAuthenticated.value = true;
        const { wrapper } = await mountTeams();

        expect(teamApi.listTeams).toHaveBeenCalledOnce();
        expect(wrapper.text()).toContain("No teams yet");
    });

    it("waits for the stored session before deciding", async () => {
        isLoading.value = true;
        const { wrapper } = await mountTeams();

        expect(teamApi.listTeams).not.toHaveBeenCalled();
        expect(wrapper.text()).not.toContain("Sign in to see your teams");

        isAuthenticated.value = true;
        isLoading.value = false;
        await flushPromises();

        expect(teamApi.listTeams).toHaveBeenCalledOnce();
        expect(wrapper.text()).not.toContain("Sign in to see your teams");
    });
});
