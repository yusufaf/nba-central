import { describe, it, expect, vi } from "vitest";

// Captures the interceptor callback api.ts registers at import time, so it
// can be driven directly without a real HTTP round trip.
const captured = vi.hoisted(() => ({
    onRequest: undefined as undefined | ((config: any) => Promise<any>),
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
            },
        }),
    },
}));

import { setAccessTokenGetter } from "@/network/api";

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
