import { describe, it, expect, vi } from 'vitest';

vi.mock('@/views/Home.vue', () => ({ default: {} }));

describe('route views', () => {
    // Home stays in the entry chunk as the most common landing page; every
    // other view is fetched when its route is first visited. A fresh router,
    // because vue-router swaps a lazy loader for the loaded view after the
    // first visit.
    it('loads every view but Home on demand', async () => {
        const { default: router } = await import('@/router');
        const eager = router
            .getRoutes()
            .filter((route) => typeof route.components?.default !== 'function')
            .map((route) => route.name);
        expect(eager).toEqual(['home']);
    }, 30_000);
});
