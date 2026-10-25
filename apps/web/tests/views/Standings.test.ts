import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import Standings from "@/views/Standings.vue";
import { LIVE_DATA_BASE_URL } from "@/constants/liveData";
import standings from "../fixtures/liveData/standings.json";
import schedule from "../fixtures/liveData/schedule.json";

let responses: Record<string, () => Response>;
const fetchMock = vi.fn(async (url: string) => {
    const name = String(url).split("/").pop()!;
    return responses[name]?.() ?? new Response("missing", { status: 404 });
});

const json = (value: unknown) => () => new Response(JSON.stringify(value));

const mountStandings = async () => {
    const wrapper = mount(Standings, { global: { stubs: { PageTitle: true } } });
    await flushPromises();
    return wrapper;
};

beforeEach(() => {
    // Before the fixture's first tip-off (2026-10-26T23:00Z).
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-26T15:00:00Z") });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    responses = { "standings.json": json(standings), "schedule.json": json(schedule) };
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockClear();
});

describe("Standings", () => {
    it("shows both conferences, 15 rows each, from the cached files only", async () => {
        const wrapper = await mountStandings();

        const tables = wrapper.findAll("[data-conference]");
        expect(tables.map((t) => t.attributes("data-conference"))).toEqual(["East", "West"]);
        for (const table of tables) {
            expect(table.findAll('[data-testid="standings-row"]')).toHaveLength(15);
        }
        expect(wrapper.text()).toContain("2026-27 season");
        expect(wrapper.text()).toContain("Unofficial");

        expect(fetchMock).toHaveBeenCalledTimes(2);
        for (const [url] of fetchMock.mock.calls) {
            expect(String(url).startsWith(LIVE_DATA_BASE_URL)).toBe(true);
        }
    });

    it("lists each team's next game", async () => {
        const wrapper = await mountStandings();
        const charlotte = wrapper
            .findAll('[data-testid="standings-row"]')
            .find((row) => row.text().includes("Charlotte Hornets"))!;
        expect(charlotte.text()).toContain("vs WSH Mon");
    });

    it("moves Next on once a game tips off, without a reload", async () => {
        vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"], now: new Date("2026-10-26T22:59:00Z") });
        const wrapper = await mountStandings();
        const charlotte = () =>
            wrapper.findAll('[data-testid="standings-row"]').find((row) => row.text().includes("Charlotte Hornets"))!;
        expect(charlotte().text()).toContain("vs WSH Mon");

        // CHA-WSH tips at 23:00Z and is the fixture's only Charlotte game.
        await vi.advanceTimersByTimeAsync(2 * 60_000);
        expect(charlotte().text()).not.toContain("vs WSH");
    });

    it("shows an error state when the standings can't load", async () => {
        responses["standings.json"] = () => new Response("down", { status: 500 });
        const wrapper = await mountStandings();
        expect(wrapper.text()).toContain("Standings aren't available right now.");
        expect(wrapper.find("[data-conference]").exists()).toBe(false);
    });

    it("still shows the standings when the schedule fails", async () => {
        delete responses["schedule.json"];
        const wrapper = await mountStandings();
        expect(wrapper.findAll('[data-testid="standings-row"]')).toHaveLength(30);
        expect(wrapper.text()).not.toContain("vs WSH");
    });
});
