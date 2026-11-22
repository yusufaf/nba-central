import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref, type Component } from 'vue';

const mocks = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ track: mocks.track }));

import { LOAD_TIMEOUT_MS, lazyScene } from '@/components/scene3d/lazyScene';
import Scene3DUnavailable from '@/components/scene3d/Scene3DUnavailable.vue';

const Loaded = defineComponent({ name: 'Loaded', setup: () => () => h('p', { 'data-testid': 'loaded' }, 'loaded') });
const Loading = defineComponent({ name: 'Loading', setup: () => () => h('p', { 'data-testid': 'loading' }, 'loading') });

const deferred = () => {
    let resolve!: (value: Component) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<Component>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

// The async scene behind a toggle, as PublicTeam and the dialogs mount it.
let wrapper: VueWrapper | null = null;
const mountToggle = (scene: Component) => {
    const shown = ref(true);
    wrapper = mount(defineComponent({ setup: () => () => (shown.value ? h(scene) : null) }));
    return {
        wrapper,
        toggle: async (on: boolean) => {
            shown.value = on;
            await nextTick();
        },
    };
};
const loadTracks = () => mocks.track.mock.calls.filter(([name]) => name === 'scene3d_failed');

describe('lazyScene (#300)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mocks.track.mockReset();
    });
    afterEach(() => {
        wrapper?.unmount();
        wrapper = null;
        vi.useRealTimers();
    });

    it('shows the loading component while the chunk downloads', async () => {
        const pending = deferred();
        const scene = lazyScene(() => pending.promise, { name: 'Failed', loading: Loading });
        const { wrapper: w } = mountToggle(scene);
        await nextTick();
        expect(w.find('[data-testid="loading"]').exists()).toBe(true);
        pending.resolve(Loaded);
        await flushPromises();
        expect(w.find('[data-testid="loaded"]').exists()).toBe(true);
    });

    it('tracks a timed-out load as scene3d_failed load and shows the note', async () => {
        const scene = lazyScene(() => deferred().promise, { name: 'Failed' });
        const { wrapper: w } = mountToggle(scene);
        vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
        await flushPromises();
        expect(loadTracks()).toEqual([['scene3d_failed', { reason: 'load' }]]);
        expect(w.findComponent(Scene3DUnavailable).props('reason')).toBe('load');
    });

    it('a rejected load is tracked with its tags', async () => {
        const scene = lazyScene(() => Promise.reject(new Error('chunk gone')), { name: 'Failed', tags: { page: 'creator' } });
        const { wrapper: w } = mountToggle(scene);
        await flushPromises();
        expect(loadTracks()).toEqual([['scene3d_failed', { reason: 'load', page: 'creator' }]]);
        expect(w.findComponent(Scene3DUnavailable).exists()).toBe(true);
    });

    it('closing during a slow load tracks nothing', async () => {
        const scene = lazyScene(() => deferred().promise, { name: 'Failed' });
        const { toggle } = mountToggle(scene);
        vi.advanceTimersByTime(5000);
        await toggle(false);
        vi.advanceTimersByTime(30000);
        await flushPromises();
        expect(mocks.track).not.toHaveBeenCalled();
    });

    it('a reopen during a slow load gets its own full timeout', async () => {
        const scene = lazyScene(() => deferred().promise, { name: 'Failed', loading: Loading });
        const { wrapper: w, toggle } = mountToggle(scene);
        vi.advanceTimersByTime(15000);
        await toggle(false);
        await toggle(true);
        vi.advanceTimersByTime(10000);
        await flushPromises();
        expect(mocks.track).not.toHaveBeenCalled();
        expect(w.find('[data-testid="loading"]').exists()).toBe(true);
        vi.advanceTimersByTime(10000);
        await flushPromises();
        expect(loadTracks()).toHaveLength(1);
    });

    it('toggling again after a timeout retries the load', async () => {
        let attempt = deferred();
        const load = vi.fn(() => attempt.promise);
        const scene = lazyScene(load, { name: 'Failed' });
        const { wrapper: w, toggle } = mountToggle(scene);
        vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
        await flushPromises();
        await toggle(false);
        attempt = deferred();
        await toggle(true);
        attempt.resolve(Loaded);
        await flushPromises();
        expect(load).toHaveBeenCalledTimes(2);
        expect(w.find('[data-testid="loaded"]').exists()).toBe(true);
    });

    it('toggling again after a rejection retries the load', async () => {
        const load = vi
            .fn<() => Promise<Component>>()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce(Loaded);
        const scene = lazyScene(load, { name: 'Failed' });
        const { wrapper: w, toggle } = mountToggle(scene);
        await flushPromises();
        expect(w.findComponent(Scene3DUnavailable).exists()).toBe(true);
        await toggle(false);
        await toggle(true);
        await flushPromises();
        expect(load).toHaveBeenCalledTimes(2);
        expect(w.find('[data-testid="loaded"]').exists()).toBe(true);
    });
});
