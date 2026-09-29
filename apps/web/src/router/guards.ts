import { until } from '@vueuse/core';
import type { Ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

type AuthState = {
    isAuthenticated: Readonly<Ref<boolean>>;
    isLoading: Readonly<Ref<boolean>>;
};

/**
 * For routes with `meta.requiresAuth`. @logto/vue starts every page load
 * with isAuthenticated false and reads the stored session asynchronously,
 * so a hard load of a guarded URL has to wait for that read or a signed-in
 * user would be bounced to sign-in.
 */
export const requireSignedIn = async (auth: AuthState): Promise<true | RouteLocationRaw> => {
    if (auth.isLoading.value) {
        await until(auth.isLoading).toBe(false);
    }
    return auth.isAuthenticated.value ? true : { path: '/login' };
};
