import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';

const callback = vi.hoisted(() => ({ onSignedIn: null as null | (() => void) }));
vi.mock('@logto/vue', async () => {
    const { ref } = await import('vue');
    return {
        useHandleSignInCallback: (onSignedIn: () => void) => {
            callback.onSignedIn = onSignedIn;
            return { isLoading: ref(true) };
        },
    };
});

import Callback from '@/views/Callback.vue';
import { stashPendingSave, PENDING_SAVE_MAX_AGE_MS } from '@/composables/usePendingSave';

const mountCallback = async () => {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/callback', component: Callback },
            { path: '/', component: { template: '<div />' } },
            { path: '/teambuilder', component: { template: '<div />' } },
        ],
    });
    await router.push('/callback');
    mount(Callback, { global: { plugins: [router] } });
    return router;
};

const finishSignIn = async (router: Awaited<ReturnType<typeof mountCallback>>) => {
    callback.onSignedIn!();
    await router.isReady();
    await new Promise((resolve) => setTimeout(resolve));
};

beforeEach(() => {
    sessionStorage.clear();
});

describe('Callback', () => {
    it('sends a normal sign-in home', async () => {
        const router = await mountCallback();

        await finishSignIn(router);

        expect(router.currentRoute.value.fullPath).toBe('/');
    });

    it('sends a sign-in that started from Save back to the builder to finish it', async () => {
        stashPendingSave({ title: 'Dream Team', roster: [], coach: null, gm: null, arena: null });
        const router = await mountCallback();

        await finishSignIn(router);

        expect(router.currentRoute.value.fullPath).toBe('/teambuilder?resume=save');
    });

    it('sends a sign-in home when the stashed team is too old to save', async () => {
        stashPendingSave(
            { title: 'Dream Team', roster: [], coach: null, gm: null, arena: null },
            Date.now() - PENDING_SAVE_MAX_AGE_MS - 1000,
        );
        const router = await mountCallback();

        await finishSignIn(router);

        expect(router.currentRoute.value.fullPath).toBe('/');
    });
});
