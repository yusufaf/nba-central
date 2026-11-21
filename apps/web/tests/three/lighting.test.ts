import { describe, expect, it } from 'vitest';
import { Color, DirectionalLight, HemisphereLight, SpotLight, Vector3 } from 'three';
import type { VenueLighting } from '@/constants/venue';
import { COURT_DEPTH_M, COURT_LENGTH_M } from '@/three/arena/court';
import {
    SPOT_ANGLE,
    SPOT_HEIGHT,
    SPOT_PENUMBRA,
    applyLighting,
    buildLighting,
    lightingRig,
    mixHex,
    poolCookie,
    poolFactor,
    type LightingRig,
} from '@/three/arena/lighting';
import { DEFAULT_LIGHTING, LIGHT_SWATCHES } from '@/utils/venue';

// Half-lengths: the court end is x = L, the sideline z = D, and the bowl's
// first riser starts 3.5 m beyond them.
const L = COURT_LENGTH_M / 2;
const D = COURT_DEPTH_M / 2;
const UP: [number, number, number] = [0, 1, 0];

const smoothstep = (edge0: number, edge1: number, x: number): number => {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
};

// What a surface at `point` facing `normal` receives, per three's shading
// model: the hemisphere by the normal's tilt, the key by n·L, the spot by n·L,
// its cone and the cookie projected from its height.
const irradiance = (rig: LightingRig, point: [number, number, number], normal: [number, number, number]): Color => {
    const n = new Vector3(...normal).normalize();
    const p = new Vector3(...point);
    const out = new Color(rig.hemisphere.ground)
        .lerp(new Color(rig.hemisphere.sky), 0.5 * n.y + 0.5)
        .multiplyScalar(rig.hemisphere.intensity);
    const toKey = new Vector3(...rig.key.position).normalize();
    out.add(new Color(rig.key.color).multiplyScalar(Math.max(0, n.dot(toKey)) * rig.key.intensity));
    const toSpot = new Vector3(0, SPOT_HEIGHT, 0).sub(p).normalize();
    // The angle off the spot's axis, which points straight down.
    const cosTheta = toSpot.y;
    const cone = smoothstep(Math.cos(SPOT_ANGLE), Math.cos(SPOT_ANGLE * (1 - SPOT_PENUMBRA)), cosTheta);
    const k = SPOT_HEIGHT / (SPOT_HEIGHT - p.y);
    const spot = Math.max(0, n.dot(toSpot)) * rig.spot.intensity * cone * poolFactor(p.x * k, p.z * k);
    out.add(new Color(rig.spot.color).multiplyScalar(spot));
    return out;
};

const luminance = (c: Color): number => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const saturation = (c: Color): number => {
    const max = Math.max(c.r, c.g, c.b);
    return (max - Math.min(c.r, c.g, c.b)) / max;
};

const broadcast = (tint: string): VenueLighting => ({ preset: 'broadcast', tint });
const theater = (tint: string): VenueLighting => ({ preset: 'theater', tint });

describe('mixHex', () => {
    it('mixes per channel in sRGB', () => {
        expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
        expect(mixHex('#ffffff', '#ef4444', 0)).toBe('#ffffff');
        expect(mixHex('#ffffff', '#ef4444', 1)).toBe('#ef4444');
    });
});

describe('lightingRig', () => {
    it("is today's broadcast rig exactly for standard lighting", () => {
        expect(lightingRig(DEFAULT_LIGHTING)).toEqual({
            hemisphere: { sky: '#ffffff', ground: '#30261c', intensity: 1.6 },
            key: { color: '#ffffff', intensity: 2.2, position: [4, 20, 12] },
            spot: { color: '#ffffff', intensity: 0 },
            background: '#0b0d11',
        });
    });

    it('keeps the key and spot white in theater, whatever the tint', () => {
        for (const { value } of LIGHT_SWATCHES) {
            const rig = lightingRig(theater(value));
            expect(rig.key.color).toBe('#ffffff');
            expect(rig.spot.color).toBe('#ffffff');
            expect(rig.hemisphere.sky).toBe(value);
        }
    });
});

describe('poolFactor', () => {
    it('is full over the court and gone 2.5 m outside each line', () => {
        expect(poolFactor(0, 0)).toBe(1);
        expect(poolFactor(L, D)).toBe(1);
        expect(poolFactor(0, D + 2.5)).toBe(0);
        expect(poolFactor(L + 2.5, 0)).toBe(0);
        const halfway = poolFactor(L + 1.75, 0);
        expect(halfway).toBeGreaterThan(0);
        expect(halfway).toBeLessThan(1);
    });
});

