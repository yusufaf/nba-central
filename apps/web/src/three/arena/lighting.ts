import {
    DataTexture,
    DirectionalLight,
    Group,
    HemisphereLight,
    LinearFilter,
    RGBAFormat,
    SpotLight,
    UnsignedByteType,
} from 'three';
import type { VenueLighting } from '@/constants/venue';
import { COURT_DEPTH_M, COURT_LENGTH_M } from './court';
import { SCENE_COLOURS } from './palette';

// The arena's lighting (#298): broadcast (bright, even) or theater (a dark
// bowl with the floor in a spotlight), each with a tint. Both use the same
// three lights, so switching presets only changes values and never
// recompiles a shader. No shadow maps (too costly on phones).

type Vec3 = [number, number, number];

export interface LightingRig {
    hemisphere: { sky: string; ground: string; intensity: number };
    key: { color: string; intensity: number; position: Vec3 };
    // The spot's geometry is fixed: SPOT_HEIGHT, SPOT_ANGLE, SPOT_PENUMBRA and the pool cookie.
    spot: { color: string; intensity: number };
    // The scene's background and fog colour.
    background: string;
}

// Straight above centre court, aimed at the origin.
export const SPOT_HEIGHT = 26;
// Full strength out to 0.675 rad (20.8 m on the floor), past the pool's lit corners (19.5 m).
export const SPOT_ANGLE = 0.75;
// Above 0: GLSL's smoothstep is undefined when the cone and penumbra edges meet.
export const SPOT_PENUMBRA = 0.1;

// The pool covers the court plus this margin, then fades out over POOL_FADE_M.
const POOL_MARGIN_M = 1;
const POOL_FADE_M = 1.5;
const COOKIE_SIZE = 128;

// Broadcast keeps today's rig exactly with a white tint; the tint only takes
// this share of the sky light, since more turned the court grey-blue.
const BROADCAST_TINT_SHARE = 0.2;
const BROADCAST_GROUND = '#30261c';
const BROADCAST_FILL = 1.6;
const BROADCAST_KEY = 2.2;
// Theater: a dim tinted fill, a faint key so faces aren't black, and the
// spot, kept under broadcast's brightness on the floor.
const THEATER_GROUND = '#000000';
const THEATER_FILL = 0.6;
const THEATER_KEY = 0.3;
const THEATER_SPOT = 2.6;
// How far theater's background haze leans toward the tint.
const THEATER_HAZE_SHARE = 0.18;
const KEY_POSITION: Vec3 = [4, 20, 12];
const WHITE = '#ffffff';

const channels = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** A per-channel mix of two #rrggbb colours in sRGB, as measured; three's Color.lerp mixes in linear. */
export const mixHex = (from: string, to: string, t: number): string => {
    const a = channels(from);
    const b = channels(to);
    return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};

const smoothstep = (edge0: number, edge1: number, x: number): number => {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
};

/** The theater pool's strength on the floor (world metres, y = 0): 1 over the court plus a margin, fading to 0. */
export const poolFactor = (x: number, z: number): number => {
    const along = COURT_LENGTH_M / 2 + POOL_MARGIN_M;
    const across = COURT_DEPTH_M / 2 + POOL_MARGIN_M;
    return (
        (1 - smoothstep(along, along + POOL_FADE_M, Math.abs(x))) *
        (1 - smoothstep(across, across + POOL_FADE_M, Math.abs(z)))
    );
};

let cookie: DataTexture | null = null;

/**
 * The spot's cookie: it shapes the cone's circle into a rectangle over the
 * court, so the court is lit white to its corners while the seats beside it
 * stay dark. Shared by every scene and never disposed.
 */
export const poolCookie = (): DataTexture => {
    if (cookie) return cookie;
    const half = SPOT_HEIGHT * Math.tan(SPOT_ANGLE);
    const data = new Uint8Array(COOKIE_SIZE * COOKIE_SIZE * 4);
    for (let j = 0; j < COOKIE_SIZE; j++) {
        for (let i = 0; i < COOKIE_SIZE; i++) {
            const x = (((i + 0.5) / COOKIE_SIZE) * 2 - 1) * half;
            // v runs along world -z, since the spot's camera looks down with up (0, 0, -1).
            const z = -(((j + 0.5) / COOKIE_SIZE) * 2 - 1) * half;
            const value = Math.round(255 * poolFactor(x, z));
            data.set([value, value, value, 255], 4 * (j * COOKIE_SIZE + i));
        }
    }
    cookie = new DataTexture(data, COOKIE_SIZE, COOKIE_SIZE, RGBAFormat, UnsignedByteType);
    cookie.minFilter = LinearFilter;
    cookie.magFilter = LinearFilter;
    cookie.generateMipmaps = false;
    cookie.userData.shared = true;
    cookie.needsUpdate = true;
    return cookie;
};

export const lightingRig = ({ preset, tint }: VenueLighting): LightingRig =>
    preset === 'theater'
        ? {
              hemisphere: { sky: tint, ground: THEATER_GROUND, intensity: THEATER_FILL },
              key: { color: WHITE, intensity: THEATER_KEY, position: KEY_POSITION },
              spot: { color: WHITE, intensity: THEATER_SPOT },
              background: mixHex(SCENE_COLOURS.background, tint, THEATER_HAZE_SHARE),
          }
        : {
              hemisphere: {
                  sky: mixHex(WHITE, tint, BROADCAST_TINT_SHARE),
                  ground: BROADCAST_GROUND,
                  intensity: BROADCAST_FILL,
              },
              key: { color: WHITE, intensity: BROADCAST_KEY, position: KEY_POSITION },
              spot: { color: WHITE, intensity: 0 },
              background: SCENE_COLOURS.background,
          };

export const buildLighting = (rig: LightingRig): Group => {
    const group = new Group();
    group.name = 'lighting';
    const hemisphere = new HemisphereLight();
    hemisphere.name = 'hemisphere';
    const key = new DirectionalLight();
    key.name = 'key';
    const spot = new SpotLight(WHITE, 0, 0, SPOT_ANGLE, SPOT_PENUMBRA, 0);
    spot.name = 'spot';
    spot.position.set(0, SPOT_HEIGHT, 0);
    spot.target.position.set(0, 0, 0);
    // three r187 applies a spot's map without a shadow map (WebGLLights), though
    // its JSDoc says otherwise. The light looks straight down, so its camera
    // needs an up vector that isn't parallel to the view.
    spot.map = poolCookie();
    spot.shadow.camera.up.set(0, 0, -1);
    group.add(hemisphere, key, spot, spot.target);
    applyLighting(group, rig);
    return group;
};

/** Sets every rig value on a group from buildLighting, in place. */
export const applyLighting = (group: Group, rig: LightingRig): void => {
    const hemisphere = group.getObjectByName('hemisphere') as HemisphereLight;
    const key = group.getObjectByName('key') as DirectionalLight;
    const spot = group.getObjectByName('spot') as SpotLight;
    hemisphere.color.set(rig.hemisphere.sky);
    hemisphere.groundColor.set(rig.hemisphere.ground);
    hemisphere.intensity = rig.hemisphere.intensity;
    key.color.set(rig.key.color);
    key.intensity = rig.key.intensity;
    key.position.set(...rig.key.position);
    spot.color.set(rig.spot.color);
    spot.intensity = rig.spot.intensity;
};
