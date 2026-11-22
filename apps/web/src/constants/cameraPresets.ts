// The team scene's camera shots by name. Three-free, so the loading
// placeholder can lay out the same row of buttons before the 3D chunk lands.

export type CameraPreset = 'team' | 'courtside' | 'broadcast' | 'rafters' | 'banners';

export const CAMERA_PRESETS: readonly CameraPreset[] = ['team', 'courtside', 'broadcast', 'rafters', 'banners'];

export const PRESET_LABELS: Record<CameraPreset, string> = {
    team: 'Team photo',
    courtside: 'Courtside',
    broadcast: 'Broadcast',
    rafters: 'Rafters',
    banners: 'Banners',
};
