import { useLogto } from '@logto/vue';

export const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please sign in again.';

// sessionStorage rather than a ref: signOut() leaves the page (Logto's
// end-session endpoint, then back to origin), so the toast has to outlive
// the reload. Per-tab, and the same tab is what comes back.
const SESSION_EXPIRED_KEY = 'nba-central:session-expired';

type SignOut = (postLogoutRedirectUri: string) => Promise<void> | void;

/**
 * Ends a session whose tokens can no longer be refreshed. @logto/vue's
 * isAuthenticated only reflects that tokens exist in storage, so without
 * this the app stays "signed in" while every private request goes out
 * anonymous and 401s (#94). signOut() clears storage and reloads at home;
 * the flag makes App.vue explain why once it comes back.
 */
export function createSessionExpiry(signOut: SignOut) {
    // Several requests fire together on a page load; only the first one
    // should start the redirect.
    let expiring = false;

    return async function expireSession(): Promise<void> {
        if (expiring) {
            return;
        }
        expiring = true;
        try {
            sessionStorage.setItem(SESSION_EXPIRED_KEY, '1');
        } catch {
            // Storage blocked - the redirect still happens, only the toast is lost.
        }
        await signOut(window.location.origin);
    };
}

/** True once per expiry, on the page load that follows the sign-out. */
export function consumeSessionExpiredFlag(): boolean {
    try {
        const expired = sessionStorage.getItem(SESSION_EXPIRED_KEY) === '1';
        if (expired) {
            sessionStorage.removeItem(SESSION_EXPIRED_KEY);
        }
        return expired;
    } catch {
        return false;
    }
}

type TokenGetterDeps = {
    isAuthenticated: () => boolean;
    getAccessToken: () => Promise<string | undefined>;
    expireSession: () => Promise<void>;
};

/**
 * The api.ts request-interceptor getter. Signed out: no header, same as
 * before. Signed in but the refresh fails (getAccessToken resolves
 * undefined rather than throwing): start the sign-out and fail the
 * request locally, so the page shows why instead of a bare 401.
 */
export function createAuthenticatedTokenGetter({
    isAuthenticated,
    getAccessToken,
    expireSession,
}: TokenGetterDeps) {
    return async (): Promise<string | undefined> => {
        if (!isAuthenticated()) {
            return undefined;
        }
        const token = await getAccessToken();
        if (!token) {
            void expireSession();
            throw new Error(SESSION_EXPIRED_MESSAGE);
        }
        return token;
    };
}

export function useSessionExpiry() {
    const { isAuthenticated, getAccessToken, signOut } = useLogto();
    const expireSession = createSessionExpiry(signOut);
    const getApiAccessToken = createAuthenticatedTokenGetter({
        isAuthenticated: () => isAuthenticated.value,
        getAccessToken: () => getAccessToken(import.meta.env.VITE_LOGTO_API_RESOURCE),
        expireSession,
    });

    return { expireSession, getApiAccessToken };
}
