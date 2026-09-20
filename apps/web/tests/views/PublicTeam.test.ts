import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@/network/api", () => ({
    teamApi: { getPublicTeam: vi.fn() },
}));
const push = vi.fn();
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));

import PublicTeam from "@/views/PublicTeam.vue";
import { teamApi } from "@/network/api";

const team = {
    teamUUID: "t1",
    username: "yusuf",
    title: "Sharers",
    description: "",
    city: "Chicago",
    country: "USA",
    logoUrl: "",
    jerseyUrl: "",
    playerCount: 6,
    roster: [
        { slot: 1, player: { fullName: "Michael Jordan", position: "SG", rating: 99 } },
        { slot: 6, player: { fullName: "Bench Guy" } },
    ],
    coach: { name: "Phil Jackson", isCustom: false },
    gm: null,
    arena: { name: "United Center" },
    createdAt: 1,
    updatedAt: 2,
    public: true,
    publishedAt: 2,
    cardUrl: "https://cdn/x.png",
};

const mountView = () =>
    mount(PublicTeam, {
        props: { teamUUID: "t1" },
        global: {
            stubs: {
                PageShell: { template: "<div><slot /></div>" },
                "router-link": { template: "<a><slot /></a>" },
            },
        },
    });

beforeEach(() => vi.clearAllMocks());

describe("PublicTeam", () => {
    it("renders the team, staff, and owner", async () => {
        vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: true, data: team as any });
        const wrapper = mountView();
        await flushPromises();
        expect(teamApi.getPublicTeam).toHaveBeenCalledWith("t1");
        const text = wrapper.text();
        expect(text).toContain("Sharers");
        expect(text).toContain("by yusuf");
        expect(text).toContain("Michael Jordan");
        expect(text).toContain("Bench Guy");
        expect(text).toContain("Phil Jackson");
        expect(text).toContain("United Center");
    });

    it("shows the not-found state for a private or missing team", async () => {
        vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: false, error: "Team not found" });
        const wrapper = mountView();
        await flushPromises();
        expect(wrapper.find('[data-testid="not-found"]').exists()).toBe(true);
    });

    it("remixes into the builder", async () => {
        vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: true, data: team as any });
        const wrapper = mountView();
        await flushPromises();
        await wrapper.find('[data-testid="remix-button"]').trigger("click");
        expect(push).toHaveBeenCalledWith({ path: "/teambuilder", query: { remix: "t1" } });
    });
});
