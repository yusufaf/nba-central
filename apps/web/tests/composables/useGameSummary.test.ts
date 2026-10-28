import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent } from "vue";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";

vi.mock("vue-sonner", () => ({ toast: { error: vi.fn() } }));

import { toast } from "vue-sonner";
import { useGameSummary } from "@/composables/useGameSummary";

const GAME_ID = "401859965";

const summary = (state: "in" | "post") => ({
    header: {
        competitions: [{ status: { type: { state, completed: state === "post" } } }],
    },
});

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

let fetchMock: ReturnType<typeof vi.fn>;
let wrapper: VueWrapper | undefined;

const mountSummary = () => {
    let state!: ReturnType<typeof useGameSummary>;
    wrapper = mount(
        defineComponent({
            setup() {
                state = useGameSummary(GAME_ID);
                return () => null;
            },
        }),
    );
    return () => state;
};

beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(toast.error).mockClear();
    sessionStorage.clear();
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("useGameSummary", () => {
    it("loads the box score from /api/scores and caches nothing itself", async () => {
        fetchMock.mockResolvedValue(respond(summary("post")));
        const state = mountSummary();
        await flushPromises();

        expect(fetchMock).toHaveBeenCalledWith(`/api/scores/game/${GAME_ID}`);
        expect(state().gameSummary.value).toEqual(summary("post"));
        expect(sessionStorage.length).toBe(0);
    });

    it("says the game wasn't found on a 410", async () => {
        fetchMock.mockResolvedValue(respond({ success: false }, 410));
        const state = mountSummary();
        await flushPromises();

        expect(state().error.value).toBe("Game not found or not yet available");
        expect(toast.error).toHaveBeenCalledOnce();
    });

    it("refreshes a live game every 15 s", async () => {
        fetchMock.mockImplementation(async () => respond(summary("in")));
        mountSummary();
        await flushPromises();

        await vi.advanceTimersByTimeAsync(15_000);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("doesn't refresh a finished game", async () => {
        fetchMock.mockImplementation(async () => respond(summary("post")));
        mountSummary();
        await flushPromises();

        await vi.advanceTimersByTimeAsync(60_000);
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("keeps the previous box score when a refresh fails", async () => {
        fetchMock.mockResolvedValueOnce(respond(summary("in")));
        const state = mountSummary();
        await flushPromises();

        fetchMock.mockResolvedValueOnce(respond({ success: false }, 502));
        await vi.advanceTimersByTimeAsync(15_000);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(state().gameSummary.value).toEqual(summary("in"));
        expect(state().error.value).toBeNull();
        expect(toast.error).not.toHaveBeenCalled();
    });

    it("starts no refresh when unmounted before the first load finishes", async () => {
        let resolve!: (res: Response) => void;
        fetchMock.mockReturnValueOnce(new Promise<Response>((r) => { resolve = r; }));
        mountSummary();
        wrapper!.unmount();
        wrapper = undefined;

        resolve(respond(summary("in")));
        await flushPromises();
        await vi.advanceTimersByTimeAsync(15_000);
        expect(fetchMock).toHaveBeenCalledOnce();
    });
});
