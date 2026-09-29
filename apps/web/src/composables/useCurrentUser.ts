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

    watch(
        isAuthenticated,
        async (signedIn) => {
            if (!signedIn) {
                currentUser.value = null;
                settingsSync.stop();
                return;
            }
            // Resolves undefined when the refresh token is dead; the next
            // API call's session-expiry handling signs the user out.
            const claims = await getAccessTokenClaims(import.meta.env.VITE_LOGTO_API_RESOURCE);
            if (!claims?.sub || !isAuthenticated.value) {
                return;
            }
            currentUser.value = {
                id: claims.sub,
                username: typeof claims.username === 'string' ? claims.username : null,
            };
            void settingsSync.start(claims.sub);
        },
        { immediate: true },
    );
}
