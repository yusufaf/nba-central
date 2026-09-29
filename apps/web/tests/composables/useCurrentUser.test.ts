import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effectScope, ref, nextTick, type EffectScope } from 'vue';
import { flushPromises } from '@vue/test-utils';

const isAuthenticated = ref(false);
const getAccessTokenClaims = vi.fn();

vi.mock('@logto/vue', () => ({
    useLogto: () => ({ isAuthenticated, getAccessTokenClaims }),
}));
vi.mock('@/composables/useSettingsSync', () => ({
    settingsSync: { start: vi.fn(), stop: vi.fn(), unavailable: vi.fn() },
}));

import { settingsSync } from '@/composables/useSettingsSync';
import { useAccountSession, useCurrentUser } from '@/composables/useCurrentUser';

let scope: EffectScope;

// Each test's watcher is stopped afterwards, so it can't react to the next
// test flipping the shared isAuthenticated ref.
const startSession = () => {
    scope = effectScope();
    scope.run(() => useAccountSession());
};

beforeEach(() => {
    isAuthenticated.value = false;
    vi.clearAllMocks();
});

afterEach(() => scope?.stop());

describe('useAccountSession', () => {
    it('starts the settings sync under the access token sub once signed in', async () => {
        getAccessTokenClaims.mockResolvedValue({ sub: 'logto-user-1', username: 'hooper' });
        startSession();

        isAuthenticated.value = true;
        await flushPromises();

        expect(settingsSync.start).toHaveBeenCalledWith('logto-user-1');
        expect(useCurrentUser().currentUser.value).toEqual({
            id: 'logto-user-1',
            username: 'hooper',
        });
    });

    it('reports the sync unavailable, with a way to try again, when the claims are missing', async () => {
        getAccessTokenClaims.mockResolvedValue(undefined);
        startSession();

        isAuthenticated.value = true;
        await flushPromises();

        expect(settingsSync.start).not.toHaveBeenCalled();
        expect(settingsSync.unavailable).toHaveBeenCalledTimes(1);

        getAccessTokenClaims.mockResolvedValue({ sub: 'logto-user-1' });
        const tryAgain = vi.mocked(settingsSync.unavailable).mock.calls[0][0];
        await tryAgain();

        expect(settingsSync.start).toHaveBeenCalledWith('logto-user-1');
    });

    it('stops the sync and forgets the user on sign-out', async () => {
        getAccessTokenClaims.mockResolvedValue({ sub: 'logto-user-1' });
        startSession();
        isAuthenticated.value = true;
        await flushPromises();

        isAuthenticated.value = false;
        await nextTick();

        expect(settingsSync.stop).toHaveBeenCalled();
        expect(useCurrentUser().currentUser.value).toBeNull();
    });
});
