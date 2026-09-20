import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@/network/api", () => ({
    teamApi: { getPublicTeam: vi.fn() },
}));
const push = vi.fn();
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));
const { toast, downloadUrlAsFile } = vi.hoisted(() => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
    downloadUrlAsFile: vi.fn(),
}));
vi.mock("vue-sonner", () => ({ toast }));
vi.mock("@/utils/downloadFile", () => ({
    downloadUrlAsFile,
    slugFilename: vi.fn(() => "x.png"),
}));

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

    it("shows a custom player's overallRating and includes it in the average", async () => {
        const customTeam = {
            ...team,
            roster: [
                { slot: 1, player: { fullName: "Michael Jordan", position: "SG", rating: 99 } },
                { slot: 2, player: { fullName: "Custom Guy", position: "PF", isCustom: true, overallRating: 80 } },
            ],
        };
        vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: true, data: customTeam as any });
        const wrapper = mountView();
        await flushPromises();
        const text = wrapper.text();
        expect(text).toContain("Custom Guy");
        expect(text).toContain("80");
        expect(text).toContain("Avg 90");
    });

    it("toasts success when the copy-link click succeeds", async () => {
        vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: true, data: team as any });
        Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
        const wrapper = mountView();
        await flushPromises();
        await wrapper.find('[data-testid="copy-link-button"]').trigger("click");
        await flushPromises();
        expect(toast.success).toHaveBeenCalledWith("Link copied");
    });

    it("toasts an error when the copy-link click fails", async () => {
        vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: true, data: team as any });
        Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("nope")) } });
        const wrapper = mountView();
        await flushPromises();
        await wrapper.find('[data-testid="copy-link-button"]').trigger("click");
        await flushPromises();
        expect(toast.error).toHaveBeenCalledWith("Couldn't copy — copy it from your browser's address bar");
    });

    it("refetches when navigating from one team to another", async () => {
        vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: true, data: team as any });
        const wrapper = mountView();
        await flushPromises();
        expect(teamApi.getPublicTeam).toHaveBeenCalledWith("t1");

        await wrapper.setProps({ teamUUID: "t2" });
        await flushPromises();

        expect(teamApi.getPublicTeam).toHaveBeenCalledWith("t2");
    });

    it("toasts an error when the card download fails", async () => {
        vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: true, data: team as any });
        downloadUrlAsFile.mockRejectedValue(new Error("nope"));
        const wrapper = mountView();
        await flushPromises();
        await wrapper.find('[data-testid="download-card-button"]').trigger("click");
        await flushPromises();
        expect(toast.error).toHaveBeenCalledWith("Failed to download card");
    });
});
