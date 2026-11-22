import Scene3DLoading from './Scene3DLoading.vue';
import Scene3DUnavailable from './Scene3DUnavailable.vue';
import { lazyScene } from './lazyScene';
import type { TeamPhotoInput } from './teamPhotoInput';

// The only way into the 3D scene: three.js and the scene code load on first
// use, in their own chunk. A failed load (offline, or a deploy that removed
// the old chunk) shows a note instead of breaking the page. A placeholder
// holds the scene's space while it downloads.
export const TeamScene3DAsync = lazyScene(() => import('./TeamScene3D.vue'), {
    name: 'Scene3DLoadFailed',
    loading: Scene3DLoading,
});

// The player creator's preview, in the same lazy chunk. Its box is sized by
// the creator, so it needs no placeholder.
export const PersonPreview3DAsync = lazyScene(() => import('./PersonPreview3D.vue'), {
    name: 'PersonPreviewLoadFailed',
    tags: { page: 'creator' },
});

export { Scene3DUnavailable };

// The share card's 3D team photo (a PNG data URL), loaded the same lazy way.
export const renderTeamPhoto = (input: TeamPhotoInput): Promise<string> =>
    import('./teamPhoto').then((module) => module.renderTeamPhoto(input));
