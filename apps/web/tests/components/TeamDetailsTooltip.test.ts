import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent } from "vue";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import TeamDetailsTooltip from "@/components/Scores/TeamDetailsTooltip.vue";
import { loadStandings, resetStandings } from "@/composables/useStandings";
import { LIVE_DATA_BASE_URL, STANDINGS_REFRESH_MS } from "@/constants/liveData";
import standings from "../fixtures/liveData/standings.json";

const Passthrough = { template: "<div><slot /></div>" };
// Matched by its stubs key, so it needs no name of its own.
const TooltipStub = defineComponent({ emits: ["update:open"], template: "<div><slot /></div>" });

const mountTooltip = (competitorId = "20", homeAway = "home") =>
    mount(TeamDetailsTooltip, {
        props: { competitorId, homeAway },
        slots: { default: "<span>3-0</span>" },
        global: {
            stubs: {
                TooltipProvider: Passthrough,
                Tooltip: TooltipStub,
                TooltipTrigger: Passthrough,
                TooltipContent: Passthrough,
            },
        },
    });

const open = async (wrapper: VueWrapper, isOpen = true) => {
    wrapper.findComponent(TooltipStub).vm.$emit("update:open", isOpen);
    await loadStandings();
    await flushPromises();
};

const withStreak = (espnId: string, streak: string) => ({
    ...standings,
    conferences: standings.conferences.map((conference) => ({
        ...conference,
        teams: conference.teams.map((team) => (team.espnId === espnId ? { ...team, streak } : team)),
    })),
});

beforeEach(() => {
    resetStandings();
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe("TeamDetailsTooltip", () => {
    it("loads nothing until it opens", () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify(standings)));
        vi.stubGlobal("fetch", fetchMock);
        const wrapper = mountTooltip();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(wrapper.text()).toContain("Loading...");
    });

    it("shows the team's standing from live standings, never ESPN", async () => {
        const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify(standings)));
        vi.stubGlobal("fetch", fetchMock);
        const wrapper = mountTooltip();
        await open(wrapper);

        expect(wrapper.text()).toContain("1st in Eastern Conference");
        expect(wrapper.text()).toContain("Home Win Pct: 100.0%");
        expect(wrapper.text()).not.toContain("Point Differential");
        const streak = wrapper.findAll("div").find((div) => div.text() === "Streak: W3");
        expect(streak?.classes()).toContain("text-success");
        for (const [url] of fetchMock.mock.calls) {
            expect(url.startsWith(LIVE_DATA_BASE_URL)).toBe(true);
            expect(url).not.toContain("espn");
        }
    });

    it("says standings are unavailable for a team not in the file", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(standings))));
        const wrapper = mountTooltip("99");
        await open(wrapper);
        expect(wrapper.text()).toContain("Standings unavailable.");
    });

    it("says standings are unavailable when the file can't be loaded", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
        const wrapper = mountTooltip();
        await open(wrapper);
        expect(wrapper.text()).toContain("Standings unavailable.");
    });

    it("shares one load between tooltips", async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify(standings)));
        vi.stubGlobal("fetch", fetchMock);
        const home = mountTooltip("20", "home");
        const away = mountTooltip("19", "away");
        await Promise.all([open(home), open(away)]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(away.text()).toContain("13th in Eastern Conference");
    });

    it("shows a newer copy once the refresh interval has passed", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        const fetchMock = vi
            .fn()
            .mockImplementationOnce(async () => new Response(JSON.stringify(standings)))
            .mockImplementationOnce(async () => new Response(JSON.stringify(withStreak("20", "L1"))));
        vi.stubGlobal("fetch", fetchMock);
        const wrapper = mountTooltip();
        await open(wrapper);
        expect(wrapper.text()).toContain("Streak: W3");

        vi.setSystemTime(Date.now() + STANDINGS_REFRESH_MS + 1);
        await open(wrapper, false);
        await open(wrapper);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(wrapper.text()).toContain("Streak: L1");
        expect(wrapper.text()).not.toContain("Streak: W3");
    });
});
