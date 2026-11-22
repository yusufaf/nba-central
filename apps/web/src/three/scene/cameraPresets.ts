// Camera shots for the team scene. Pure maths, so it is tested without WebGL.

import type { CameraPreset } from '@/constants/cameraPresets';
import { BANNER_ROW } from '@/three/arena/banners';

export { CAMERA_PRESETS, PRESET_LABELS, type CameraPreset } from '@/constants/cameraPresets';

export const ORBIT_LIMITS = { minDistance: 1.5, maxDistance: 45, maxPolarAngle: Math.PI * 0.49 };

// Past this the camera would sit inside the lower bowl's first rows.
export const MAX_FRAMING_DISTANCE = 10.5;

// Below this aspect seven people can't stand in one row and still fit the
// team-photo shot inside MAX_FRAMING_DISTANCE, so they stand in two. The
// layout (layout.ts, via TeamScene) and the framing here share it.
export const TWO_ROWS_BELOW_ASPECT = 1.4;

type Vec3 = [number, number, number];

// The banners shot (#322) frames the biggest row any count makes (four 3.5 m
// banners, or the full span from five up), so it ignores the count. The row's
// bottom is above the scoreboard's top, so a camera rising from the row's
// middle never has the board in its sightline, and it stays inside the orbit
// controls' polar limit.
const BANNER_HALF_HEIGHT = (BANNER_ROW.maxWidth * BANNER_ROW.heightPerWidth) / 2;
const BANNER_CENTRE: Vec3 = [0, BANNER_ROW.top - BANNER_HALF_HEIGHT, BANNER_ROW.z];
const BANNER_SUBJECT = { halfWidth: BANNER_ROW.span / 2, halfHeight: BANNER_HALF_HEIGHT };
const BANNER_RISE = 0.1; // metres up per metre back
// Looking down at the row brings its top edge nearer than the fit assumes, so back off by that much.
const BANNER_TILT_SLACK = BANNER_HALF_HEIGHT * Math.sin(Math.atan(BANNER_RISE));

const BASE: Record<CameraPreset, { position: Vec3; target: Vec3 }> = {
    team: { position: [0, 1.5, 9.5], target: [0, 1.1, 0] },
    courtside: { position: [7.5, 1.2, 6], target: [0, 1.2, 0] },
    // For every scene, with or without a scoreboard (#296): a centre-hung board
    // hid the team from the old top-down rafters shot, and neither shot
    // reached the LED ribbon. Broadcast aims at y 6, not 4, so the rafters
    // banners (#297) clear the board's top. tests/three/venueVisibility.test.ts checks both.
    broadcast: { position: [0, 10, 24], target: [0, 6, 0] },
    rafters: { position: [0, 30, 30], target: [0, 6, -4] },
    banners: {
        position: [0, BANNER_CENTRE[1] + BANNER_RISE * 10, BANNER_CENTRE[2] + 10],
        target: BANNER_CENTRE,
    },
};

// What the team-photo shot keeps in view, in metres around its target: one
// row of seven, or two rows when the view is narrower.
const TEAM_SUBJECT = {
    oneRow: { halfWidth: 4.9, halfHeight: 1.3 },
    twoRows: { halfWidth: 2.7, halfHeight: 1.5 },
};

// How far back a camera has to be for the subject to fill the view, with a margin.
const fitDistance = (subject: { halfWidth: number; halfHeight: number }, aspect: number, fov: number): number => {
    const tanV = Math.tan((fov * Math.PI) / 360);
    return 1.08 * Math.max(subject.halfWidth / (tanV * aspect), subject.halfHeight / tanV);
};

// The base position moved along its line to the target, to that distance.
const alongBase = ({ position, target }: { position: Vec3; target: Vec3 }, distance: number): Vec3 => {
    const offset = position.map((p, i) => p - target[i]);
    const length = Math.hypot(...offset);
    return target.map((t, i) => t + (offset[i] / length) * distance) as Vec3;
};

export const framePreset = (
    preset: CameraPreset,
    aspect: number,
): { position: Vec3; target: Vec3; fov: number } => {
    const portrait = aspect < 1;
    const fov = portrait ? 50 : 40;
    const base = BASE[preset];
    const target: Vec3 = [...base.target];
    if (preset === 'team') {
        const subject = aspect < TWO_ROWS_BELOW_ASPECT ? TEAM_SUBJECT.twoRows : TEAM_SUBJECT.oneRow;
        const distance = Math.min(fitDistance(subject, aspect, fov), MAX_FRAMING_DISTANCE);
        return { position: alongBase(base, distance), target, fov };
    }
    if (preset === 'banners') {
        const fit = fitDistance(BANNER_SUBJECT, aspect, fov) + BANNER_TILT_SLACK;
        return { position: alongBase(base, Math.min(fit, ORBIT_LIMITS.maxDistance)), target, fov };
    }
    return { position: [...base.position], target, fov };
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
