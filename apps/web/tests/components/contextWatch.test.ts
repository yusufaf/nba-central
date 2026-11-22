import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';

const mocks = vi.hoisted(() => ({
    lost: false,
    listener: null as ((lost: boolean) => void) | null,
    unsubscribe: vi.fn(),
    track: vi.fn(),
}));
vi.mock('@/three/renderer/shared', () => ({
    isContextLost: () => mocks.lost,
    onContextChange: (listener: (lost: boolean) => void) => {
        mocks.listener = listener;
        return mocks.unsubscribe;
    },
}));
vi.mock('@/lib/analytics', () => ({ track: mocks.track }));

import { RESTORE_TIMEOUT_MS, useContextWatch } from '@/components/scene3d/contextWatch';

let visibility: DocumentVisibilityState = 'visible';
const setVisibility = (state: DocumentVisibilityState) => {
    visibility = state;
    document.dispatchEvent(new Event('visibilitychange'));
};

const watchIn = () => {
    const scope = effectScope();
    const onRestored = vi.fn();
    const onGone = vi.fn();
    const watch = scope.run(() => useContextWatch({ tags: () => ({ page: 'test' }), onRestored, onGone }))!;
    watch.start();
    return { ...watch, scope, onRestored, onGone };
};
const failures = () => mocks.track.mock.calls.filter(([name]) => name === 'scene3d_failed');

describe('useContextWatch (#300)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mocks.lost = false;
        mocks.listener = null;
        mocks.unsubscribe.mockReset();
        mocks.track.mockReset();
        visibility = 'visible';
        vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('starts paused when the context is already lost', () => {
        mocks.lost = true;
        const { paused, scope } = watchIn();
        expect(paused.value).toBe(true);
        expect(mocks.track).toHaveBeenCalledWith('scene3d_context_lost', { page: 'test' });
        expect(failures()).toEqual([]);
        scope.stop();
    });

    it('a loss that comes back in time pauses and resumes without a failure', () => {
        const { paused, onRestored, scope } = watchIn();
        mocks.listener!(true);
        expect(paused.value).toBe(true);
        vi.advanceTimersByTime(RESTORE_TIMEOUT_MS - 1);
        mocks.listener!(false);
        expect(paused.value).toBe(false);
        expect(onRestored).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(RESTORE_TIMEOUT_MS);
        expect(failures()).toEqual([]);
        scope.stop();
    });

    it('a context that never comes back gives up after the timeout', () => {
        const { paused, gone, onGone, scope } = watchIn();
        mocks.listener!(true);
        vi.advanceTimersByTime(RESTORE_TIMEOUT_MS);
        expect(gone.value).toBe(true);
        expect(paused.value).toBe(false);
        expect(failures()).toEqual([['scene3d_failed', { page: 'test', reason: 'context-lost' }]]);
        expect(onGone).toHaveBeenCalledTimes(1);
        expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
        scope.stop();
    });

    it("a hidden tab doesn't count toward the timeout", () => {
        visibility = 'hidden';
        const { gone, scope } = watchIn();
        mocks.listener!(true);
        vi.advanceTimersByTime(RESTORE_TIMEOUT_MS * 2);
        expect(gone.value).toBe(false);
        setVisibility('visible');
        vi.advanceTimersByTime(RESTORE_TIMEOUT_MS);
        expect(gone.value).toBe(true);
        scope.stop();
    });

    it('going hidden again restarts the full timeout', () => {
        const { gone, scope } = watchIn();
        mocks.listener!(true);
        vi.advanceTimersByTime(9000);
        setVisibility('hidden');
        setVisibility('visible');
        vi.advanceTimersByTime(9000);
        expect(gone.value).toBe(false);
        vi.advanceTimersByTime(RESTORE_TIMEOUT_MS - 9000);
        expect(gone.value).toBe(true);
        scope.stop();
    });

    it('a second loss event while paused tracks once', () => {
        const { scope } = watchIn();
        mocks.listener!(true);
        mocks.listener!(true);
        expect(mocks.track.mock.calls.filter(([name]) => name === 'scene3d_context_lost')).toHaveLength(1);
        scope.stop();
    });

    it('disposing the scope stops the timer and unsubscribes', () => {
        const { gone, onGone, scope } = watchIn();
        mocks.listener!(true);
        scope.stop();
        expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(RESTORE_TIMEOUT_MS * 2);
        expect(gone.value).toBe(false);
        expect(onGone).not.toHaveBeenCalled();
        setVisibility('visible');
        vi.advanceTimersByTime(RESTORE_TIMEOUT_MS * 2);
        expect(onGone).not.toHaveBeenCalled();
    });
});
