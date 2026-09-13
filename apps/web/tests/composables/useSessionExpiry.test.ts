import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    createSessionExpiry,
    createAuthenticatedTokenGetter,
    consumeSessionExpiredFlag,
    SESSION_EXPIRED_MESSAGE,
} from "@/composables/useSessionExpiry";

beforeEach(() => {
    sessionStorage.clear();
});

describe("createSessionExpiry", () => {
    it("signs out back to the origin and flags the expiry for the next load", async () => {
        const signOut = vi.fn().mockResolvedValue(undefined);
        const expireSession = createSessionExpiry(signOut);

        await expireSession();

        expect(signOut).toHaveBeenCalledWith(window.location.origin);
        expect(consumeSessionExpiredFlag()).toBe(true);
    });

    it("only signs out once when several requests expire together", async () => {
        const signOut = vi.fn().mockResolvedValue(undefined);
        const expireSession = createSessionExpiry(signOut);

        await Promise.all([expireSession(), expireSession(), expireSession()]);

        expect(signOut).toHaveBeenCalledTimes(1);
    });
});

describe("consumeSessionExpiredFlag", () => {
    it("is false when nothing expired", () => {
        expect(consumeSessionExpiredFlag()).toBe(false);
    });

    it("reports the expiry once, then clears it", async () => {
        await createSessionExpiry(vi.fn())();

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
