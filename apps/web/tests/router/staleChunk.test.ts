import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import {
    isChunkLoadError,
    reloadOnStaleChunk,
    STALE_RELOAD_KEY,
    type StaleChunkDeps,
} from '@/router/staleChunk';

const staleChunk = new TypeError('Failed to fetch dynamically imported module: /assets/X-old.js');
const boom = new Error('boom');

const makeRouter = () =>
    createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: {} },
            { path: '/y', component: {} },
            { path: '/x', component: () => Promise.reject(staleChunk) },
            { path: '/boom', component: () => Promise.reject(boom) },
        ],
    });

const makeDeps = (overrides: Partial<StaleChunkDeps> = {}) => {
    const store = new Map<string, string>();
    const storage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
    };
    const deps = {
        getStorage: () => storage,
        reload: vi.fn<(href: string) => void>(),
        isOnline: () => true,
        ...overrides,
    };
    return { deps, store };
};

describe('isChunkLoadError', () => {
    it.each([
        'Failed to fetch dynamically imported module: https://nba.yusufaf.dev/assets/Scores-a.js',
        'error loading dynamically imported module: https://nba.yusufaf.dev/assets/Scores-a.js',
        'Importing a module script failed.',
        'Unable to preload CSS for /assets/Scores-a.css',
    ])('recognises %s', (message) => {
        expect(isChunkLoadError(new TypeError(message))).toBe(true);
    });

    it('ignores other errors and non-errors', () => {
        expect(isChunkLoadError(boom)).toBe(false);
        expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
        expect(isChunkLoadError(undefined)).toBe(false);
    });
});

describe('reloadOnStaleChunk', () => {
    let router: Router;
    let logged: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        router = makeRouter();
        logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => logged.mockRestore());

    it('reloads onto the page that failed to load, and marks that it did', async () => {
        const { deps, store } = makeDeps();
        reloadOnStaleChunk(router, deps);
        await router.push('/x').catch(() => {});
        expect(deps.reload).toHaveBeenCalledExactlyOnceWith('/x');
        expect(store.has(STALE_RELOAD_KEY)).toBe(true);
    });

    it('logs instead of reloading again when the reload brought no working page', async () => {
        const { deps, store } = makeDeps();
        store.set(STALE_RELOAD_KEY, '1');
        reloadOnStaleChunk(router, deps);
        await router.push('/x').catch(() => {});
        expect(deps.reload).not.toHaveBeenCalled();
        expect(logged).toHaveBeenCalledWith(staleChunk);
    });

    it('reloads again once a navigation has worked since the last reload', async () => {
        const { deps, store } = makeDeps();
        reloadOnStaleChunk(router, deps);
        await router.push('/x').catch(() => {});
        await router.push('/y');
        expect(store.has(STALE_RELOAD_KEY)).toBe(false);
        await router.push('/x').catch(() => {});
        expect(deps.reload).toHaveBeenCalledTimes(2);
    });

    it('logs any other navigation error without reloading', async () => {
        const { deps } = makeDeps();
        reloadOnStaleChunk(router, deps);
        await router.push('/boom').catch(() => {});
        expect(deps.reload).not.toHaveBeenCalled();
        expect(logged).toHaveBeenCalledWith(boom);
    });

    it("doesn't reload when storage is blocked, since nothing could stop a loop", async () => {
        const { deps } = makeDeps({
            getStorage: () => {
                throw new DOMException('blocked', 'SecurityError');
            },
        });
        expect(() => reloadOnStaleChunk(router, deps)).not.toThrow();
        await router.push('/x').catch(() => {});
        expect(deps.reload).not.toHaveBeenCalled();
        expect(logged).toHaveBeenCalledWith(staleChunk);
        await expect(router.push('/y')).resolves.toBeUndefined();
    });

    it("doesn't reload offline, where a reload would only show the browser's error page", async () => {
        const { deps } = makeDeps({ isOnline: () => false });
        reloadOnStaleChunk(router, deps);
        await router.push('/x').catch(() => {});
        expect(deps.reload).not.toHaveBeenCalled();
        expect(logged).toHaveBeenCalledWith(staleChunk);
    });
});
