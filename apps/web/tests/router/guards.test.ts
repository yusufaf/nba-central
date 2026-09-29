import { describe, it, expect } from 'vitest';
import { ref, nextTick } from 'vue';
import { requireSignedIn } from '@/router/guards';

describe('requireSignedIn', () => {
    it('lets a signed-in user through', async () => {
        const result = await requireSignedIn({
            isAuthenticated: ref(true),
            isLoading: ref(false),
        });
        expect(result).toBe(true);
    });

    it('sends a signed-out user to sign in', async () => {
        const result = await requireSignedIn({
            isAuthenticated: ref(false),
            isLoading: ref(false),
        });
        expect(result).toEqual({ path: '/login' });
    });

    it('waits for Logto to finish reading the session before deciding', async () => {
        const isAuthenticated = ref(false);
        const isLoading = ref(true);

        const decision = requireSignedIn({ isAuthenticated, isLoading });
        await nextTick();
        isAuthenticated.value = true;
        isLoading.value = false;

        expect(await decision).toBe(true);
    });
});
