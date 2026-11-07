// Camera shots for the team scene. Pure maths, so it is tested without WebGL.

export type CameraPreset = 'team' | 'courtside' | 'broadcast' | 'rafters';

export const CAMERA_PRESETS: readonly CameraPreset[] = ['team', 'courtside', 'broadcast', 'rafters'];

export const PRESET_LABELS: Record<CameraPreset, string> = {
    team: 'Team photo',
    courtside: 'Courtside',
    broadcast: 'Broadcast',
    rafters: 'Rafters',
};

export const ORBIT_LIMITS = { minDistance: 1.5, maxDistance: 45, maxPolarAngle: Math.PI * 0.49 };

// Past this the camera would sit inside the lower bowl's first rows.
export const MAX_FRAMING_DISTANCE = 10.5;

type Vec3 = [number, number, number];

const BASE: Record<CameraPreset, { position: Vec3; target: Vec3 }> = {
    team: { position: [0, 1.5, 9.5], target: [0, 1.1, 0] },
    courtside: { position: [7.5, 1.2, 6], target: [0, 1.2, 0] },
    broadcast: { position: [0, 10, 24], target: [0, 1, 0] },
    rafters: { position: [0.01, 30, 6], target: [0, 0, 0] },
};

// What the team-photo shot keeps in view, in metres around its target. On a
// portrait screen the team stands in two rows, so the shot is narrower.
const TEAM_SUBJECT = {
    landscape: { halfWidth: 4.9, halfHeight: 1.3 },
    portrait: { halfWidth: 2.7, halfHeight: 1.5 },
};

export const framePreset = (
    preset: CameraPreset,
    aspect: number,
): { position: Vec3; target: Vec3; fov: number } => {
    const portrait = aspect < 1;
    const fov = portrait ? 50 : 40;
    const { position, target } = BASE[preset];
    if (preset !== 'team') return { position: [...position], target: [...target], fov };

    const subject = portrait ? TEAM_SUBJECT.portrait : TEAM_SUBJECT.landscape;
    const tanV = Math.tan((fov * Math.PI) / 360);
    const tanH = tanV * aspect;
    const fit = 1.08 * Math.max(subject.halfWidth / tanH, subject.halfHeight / tanV);
    const distance = Math.min(fit, MAX_FRAMING_DISTANCE);

    const offset = position.map((p, i) => p - target[i]);
    const length = Math.hypot(...offset);
    return {
        position: target.map((t, i) => t + (offset[i] / length) * distance) as Vec3,
        target: [...target],
        fov,
    };
};
