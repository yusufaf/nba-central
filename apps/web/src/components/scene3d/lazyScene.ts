import { defineAsyncComponent, defineComponent, h, type AsyncComponentLoader, type Component } from 'vue';
import { track } from '@/lib/analytics';
import Scene3DUnavailable from './Scene3DUnavailable.vue';

export const LOAD_TIMEOUT_MS = 20_000;

// A lazily loaded 3D surface. A failed or timed-out load shows a note instead
// of breaking the page, and is tracked from the note itself: only a scene
// still on screen counts, so closing 3D during a slow load isn't a failure.
// Both kinds of failure clear Vue's cached request, so opening again retries.
export const lazyScene = <T extends Component>(
    load: AsyncComponentLoader<T>,
    options: { name: string; tags?: Record<string, unknown>; loading?: Component },
): T =>
    defineAsyncComponent<T>({
        loader: load,
        errorComponent: defineComponent({
            name: options.name,
            setup() {
                track('scene3d_failed', { reason: 'load', ...options.tags });
                return () => h(Scene3DUnavailable, { reason: 'load' });
            },
        }),
        loadingComponent: options.loading,
        delay: 0,
        timeout: LOAD_TIMEOUT_MS,
    });
