import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { SEAT_PATTERNS } from '@/constants/venue';
import { buildBowl, bowlLayout, type Deck } from '@/three/arena/bowl';
import { seatColouring } from '@/three/arena/seats';

const top = (deck: Deck) => deck.startHeight + deck.rows * deck.rise;
const outer = (deck: Deck) => deck.startOffset + deck.rows * deck.tread;

describe('bowlLayout', () => {
    it('null capacity uses the default', () => {
        const layout = bowlLayout(null);
        expect(layout).toEqual(bowlLayout(18000));
        expect(layout.map((deck) => deck.rows)).toEqual([18, 10]);
    });

    it('small arenas have one deck', () => {
        const layout = bowlLayout(5000);
        expect(layout).toHaveLength(1);
        expect(layout[0].rows).toBe(12);
    });

    it('huge arenas clamp', () => {
        expect(bowlLayout(30000).map((deck) => deck.rows)).toEqual([24, 16]);
    });

    it('the upper deck starts above and behind the lower', () => {
        const [lower, upper] = bowlLayout(20000);
        expect(upper.startHeight).toBeGreaterThan(top(lower));
        expect(upper.startOffset).toBeGreaterThan(outer(lower));
    });

    it("drops a big arena's upper deck when the venue turns it off", () => {
        expect(bowlLayout(30000, false).map((deck) => deck.rows)).toEqual([24]);
    });

    it("adds an upper deck to a small arena when the venue turns it on", () => {
        expect(bowlLayout(5000, true).map((deck) => deck.rows)).toEqual([12, 6]);
    });

    it('keeps the capacity rule when the venue says nothing', () => {
        expect(bowlLayout(20000, undefined)).toEqual(bowlLayout(20000));
    });
});

describe('buildBowl', () => {
    it('stays in budget', () => {
        const mesh = buildBowl(bowlLayout(30000), seatColouring(null));
        expect(mesh.geometry.getAttribute('position').count / 3).toBeLessThanOrEqual(40000);
    });

    // 40 rows x 72 segments x (riser + tread) x 2 triangles.
    it('draws the same triangles whatever the pattern', () => {
        for (const pattern of SEAT_PATTERNS) {
            const mesh = buildBowl(bowlLayout(30000, true), { primary: '#111111', secondary: '#eeeeee', pattern });
            expect(mesh.geometry.getAttribute('position').count / 3).toBe(11520);
        }
    });

    // Each segment of a row is 12 vertices: a riser quad, then a tread quad.
    const riserColours = (mesh: ReturnType<typeof buildBowl>) => {
        const colour = mesh.geometry.getAttribute('color');
        const risers: Color[] = [];
        for (let v = 0; v < colour.count; v += 12) risers.push(new Color(colour.getX(v), colour.getY(v), colour.getZ(v)));
        return risers;
    };

    it("colours every riser in today's seat colour without a venue", () => {
        // The attribute is float32, so compare as hex.
        for (const riser of riserColours(buildBowl(bowlLayout(18000), seatColouring(null)))) {
            expect(riser.getHexString()).toBe('2a3140');
        }
    });

    it('alternates sections around the bowl', () => {
        const risers = riserColours(buildBowl(bowlLayout(18000), { primary: '#111111', secondary: '#eeeeee', pattern: 'sections' }));
        expect(risers[0].equals(risers[6])).toBe(false);
        expect(risers[0].equals(risers[12])).toBe(true);
    });
});
