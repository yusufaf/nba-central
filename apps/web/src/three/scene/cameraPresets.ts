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

// Below this aspect seven people can't stand in one row and still fit the
// team-photo shot inside MAX_FRAMING_DISTANCE, so they stand in two. The
// layout (layout.ts, via TeamScene) and the framing here share it.
export const TWO_ROWS_BELOW_ASPECT = 1.4;

type Vec3 = [number, number, number];

const BASE: Record<CameraPreset, { position: Vec3; target: Vec3 }> = {
    team: { position: [0, 1.5, 9.5], target: [0, 1.1, 0] },
    courtside: { position: [7.5, 1.2, 6], target: [0, 1.2, 0] },
    broadcast: { position: [0, 10, 24], target: [0, 1, 0] },
    rafters: { position: [0.01, 30, 6], target: [0, 0, 0] },
};

// What the team-photo shot keeps in view, in metres around its target: one
// row of seven, or two rows when the view is narrower.
const TEAM_SUBJECT = {
    oneRow: { halfWidth: 4.9, halfHeight: 1.3 },
    twoRows: { halfWidth: 2.7, halfHeight: 1.5 },
};

export const framePreset = (
    preset: CameraPreset,
    aspect: number,
): { position: Vec3; target: Vec3; fov: number } => {
    const portrait = aspect < 1;
    const fov = portrait ? 50 : 40;
    const { position, target } = BASE[preset];
    if (preset !== 'team') return { position: [...position], target: [...target], fov };

    const subject = aspect < TWO_ROWS_BELOW_ASPECT ? TEAM_SUBJECT.twoRows : TEAM_SUBJECT.oneRow;
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

// The player creator's preview: one person, head to toe, with room above the
// head for raised hands (Celebrate reaches about 1.21 of their height) and
// below the feet for the shadow.
const PERSON_FOV = 30;
const PERSON_TOP = 1.3;
const PERSON_BOTTOM = -0.05;
const PERSON_SPAN = 1.45; // the 1.35 above plus a margin
// Narrower than this, the width (arms out) sets the distance.
const PERSON_MIN_ASPECT = 0.75;

export const PREVIEW_ORBIT = {
    minDistance: 1.2,
    maxDistance: 12,
    minPolarAngle: Math.PI * 0.2,
    maxPolarAngle: Math.PI * 0.55,
    enablePan: false,
};

export const framePerson = (heightMetres: number, aspect: number): { position: Vec3; target: Vec3; fov: number } => {
    const h = heightMetres;
    const centre = ((PERSON_TOP + PERSON_BOTTOM) / 2) * h;
    let distance = (PERSON_SPAN * h) / 2 / Math.tan((PERSON_FOV * Math.PI) / 360);
    if (aspect < PERSON_MIN_ASPECT) distance /= aspect / PERSON_MIN_ASPECT;
    return { position: [0, centre + 0.025 * h, distance], target: [0, centre, 0], fov: PERSON_FOV };
};
