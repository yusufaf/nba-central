import { defineAsyncComponent, defineComponent, h } from 'vue';
import { track } from '@/lib/analytics';
import Scene3DUnavailable from './Scene3DUnavailable.vue';
import type { TeamPhotoInput } from './teamPhotoInput';

// The only way into the 3D scene: three.js and the scene code load on first
// use, in their own chunk. A failed load (offline, or a deploy that removed
// the old chunk) shows a note instead of breaking the page.
export const TeamScene3DAsync = defineAsyncComponent({
    loader: () =>
        import('./TeamScene3D.vue').catch((error: unknown) => {
            track('scene3d_failed', { reason: 'load' });
            throw error;
        }),
    errorComponent: defineComponent({ name: 'Scene3DLoadFailed', setup: () => () => h(Scene3DUnavailable, { reason: 'load' }) }),
    timeout: 20000,
});

export { Scene3DUnavailable };

// The share card's 3D team photo (a PNG data URL), loaded the same lazy way.
export const renderTeamPhoto = (input: TeamPhotoInput): Promise<string> =>
    import('./teamPhoto').then((module) => module.renderTeamPhoto(input));
