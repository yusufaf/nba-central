import { describe, expect, it } from 'vitest';
import { Group, Texture, Vector3 } from 'three';
import { bowlLayout } from '@/three/arena/bowl';
import {
    RIBBON_SPEED_M_S,
    RIBBON_TILE_M,
    buildRibbon,
    ribbonBand,
    ribbonDesign,
    ribbonTextureIn,
    scrollRibbon,
} from '@/three/arena/ribbon';

const RIBBON = { text: 'WELCOME', color: '#f59e0b' };

describe('ribbonDesign', () => {
    it('is null without a ribbon or with a malformed one', () => {
        expect(ribbonDesign(undefined)).toBeNull();
        expect(ribbonDesign({ version: 1 })).toBeNull();
        expect(ribbonDesign({ version: 1, ribbon: { text: 'HI', color: 'amber' } })).toBeNull();
        expect(ribbonDesign({ version: 1, ribbon: { text: null, color: '#ffffff' } } as never)).toBeNull();
    });

    it('cuts the text to 32 characters', () => {
        expect(ribbonDesign({ version: 1, ribbon: { text: 'x'.repeat(40), color: '#ffffff' } })?.text).toHaveLength(32);
    });
});

describe('ribbonBand', () => {
    it('sits on the wall above the last row with one deck', () => {
        const [lower] = bowlLayout(5000, false);
        const lowerTop = lower.startHeight + lower.rows * lower.rise;
        expect(ribbonBand([lower])).toEqual({
            offset: lower.startOffset + lower.rows * lower.tread,
            bottom: lowerTop + 0.3,
            top: lowerTop + 1.5,
        });
    });

    it('sits on the fascia between the decks with two', () => {
        const decks = bowlLayout(18000, true);
        const band = ribbonBand(decks);
        expect(band.offset).toBe(decks[1].startOffset);
        expect(band.top).toBeCloseTo(decks[1].startHeight - 0.3);
        expect(band.bottom).toBeCloseTo(decks[1].startHeight - 1.5);
        const lowerTop = decks[0].startHeight + decks[0].rows * decks[0].rise;
        expect(band.bottom).toBeGreaterThan(lowerTop);
    });
});

describe('buildRibbon', () => {
    const decks = bowlLayout(18000, true);
    const ribbon = buildRibbon(decks, RIBBON);
    const position = ribbon.geometry.getAttribute('position');
    const uv = ribbon.geometry.getAttribute('uv');

    it('is one mesh of 144 triangles, named ribbon', () => {
        expect(ribbon.name).toBe('ribbon');
        expect(position.count / 3).toBe(144);
    });

    it('faces the court on the far side, with u growing toward +x', () => {
        // The far side's middle (t = 3π/2) is the first triangle of segment 54.
        const i = 54 * 6;
        const [a, b, c] = [0, 1, 2].map((j) => new Vector3().fromBufferAttribute(position, i + j));
        expect(a.z).toBeLessThan(0);
        const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
        expect(normal.z).toBeGreaterThan(0.99);
        expect(b.x).toBeGreaterThan(a.x);
        expect(uv.getX(i + 1)).toBeGreaterThan(uv.getX(i));
    });

    it('ends on a whole number of tiles, with v = 1 along the top', () => {
        const last = uv.getX(position.count - 4);
        expect(Number.isInteger(Math.round(last * 1e6) / 1e6)).toBe(true);
        expect(last).toBeGreaterThanOrEqual(1);
        const band = ribbonBand(decks);
        for (let i = 0; i < position.count; i++) {
            expect(uv.getY(i)).toBe(Math.abs(position.getY(i) - band.top) < 1e-3 ? 1 : 0);
        }
    });

    it('is found by ribbonTextureIn', () => {
        const group = new Group();
        group.add(ribbon);
        expect(ribbonTextureIn(group)).toBe((ribbon.material as { map: Texture }).map);
        expect(ribbonTextureIn(new Group())).toBeNull();
        expect(ribbonTextureIn(null)).toBeNull();
    });
});

describe('scrollRibbon', () => {
    it('moves at the ribbon speed and wraps to [0, 1)', () => {
        const texture = new Texture();
        scrollRibbon(texture, 1);
        expect(texture.offset.x).toBeCloseTo(RIBBON_SPEED_M_S / RIBBON_TILE_M);
        scrollRibbon(texture, RIBBON_TILE_M / RIBBON_SPEED_M_S);
        expect(texture.offset.x).toBeCloseTo(RIBBON_SPEED_M_S / RIBBON_TILE_M);
        expect(texture.offset.x).toBeLessThan(1);
    });
});
