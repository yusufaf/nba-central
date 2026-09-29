import { readonly, ref, watch } from 'vue';
import { useLogto } from '@logto/vue';
import { settingsSync } from '@/composables/useSettingsSync';

export interface CurrentUser {
    id: string;
    username: string | null;
}

const currentUser = ref<CurrentUser | null>(null);

/** The signed-in user, from the API access token's claims; null signed out. */
export const useCurrentUser = () => ({ currentUser: readonly(currentUser) });

/**
 * Called once, from App.vue: follows the Logto session, reads who the user
 * is from the same access token the API authorizer verifies (so `sub` is
 * the id the settings are stored under), and starts or stops the settings
 * sync to match.
 */
export function useAccountSession() {
    const { isAuthenticated, getAccessTokenClaims } = useLogto();

    const connect = async () => {
        // Resolves undefined, rather than throwing, when the token can't be
        // refreshed.
        const claims = await getAccessTokenClaims(import.meta.env.VITE_LOGTO_API_RESOURCE);
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
