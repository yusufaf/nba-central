import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import PlayerSlot from "@/components/TeamBuilder/PlayerSlot.vue";
import type { PlayerStatsStatus } from "@/models/types";

// No case here fetches headshots.json; PlayerSlotHeadshot.test.ts covers the
// real lookup.
vi.mock("@/composables/useHeadshots", () => ({
    headshotUrl: (id: string) =>
        id === "jamesle01" ? "https://d2s6ea2hcvgd9x.cloudfront.net/live/headshots/1966.png" : undefined,
}));

const SEASON = { season: 2025, games_played: 70, pts: 24.4, reb: 7.8, ast: 8.2 };

const player = (statsStatus?: PlayerStatsStatus, playerStats: unknown[] = []) => ({
    id: "jamesle01",
    fullName: "LeBron James",
    first_name: "LeBron",
    last_name: "James",
    position: "SF",
    team: { full_name: "Los Angeles Lakers", abbreviation: "LAL" },
    playerStats,
    statsStatus,
});

const mountSlot = (props: Record<string, unknown>) =>
    mount(PlayerSlot, {
        props: { slotIndex: 3, ...props },
        global: { stubs: { ExternalLinksMenu: true } },
    });

const retryButton = (wrapper: ReturnType<typeof mountSlot>) =>
    wrapper.findAll("button").find((b) => b.text().includes("Retry"));

describe("PlayerSlot headshot", () => {
    it("shows the player's headshot from the CDN", () => {
        const img = mountSlot({ player: player("ready") }).find("img");
        expect(img.attributes("src")).toBe("https://d2s6ea2hcvgd9x.cloudfront.net/live/headshots/1966.png");
        expect(img.attributes("alt")).toBe("LeBron James");
    });

    it("gives a custom player none", () => {
        const wrapper = mountSlot({ player: { ...player("ready"), isCustom: true } });
        expect(wrapper.find("img").exists()).toBe(false);
        expect(wrapper.text()).toContain("LJ");
    });
});

describe("PlayerSlot stats states", () => {
    it.each([
        ["failed", "Couldn't load stats"],
        ["retrying", "Loading stats..."],
        ["unavailable", "Stats not available yet"],
        ["ready", "No NBA games yet"],
    ] as const)("shows the %s state", (status, copy) => {
        const wrapper = mountSlot({ player: player(status) });
        expect(wrapper.text()).toContain(copy);
    });

    it("offers Retry only for a failed or retrying load", () => {
        expect(retryButton(mountSlot({ player: player("failed") }))).toBeDefined();
        expect(retryButton(mountSlot({ player: player("unavailable") }))).toBeUndefined();
        expect(retryButton(mountSlot({ player: player("ready") }))).toBeUndefined();
    });

    it("shows the stats and no notice once they loaded", () => {
        const wrapper = mountSlot({ player: player("ready", [SEASON]) });
        expect(wrapper.text()).toContain("24.4");
        expect(wrapper.find(".stats-notice").exists()).toBe(false);
    });

    it("shows no notice for a custom player, whose stats are never fetched", () => {
        const wrapper = mountSlot({ player: { ...player(), isCustom: true } });
        expect(wrapper.find(".stats-notice").exists()).toBe(false);
    });

    it("Retry emits retryStats, not flip", async () => {
        const wrapper = mountSlot({ player: player("failed") });
        await retryButton(wrapper)!.trigger("click");
        expect(wrapper.emitted("retryStats")).toEqual([[3]]);
        expect(wrapper.emitted("flip")).toBeUndefined();
    });

    it("keeps Retry mounted but inert while retrying", async () => {
        const wrapper = mountSlot({ player: player("retrying") });
        const button = retryButton(wrapper)!;
        expect(button.attributes("aria-disabled")).toBe("true");
        await button.trigger("click");
        expect(wrapper.emitted("retryStats")).toBeUndefined();
        expect(wrapper.emitted("flip")).toBeUndefined();
    });

    it("disables View Stats on the back of a failed card and says why", () => {
        const wrapper = mountSlot({ player: player("failed"), isFlipped: true });
        const viewStats = wrapper.findAll("button").find((b) => b.text().includes("View Stats"))!;
        expect(viewStats.attributes("disabled")).toBeDefined();
        expect(wrapper.text()).toContain("Couldn't load stats. Flip to retry.");
        expect(retryButton(wrapper)).toBeUndefined();
    });

    it("keeps View Stats enabled on the back of an unavailable card", () => {
        const wrapper = mountSlot({ player: player("unavailable"), isFlipped: true });
        const viewStats = wrapper.findAll("button").find((b) => b.text().includes("View Stats"))!;
        expect(viewStats.attributes("disabled")).toBeUndefined();
    });
});
