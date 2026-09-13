import { describe, it, expect, vi, beforeEach } from "vitest";

// Captures the interceptor callbacks api.ts registers at import time, so
// each can be driven directly without a real HTTP round trip.
const captured = vi.hoisted(() => ({
    onRequest: undefined as undefined | ((config: any) => Promise<any>),
    onResponseError: undefined as undefined | ((error: any) => Promise<never>),
}));

vi.mock("axios", () => ({
    default: {
        create: () => ({
            interceptors: {
                request: {
                    use: (onFulfilled: any) => {
                        captured.onRequest = onFulfilled;
                    },
                },
                response: {
                    use: (_onFulfilled: any, onRejected: any) => {
                        captured.onResponseError = onRejected;
                    },
                },
            },
        }),
    },
}));

import { setAccessTokenGetter, setSessionExpiredHandler } from "@/network/api";

const onSessionExpired = vi.fn();

beforeEach(() => {
    onSessionExpired.mockReset();
    setSessionExpiredHandler(onSessionExpired);
});

describe("request interceptor", () => {
    it("attaches a bearer token when the getter yields one", async () => {
        setAccessTokenGetter(async () => "tok");

        const config = await captured.onRequest!({ headers: {} });

        expect(config.headers.Authorization).toBe("Bearer tok");
    });

    it("sends no header when the getter yields nothing", async () => {
        setAccessTokenGetter(async () => undefined);

        const config = await captured.onRequest!({ headers: {} });

        expect(config.headers.Authorization).toBeUndefined();
    });

    it("rejects the request when the getter throws", async () => {
        setAccessTokenGetter(async () => {
            throw new Error("expired");
        });

        await expect(captured.onRequest!({ headers: {} })).rejects.toThrow("expired");
    });
});

describe("response interceptor", () => {
    const reject = (error: any) => captured.onResponseError!(error);

    it("expires the session on a 401 for a request that carried a token", async () => {
        const error = {
            response: { status: 401 },
            config: { headers: { Authorization: "Bearer tok" } },
        };

        await expect(reject(error)).rejects.toBe(error);
        expect(onSessionExpired).toHaveBeenCalledTimes(1);
    });

    it("ignores a 401 on an anonymous request", async () => {
        const error = { response: { status: 401 }, config: { headers: {} } };

        await expect(reject(error)).rejects.toBe(error);
        expect(onSessionExpired).not.toHaveBeenCalled();
    });

    it("ignores other statuses and network errors", async () => {
        const server = {
            response: { status: 500 },
            config: { headers: { Authorization: "Bearer tok" } },
        };
        const network = { config: { headers: { Authorization: "Bearer tok" } } };

        await expect(reject(server)).rejects.toBe(server);
        await expect(reject(network)).rejects.toBe(network);
        expect(onSessionExpired).not.toHaveBeenCalled();
    });
});
