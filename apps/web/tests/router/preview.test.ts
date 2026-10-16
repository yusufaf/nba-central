import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { Router } from 'vue-router';
import { SITE_ORIGIN } from '@/router/indexing';

vi.mock('@/views/Home.vue', () => ({ default: {} }));
vi.mock('@/utils/preview', () => ({ IS_PREVIEW: true }));
vi.mock('@logto/vue', async () => {
    const { ref } = await import('vue');
    return { useLogto: () => ({ isAuthenticated: ref(false), isLoading: ref(false) }) };
});

const robotsOf = () => document.querySelector('meta[name="robots"]')?.getAttribute('content');
const canonicalOf = () => document.querySelector('link[rel="canonical"]')?.getAttribute('href');

describe('router in a PR preview build', () => {
    let router: Router;
    beforeAll(async () => {
        ({ default: router } = await import('@/router'));
    });

    it('sends every way into sign-in to the sign-in-off page', async () => {
        for (const path of ['/login', '/sign-up', '/callback', '/settings']) {
            await router.push(path);
            expect(router.currentRoute.value.name, path).toBe('sign-in-off');
        }
    });

    it('leaves public pages alone', async () => {
        await router.push('/scores');
        expect(router.currentRoute.value.name).toBe('scores');
    });

    it("strips production's head tags on a first load of a team page, with no server to do it", async () => {
        vi.resetModules();
        const { default: fresh } = await import('@/router');
        document.head.innerHTML = `<link rel="canonical" href="${SITE_ORIGIN}/"><meta name="robots" content="noindex">`;
        await fresh.push('/t/abc');
        expect(canonicalOf()).toBeUndefined();
        expect(robotsOf()).toBe('noindex');
    });
});
