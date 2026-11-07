import { describe, expect, it } from 'vitest';
import { buildBowl, bowlLayout, type Deck } from '@/three/arena/bowl';

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
});

describe('buildBowl', () => {
    it('stays in budget', () => {
        const mesh = buildBowl(bowlLayout(30000), '#0f5257');
        expect(mesh.geometry.getAttribute('position').count / 3).toBeLessThanOrEqual(40000);
    });
});
