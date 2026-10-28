import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createRouter, createMemoryHistory, type Router } from "vue-router";

const { notifyScoreChanges } = vi.hoisted(() => ({ notifyScoreChanges: vi.fn() }));
vi.mock("@/composables/useGameNotifications", () => ({
    useGameNotifications: () => ({ notifyScoreChanges }),
}));

import Scores from "@/views/Scores.vue";
import scoreboard from "../../../cdk/test/fixtures/espn/scoreboard-20261026.json";

type Events = typeof scoreboard.events;

const withState = (events: Events, state: "pre" | "in" | "post") =>
    events.map((event) => ({
        ...event,
        competitions: event.competitions.map((c) => ({
            ...c,
            status: { ...c.status, type: { ...c.status.type, state, completed: state === "post" } },
        })),
    }));

const respond = (events: unknown[]) => new Response(JSON.stringify({ events }));

let fetchMock: ReturnType<typeof vi.fn>;
let wrapper: VueWrapper | undefined;

const mountScores = async (date: string): Promise<Router> => {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: "/scores", name: "scores", component: Scores }],
    });
    await router.push(`/scores?date=${date}`);
    wrapper = mount(Scores, {
        global: {
            plugins: [router],
            stubs: {
                PageTitle: true,
                ScoreCard: true,
                DatePicker: true,
                ManageNotifications: true,
                OptionsMenu: true,
                GameReplaysWarning: true,
            },
        },
    });
    return router;
};

const dayRequests = () =>
    fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/api/scores/day/"));

beforeEach(() => {
    vi.useFakeTimers({ now: new Date(2026, 9, 26, 20, 0) });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.clear();
    notifyScoreChanges.mockClear();
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("Scores", () => {
    it("keeps the day now selected when the previous day's answer arrives late", async () => {
        let resolveFirstDay!: (res: Response) => void;
        fetchMock.mockImplementation(async (url: string) => {
            if (url.endsWith("/day/20261025")) return new Promise<Response>((r) => { resolveFirstDay = r; });
            if (url.endsWith("/day/20261026")) return respond(scoreboard.events.slice(0, 1));
            return respond([]);
        });

        const router = await mountScores("2026-10-25");
        await flushPromises();
        await router.replace("/scores?date=2026-10-26");
        await flushPromises();
        expect(wrapper!.findAllComponents({ name: "ScoreCard" })).toHaveLength(1);

        resolveFirstDay(respond(scoreboard.events));
        await flushPromises();
        expect(wrapper!.findAllComponents({ name: "ScoreCard" })).toHaveLength(1);
    });

    it("stops the previous day's polling when the next day fails to load", async () => {
        fetchMock.mockImplementation(async (url: string) =>
            url.endsWith("/day/20261026")
                ? respond(withState(scoreboard.events, "in"))
                : url.includes("/day/")
                  ? new Response("{}", { status: 502 })
                  : respond([]),
        );

        const router = await mountScores("2026-10-26");
        await flushPromises();
        await router.replace("/scores?date=2026-10-24");
        await flushPromises();
        expect(dayRequests()).toEqual(["/api/scores/day/20261026", "/api/scores/day/20261024"]);

        await vi.advanceTimersByTimeAsync(45_000);
        expect(dayRequests()).toHaveLength(2);
    });

    it("ignores a day that loads after the viewer has left the page", async () => {
        let resolveDay!: (res: Response) => void;
        fetchMock.mockImplementation(async (url: string) =>
            url.includes("/day/") ? new Promise<Response>((r) => { resolveDay = r; }) : respond([]),
        );

        await mountScores("2026-10-26");
        await flushPromises();
        wrapper!.unmount();
        wrapper = undefined;

        resolveDay(respond(withState(scoreboard.events, "in")));
        await flushPromises();
        await vi.advanceTimersByTimeAsync(30_000);
        expect(notifyScoreChanges).not.toHaveBeenCalled();
        expect(dayRequests()).toHaveLength(1);
    });

    it("polls a live day every 15 s", async () => {
        fetchMock.mockImplementation(async (url: string) =>
            respond(url.includes("/day/") ? withState(scoreboard.events, "in") : []),
        );

        await mountScores("2026-10-26");
        await flushPromises();
        await vi.advanceTimersByTimeAsync(30_000);
        expect(dayRequests()).toHaveLength(3);
    });
});
