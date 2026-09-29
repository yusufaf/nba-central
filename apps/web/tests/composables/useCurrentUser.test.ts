import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';

const isAuthenticated = ref(false);
const getAccessTokenClaims = vi.fn();

vi.mock('@logto/vue', () => ({
    useLogto: () => ({ isAuthenticated, getAccessTokenClaims }),
}));
vi.mock('@/composables/useSettingsSync', () => ({
    settingsSync: { start: vi.fn(), stop: vi.fn() },
}));

import { settingsSync } from '@/composables/useSettingsSync';
import { useAccountSession, useCurrentUser } from '@/composables/useCurrentUser';

beforeEach(() => {
    isAuthenticated.value = false;
    vi.clearAllMocks();
});

describe('useAccountSession', () => {
    it('starts the settings sync under the access token sub once signed in', async () => {
        getAccessTokenClaims.mockResolvedValue({ sub: 'logto-user-1', username: 'hooper' });
        useAccountSession();

        isAuthenticated.value = true;
        await flushPromises();

        expect(settingsSync.start).toHaveBeenCalledWith('logto-user-1');
        expect(useCurrentUser().currentUser.value).toEqual({
            id: 'logto-user-1',
            username: 'hooper',
        });
    });

    it('does not start the sync when the token claims are unavailable', async () => {
        getAccessTokenClaims.mockResolvedValue(undefined);
        useAccountSession();

        isAuthenticated.value = true;
        await flushPromises();

        expect(settingsSync.start).not.toHaveBeenCalled();
    });

    it('stops the sync and forgets the user on sign-out', async () => {
        getAccessTokenClaims.mockResolvedValue({ sub: 'logto-user-1' });
        useAccountSession();
        isAuthenticated.value = true;
        await flushPromises();

        isAuthenticated.value = false;
        await nextTick();

        expect(settingsSync.stop).toHaveBeenCalled();
        expect(useCurrentUser().currentUser.value).toBeNull();
    });
});
