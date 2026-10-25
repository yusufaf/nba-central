import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { InternalAxiosRequestConfig } from "axios";

// Real axios, unlike api.test.ts: the deadline has to cover the async token
// interceptor, which only runs inside a real request.
import {
    api,
    dataApi,
    setAccessTokenGetter,
    PLAYER_STATS_CONCURRENCY,
    PLAYER_STATS_TIMEOUT_MS,
} from "@/network/api";
import { LimiterTimeoutError } from "@/utils/limit";

describe("dataApi.getPlayerStats deadline", () => {
    const originalAdapter = api.defaults.adapter;

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        api.defaults.adapter = originalAdapter;
        setAccessTokenGetter(async () => undefined);
    });

    it("frees the slots held by a token getter that never settles", async () => {
        const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => ({
            data: { data: [], available: true },
            status: 200,
            statusText: "OK",
            headers: {},
            config,
        }));
        api.defaults.adapter = adapter;
        let tokenCalls = 0;
        setAccessTokenGetter(() =>
            ++tokenCalls <= PLAYER_STATS_CONCURRENCY
                ? new Promise<never>(() => {})
                : Promise.resolve("tok"),
        );

        const hung = Array.from({ length: PLAYER_STATS_CONCURRENCY }, (_, i) =>
            dataApi.getPlayerStats(`hung${i}`),
        );
        const hungOutcomes = hung.map((r) => expect(r).rejects.toBeInstanceOf(LimiterTimeoutError));
        const late = dataApi.getPlayerStats("late");

        await vi.advanceTimersByTimeAsync(PLAYER_STATS_TIMEOUT_MS - 1);
        expect(adapter).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        await Promise.all(hungOutcomes);
        expect(await late).toEqual({ data: [], available: true });
        expect(adapter).toHaveBeenCalledTimes(1);
        expect(adapter.mock.calls[0][0].params).toEqual({ playerId: "late" });
        expect(adapter.mock.calls[0][0].headers.Authorization).toBe("Bearer tok");
    });
});
