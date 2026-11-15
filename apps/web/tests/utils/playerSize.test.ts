import { describe, expect, it } from 'vitest';
import { girthFor } from '@/three/character/body';
import { staffSize } from '@/utils/playerSize';

describe('staffSize', () => {
    it("uses the look's height at the body model's own build", () => {
        const size = staffSize({ build: { heightIn: 74 } });
        expect(size).toEqual({ heightInches: 74, weightPounds: 195 });
        expect(girthFor(size)).toBeCloseTo(1, 2);
    });
});
