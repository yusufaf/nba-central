import { describe, expect, it } from 'vitest';
import { layoutPeople } from '@/three/scene/layout';

describe('layoutPeople', () => {
    it('puts seven in one centred row on a landscape screen', () => {
        const spots = layoutPeople(7, false);
        expect(spots).toHaveLength(7);
        expect(spots[0].x).toBeCloseTo(-4.05, 6);
        expect(spots[6].x).toBeCloseTo(4.05, 6);
        expect(spots.reduce((sum, s) => sum + s.x, 0)).toBeCloseTo(0, 6);
    });

    it('puts seven in rows of 4 and 3 on a portrait screen', () => {
        const spots = layoutPeople(7, true);
        expect(spots.filter((s) => s.z === 0.9)).toHaveLength(4);
        expect(spots.filter((s) => s.z === -0.7)).toHaveLength(3);
    });

    it('keeps three in one row on a portrait screen', () => {
        expect(new Set(layoutPeople(3, true).map((s) => Math.abs(s.z) > 0.5))).toEqual(new Set([false]));
    });

    it('gives nobody an empty layout', () => {
        expect(layoutPeople(0, false)).toEqual([]);
    });
});
