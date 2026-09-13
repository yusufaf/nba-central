import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    createSessionExpiry,
    createAuthenticatedTokenGetter,
    consumeSessionExpiredFlag,
    SESSION_EXPIRED_MESSAGE,
} from "@/composables/useSessionExpiry";

beforeEach(() => {
    sessionStorage.clear();
});

// @logto/vue's proxied calls never throw; a failure only shows up as a new
// value on its `error` ref, which these deps simulate.
const buildExpiry = ({ signOutFails = false } = {}) => {
    let error: unknown;
    const deps = {
        signOut: vi.fn(async () => {
            if (signOutFails) {
                error = new Error("fetch failed");
            }
        }),
        clearAllTokens: vi.fn().mockResolvedValue(undefined),
        getError: () => error,
    };
    return { deps, expireSession: createSessionExpiry(deps) };
};

describe("createSessionExpiry", () => {
    const assign = vi.fn();

    beforeEach(() => {
        assign.mockReset();
        vi.stubGlobal("location", { ...window.location, origin: "http://localhost:3000", assign });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("signs out back to the origin and flags the expiry for the next load", async () => {
        const { deps, expireSession } = buildExpiry();

        await expireSession();

        expect(deps.signOut).toHaveBeenCalledWith("http://localhost:3000");
        expect(deps.clearAllTokens).not.toHaveBeenCalled();
        expect(assign).not.toHaveBeenCalled();
        expect(consumeSessionExpiredFlag()).toBe(true);
    });

    it("only signs out once when several requests expire together", async () => {
        const { deps, expireSession } = buildExpiry();

        await Promise.all([expireSession(), expireSession(), expireSession()]);

        expect(deps.signOut).toHaveBeenCalledTimes(1);
    });

    it("clears tokens and reloads itself when Logto's sign-out silently fails", async () => {
        const { deps, expireSession } = buildExpiry({ signOutFails: true });

        await expireSession();

        expect(deps.clearAllTokens).toHaveBeenCalledTimes(1);
        expect(assign).toHaveBeenCalledWith("http://localhost:3000");
        expect(consumeSessionExpiredFlag()).toBe(true);
    });
});

describe("consumeSessionExpiredFlag", () => {
    it("is false when nothing expired", () => {
        expect(consumeSessionExpiredFlag()).toBe(false);
    });

    it("reports the expiry once, then clears it", async () => {
        await buildExpiry().expireSession();

        expect(consumeSessionExpiredFlag()).toBe(true);
        expect(consumeSessionExpiredFlag()).toBe(false);
    });
});

describe("createAuthenticatedTokenGetter", () => {
    const build = (overrides: Partial<Parameters<typeof createAuthenticatedTokenGetter>[0]> = {}) => {
        const deps = {
            isAuthenticated: () => true,
            getAccessToken: vi.fn().mockResolvedValue("tok"),
            expireSession: vi.fn().mockResolvedValue(undefined),
            ...overrides,
        };
        return { deps, getToken: createAuthenticatedTokenGetter(deps) };
    };

    it("returns the access token while signed in", async () => {
        const { getToken } = build();

        await expect(getToken()).resolves.toBe("tok");
    });

    it("yields nothing, without probing Logto, while signed out", async () => {
        const { deps, getToken } = build({ isAuthenticated: () => false });

        await expect(getToken()).resolves.toBeUndefined();
        expect(deps.getAccessToken).not.toHaveBeenCalled();
        expect(deps.expireSession).not.toHaveBeenCalled();
    });

    it("expires the session and fails the request when signed in but the refresh fails", async () => {
        const { deps, getToken } = build({
            getAccessToken: vi.fn().mockResolvedValue(undefined),
        });

        await expect(getToken()).rejects.toThrow(SESSION_EXPIRED_MESSAGE);
        expect(deps.expireSession).toHaveBeenCalledTimes(1);
    });
});