describe('poolCookie', () => {
    it('is one shared 128 x 128 texture', () => {
        const cookie = poolCookie();
        expect(poolCookie()).toBe(cookie);
        expect(cookie.image.width).toBe(128);
        expect(cookie.image.height).toBe(128);
        expect(cookie.userData.shared).toBe(true);
    });

    it('maps texels to floor metres', () => {
        const { data } = poolCookie().image as { data: Uint8Array };
        const texel = (i: number, j: number) => data[4 * (j * 128 + i)];
        expect(texel(64, 64)).toBe(255);
        expect(texel(0, 0)).toBe(0);
        const half = SPOT_HEIGHT * Math.tan(SPOT_ANGLE);
        const atEnd = Math.floor(((L / half + 1) / 2) * 128);
        expect(texel(atEnd, 64)).toBe(255);
    });
});

describe('the lighting invariants', () => {
    const white = luminance(irradiance(lightingRig(broadcast('#ffffff')), [0, 0, 0], UP));

    it.for(LIGHT_SWATCHES.map((swatch) => [swatch.label, swatch.value]))('hold for a %s tint', ([, tint]) => {
        const lit = lightingRig(broadcast(tint));
        const dark = lightingRig(theater(tint));
        const centre = irradiance(dark, [0, 0, 0], UP);
        // Theater's floor is never brighter than broadcast's.
        expect(luminance(centre)).toBeLessThanOrEqual(luminance(irradiance(lit, [0, 0, 0], UP)));
        // The whole court is lit: the end and corner nearly as bright as centre court.
        for (const point of [
            [L, 0, 0],
            [L, 0, D],
        ] as [number, number, number][]) {
            expect(luminance(irradiance(dark, point, UP))).toBeGreaterThanOrEqual(0.8 * luminance(centre));
        }
        // ...and in white: only the fill's even cast remains.
        for (const point of [
            [0, 0, 0],
            [L, 0, 0],
            [L, 0, D],
        ] as [number, number, number][]) {
            expect(saturation(irradiance(dark, point, UP))).toBeLessThanOrEqual(0.2);
        }
        // The bowl stays dark: the front rows and the risers further up.
        for (const [point, normal] of [
            [[0, 0.21, -(D + 3.5)], [0, 0, 1]],
            [[-(L + 3.5), 0.21, 0], [1, 0, 0]],
            [[0, 5, -20], [0, 0, 1]],
        ] as [number, number, number][][]) {
            expect(luminance(irradiance(dark, point, normal))).toBeLessThanOrEqual(
                0.35 * luminance(irradiance(lit, point, normal)),
            );
        }
        // Broadcast's tint stays a mild cast.
        expect(luminance(irradiance(lit, [0, 0, 0], UP))).toBeGreaterThanOrEqual(0.88 * white);
    });
});

describe('buildLighting and applyLighting', () => {
    const values = (group: ReturnType<typeof buildLighting>) => {
        const hemisphere = group.getObjectByName('hemisphere') as HemisphereLight;
        const key = group.getObjectByName('key') as DirectionalLight;
        const spot = group.getObjectByName('spot') as SpotLight;
        return {
            sky: hemisphere.color.getHexString(),
            ground: hemisphere.groundColor.getHexString(),
            fill: hemisphere.intensity,
            keyColour: key.color.getHexString(),
            key: key.intensity,
            keyAt: key.position.toArray(),
            spotColour: spot.color.getHexString(),
            spot: spot.intensity,
        };
    };

    it('builds the same three lights and cookie for both presets', () => {
        for (const lighting of [DEFAULT_LIGHTING, theater('#a855f7')]) {
            const group = buildLighting(lightingRig(lighting));
            expect(group.name).toBe('lighting');
            expect(group.children.filter((c) => c instanceof HemisphereLight)).toHaveLength(1);
            expect(group.children.filter((c) => c instanceof DirectionalLight)).toHaveLength(1);
            const spots = group.children.filter((c): c is SpotLight => c instanceof SpotLight);
            expect(spots).toHaveLength(1);
            const [spot] = spots;
            expect(spot.map).toBe(poolCookie());
            expect(spot.castShadow).toBe(false);
            expect(spot.angle).toBe(SPOT_ANGLE);
            expect(spot.penumbra).toBe(SPOT_PENUMBRA);
            expect(SPOT_PENUMBRA).toBeGreaterThan(0);
            expect(spot.decay).toBe(0);
            expect(spot.shadow.camera.up.toArray()).toEqual([0, 0, -1]);
        }
    });

    it('switches every value in place, both ways', () => {
        const lit = lightingRig(DEFAULT_LIGHTING);
        const dark = lightingRig(theater('#a855f7'));
        const group = buildLighting(lit);
        const count = group.children.length;
        applyLighting(group, dark);
        expect(values(group)).toEqual(values(buildLighting(dark)));
        applyLighting(group, lit);
        expect(values(group)).toEqual(values(buildLighting(lit)));
        expect(group.children).toHaveLength(count);
    });
});
