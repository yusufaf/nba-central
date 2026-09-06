import { ref } from 'vue';
import { useLogto } from '@logto/vue';
import { useRouter } from 'vue-router';
import { getApiErrorMessage } from '@/composables/useApiErrorMessage';

interface SignInOptions {
    redirectUri: string;
    firstScreen?: 'register';
}

// useLogto()'s `error` ref is a single app-wide singleton shared by every
// Logto operation (signIn, getAccessToken, ...) and is never reset by the
// library — an unrelated token refresh failing elsewhere in the app would
// otherwise show up here as a false "sign-in failed". We only treat it as
// our own failure if this call is the one that just set it.
export function useLogtoSignIn(buildOptions: () => SignInOptions) {
    const { signIn, isAuthenticated, getAccessToken, error: logtoError } = useLogto();
    const router = useRouter();
    const error = ref<string>();
    const isSigningIn = ref(false);

    async function startSignIn() {
        if (isSigningIn.value) {
            return;
        }

        if (isAuthenticated.value) {
            // isAuthenticated only reflects token presence, not expiry — a
            // stale session with a dead refresh token would otherwise land
            // here and bounce home instead of ever reaching a real sign-in.
            // getAccessToken() refreshes on demand and resolves undefined
            // (rather than throwing) if that refresh fails. Probe the same
            // API-resource token App.vue actually needs — the default-resource
            // token has its own refresh entry and can be valid independently.
            isSigningIn.value = true;
            const accessToken = await getAccessToken(import.meta.env.VITE_LOGTO_API_RESOURCE);
            isSigningIn.value = false;
            if (accessToken) {
                router.push('/');
                return;
            }
        }

        isSigningIn.value = true;
        error.value = undefined;
        const errorBeforeCall = logtoError.value;
        await signIn(buildOptions());
        if (logtoError.value && logtoError.value !== errorBeforeCall) {
            error.value = getApiErrorMessage(
                logtoError.value,
                'Something went wrong. Please try again.',
            );
        }
        isSigningIn.value = false;
    }

    return { error, isSigningIn, isAuthenticated, startSignIn };
}
