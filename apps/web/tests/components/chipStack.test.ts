import { describe, expect, it } from 'vitest';
import { CHIP_GAP_PX, stackChips, type ChipSize } from '@/components/scene3d/chipStack';

const SIZE: ChipSize = { width: 80, height: 20 };
const sized = (...ids: string[]) => new Map(ids.map((id) => [id, SIZE]));
const chip = (id: string, x: number, y: number, depth: number) => ({ id, x, y, depth });

describe('stackChips', () => {
    it('leaves chips that are apart where they are', () => {
        const chips = [chip('a', 100, 100, 0.5), chip('b', 300, 100, 0.6)];
        expect(stackChips(chips, sized('a', 'b'))).toEqual(chips);
    });

    it('lifts a farther chip above the nearer one it would cover', () => {
        const near = chip('near', 100, 100, 0.5);
        const far = chip('far', 110, 96, 0.6);
        const [placedNear, placedFar] = stackChips([near, far], sized('near', 'far'));
        expect(placedNear).toEqual(near);
        expect(placedFar.y).toBe(near.y - SIZE.height - CHIP_GAP_PX);
        expect(placedFar.x).toBe(far.x);
    });

    it('lifts the farthest of three clear of both', () => {
        const [c, a, b] = stackChips(
            [chip('c', 104, 100, 0.7), chip('a', 100, 100, 0.5), chip('b', 102, 100, 0.6)],
            sized('a', 'b', 'c'),
        );
        expect(a.y).toBe(100);
        expect(b.y).toBe(100 - 22);
        expect(c.y).toBe(100 - 44);
    });

    it('leaves chips side by side that overlap only in height', () => {
        const chips = [chip('a', 100, 100, 0.5), chip('b', 181, 95, 0.6)];
        expect(stackChips(chips, sized('a', 'b'))).toEqual(chips);
    });

    it('leaves an unmeasured chip where it is', () => {
        const chips = [chip('a', 100, 100, 0.5), chip('b', 110, 96, 0.6)];
        expect(stackChips(chips, sized('a'))).toEqual(chips);
    });

    it('stops a lifted chip at the top of the view rather than lift it out', () => {
        const near = chip('near', 100, 30, 0.5);
        const far = chip('far', 110, 26, 0.6);
        // Lifting clear would need y 8 (top -12): it stops with its top at 0.
        expect(stackChips([near, far], sized('near', 'far'))[1].y).toBe(SIZE.height);
        expect(stackChips([near, far], sized('near', 'far'), CHIP_GAP_PX, -100)[1].y).toBe(30 - 22);
    });

    it('leaves a chip already above the top where it is', () => {
        const near = chip('near', 100, 12, 0.5);
        const far = chip('far', 110, 10, 0.6);
        expect(stackChips([near, far], sized('near', 'far'))[1]).toEqual(far);
    });

    it('stacks a third chip above one stopped at the top only if it fits', () => {
        const [, middle, farthest] = stackChips(
            [chip('near', 100, 30, 0.5), chip('middle', 104, 28, 0.6), chip('far', 108, 26, 0.7)],
            sized('near', 'middle', 'far'),
        );
        expect(middle.y).toBe(SIZE.height);
        expect(farthest.y).toBe(SIZE.height);
    });

    it('returns the chips in the order they came in', () => {
        const chips = [chip('far', 110, 96, 0.6), chip('near', 100, 100, 0.5)];
        expect(stackChips(chips, sized('far', 'near')).map(({ id }) => id)).toEqual(['far', 'near']);
    });
});
