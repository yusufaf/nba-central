import { describe, it, expect } from 'vitest';
import { nbaPositions, playsPosition } from '@/constants/positions';

describe('nbaPositions', () => {
    it("drops 2K's placeholders and keeps the order", () => {
        expect(nbaPositions(['SG', 'N'])).toEqual(['SG']);
        expect(nbaPositions(['PG', 'S'])).toEqual(['PG']);
        expect(nbaPositions(['C', 'PF'])).toEqual(['C', 'PF']);
    });
});

describe('playsPosition', () => {
    it("ignores 2K's placeholders, and falls back to Basketball-Reference when nothing real is left", () => {
        expect(playsPosition({ positions: ['PG', 'N'] }, 'PG')).toBe(true);
        expect(playsPosition({ positions: ['N'], position: 'G' }, 'SG')).toBe(true);
        expect(playsPosition({ positions: ['N'], position: 'G' }, 'C')).toBe(false);
    });
});
