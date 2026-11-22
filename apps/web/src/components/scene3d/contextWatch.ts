// A lost WebGL context (#300). Browsers drop contexts when a phone tab is
// backgrounded or the GPU resets, and usually give them back, so a loss
// pauses the scene. Only one that never comes back is a failure. Imports the
// shared renderer, so only the lazy scene components may import this file.
import { onScopeDispose, readonly, ref, type Ref } from 'vue';
import { track } from '@/lib/analytics';
import { isContextLost, onContextChange } from '@/three/renderer/shared';

// How long a lost context has, while its tab is on screen, to come back.
export const RESTORE_TIMEOUT_MS = 10_000;

export const useContextWatch = (options: {
    tags: () => Record<string, unknown>;
    onRestored: () => void;
    onGone: () => void;
}): { paused: Readonly<Ref<boolean>>; gone: Readonly<Ref<boolean>>; start: () => void } => {
    const paused = ref(false);
    const gone = ref(false);
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: (() => void) | null = null;

    const clearTimer = () => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
    };
    const stop = () => {
        clearTimer();
        unsubscribe?.();
        unsubscribe = null;
        document.removeEventListener('visibilitychange', arm);
    };
    const giveUp = () => {
        stop();
        paused.value = false;
        gone.value = true;
        track('scene3d_failed', { ...options.tags(), reason: 'context-lost' });
        options.onGone();
    };
    // A hidden tab's context can't come back, so only time on screen counts,
    // and each return to the tab starts the full wait again.
    function arm() {
        clearTimer();
        if (paused.value && document.visibilityState !== 'hidden') timer = setTimeout(giveUp, RESTORE_TIMEOUT_MS);
    }
    const lose = () => {
        if (paused.value) return;
        paused.value = true;
        track('scene3d_context_lost', options.tags());
        arm();
    };
    const restore = () => {
        if (!paused.value) return;
        paused.value = false;
        clearTimer();
        options.onRestored();
    };

    const start = () => {
        unsubscribe = onContextChange((lost) => (lost ? lose() : restore()));
        document.addEventListener('visibilitychange', arm);
        if (isContextLost()) lose();
    };
    onScopeDispose(stop);

    return { paused: readonly(paused), gone: readonly(gone), start };
};
