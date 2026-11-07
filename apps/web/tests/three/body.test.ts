import { describe, expect, it } from 'vitest';
import { POSITION_MEDIANS, STAFF_DEFAULT, bodySize, girthFor, snapshotSize } from '@/three/character/body';

describe('snapshotSize', () => {
    it('reads real snake_case and custom camelCase sizes alike', () => {
        expect(snapshotSize({ fullName: 'A', height_feet: 6, height_inches: 9, weight_pounds: 250 })).toEqual({
            heightInches: 81,
            weightPounds: 250,
        });
        expect(snapshotSize({ fullName: 'B', heightFeet: 6, heightInches: 9, weightPounds: 250 })).toEqual({
            heightInches: 81,
            weightPounds: 250,
        });
    });

    it('gives nulls when the snapshot has no size', () => {
        expect(snapshotSize({ fullName: 'C', height_feet: null, weight_pounds: null })).toEqual({
            heightInches: null,
            weightPounds: null,
        });
    });
});

describe('bodySize', () => {
    it('uses the position median when the size is missing', () => {
        expect(bodySize({ role: 'player', position: 'C', heightInches: null, weightPounds: null })).toEqual(POSITION_MEDIANS.C);
    });

    it('fills only the missing half from the median', () => {
        expect(bodySize({ role: 'player', position: 'PG', heightInches: 70, weightPounds: null })).toEqual({
            heightInches: 70,
            weightPounds: POSITION_MEDIANS.PG.weightPounds,
        });
    });

    it('treats an unknown position as a wing', () => {
        expect(bodySize({ role: 'player', position: 'G-F', heightInches: null, weightPounds: null })).toEqual(POSITION_MEDIANS.SF);
    });

    it('gives staff without data the default build', () => {
        expect(bodySize({ role: 'coach', heightInches: null, weightPounds: null })).toEqual(STAFF_DEFAULT);
        expect(bodySize({ role: 'gm', heightInches: null, weightPounds: null })).toEqual(STAFF_DEFAULT);
    });
});

describe('girthFor', () => {
    it('stays within its clamp for extreme bodies', () => {
        for (const size of [
            { heightInches: 90, weightPounds: 330 },
            { heightInches: 69, weightPounds: 160 },
            { heightInches: 70, weightPounds: 400 },
            { heightInches: 90, weightPounds: 150 },
        ]) {
            const girth = girthFor(size);
            expect(girth).toBeGreaterThanOrEqual(0.86);
            expect(girth).toBeLessThanOrEqual(1.3);
        }
    });

    it('is 1 at a BMI of 25', () => {
        expect(girthFor({ heightInches: 80, weightPounds: (25 * 80 * 80) / 703 })).toBeCloseTo(1, 6);
    });
});
