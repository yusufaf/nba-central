import { readonly, ref, watch } from 'vue';
import { useLogto } from '@logto/vue';
import { settingsSync } from '@/composables/useSettingsSync';

export interface CurrentUser {
    id: string;
    username: string | null;
    // When the yusufaf.dev account was created, from the ID token's
    // `created_at`; null if the token doesn't carry it.
    memberSince: Date | null;
}

const currentUser = ref<CurrentUser | null>(null);

// Logto's `created_at` is milliseconds since the epoch. The settings item's
// own createdAt isn't used: it dates from the first sign-in after settings
// shipped, not from when the account was made.
const readMemberSince = (claims: unknown): Date | null => {
    const createdAt = (claims as { created_at?: unknown } | undefined)?.created_at;
    if (typeof createdAt !== 'number' || !Number.isFinite(createdAt) || createdAt <= 0) {
        return null;
    }
    return new Date(createdAt);
};

/** The signed-in user, from the API access token's claims; null signed out. */
export const useCurrentUser = () => ({ currentUser: readonly(currentUser) });

/**
 * Called once, from App.vue: follows the Logto session, reads who the user
 * is from the same access token the API authorizer verifies (so `sub` is
 * the id the settings are stored under), and starts or stops the settings
 * sync to match.
 */
export function useAccountSession() {
    const { isAuthenticated, getAccessTokenClaims, getIdTokenClaims } = useLogto();

    const connect = async () => {
        // Resolves undefined, rather than throwing, when the token can't be
        // refreshed.
        const [claims, idClaims] = await Promise.all([
            getAccessTokenClaims(import.meta.env.VITE_LOGTO_API_RESOURCE),
            getIdTokenClaims().catch(() => undefined),
        ]);
        if (!isAuthenticated.value) {
            return;
        }
        if (!claims?.sub) {
            // Otherwise Settings would wait on a load that never starts.
            settingsSync.unavailable(connect);
            return;
        }
        currentUser.value = {
            id: claims.sub,
            username: typeof claims.username === 'string' ? claims.username : null,
            memberSince: readMemberSince(idClaims),
        };
        void settingsSync.start(claims.sub);
    };

    watch(
        isAuthenticated,
        (signedIn) => {
            if (signedIn) {
                void connect();
                return;
            }
            currentUser.value = null;
            settingsSync.stop();
        },
        { immediate: true },
    );
}
