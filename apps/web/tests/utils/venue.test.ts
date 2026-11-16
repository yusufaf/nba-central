import { describe, expect, it } from 'vitest';
import { SEAT_PATTERNS } from '@/constants/venue';
import { SCENE_COLOURS } from '@/three/arena/palette';
import {
    DEFAULT_CAPACITY,
    SEAT_PATTERN_LABELS,
    SEAT_SWATCHES,
    SECONDARY_HINTS,
    defaultUpperDeck,
    newVenue,
    patternChip,
} from '@/utils/venue';

describe('venue values', () => {
    it("starts the seat swatches with today's seat colour", () => {
        expect(SEAT_SWATCHES[0].value).toBe(SCENE_COLOURS.seat);
    });

    it('keeps every swatch as lower-case #rrggbb', () => {
        for (const swatch of SEAT_SWATCHES) expect(swatch.value).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('labels and hints every pattern', () => {
        for (const pattern of SEAT_PATTERNS) {
            expect(SEAT_PATTERN_LABELS[pattern]).toBeTruthy();
            expect(SECONDARY_HINTS[pattern]).toBeTruthy();
        }
    });
});

describe('defaultUpperDeck', () => {
    it('adds an upper deck only above 12,000 seats, sizing a missing capacity as the default', () => {
        expect(DEFAULT_CAPACITY).toBe(18000);
        expect(defaultUpperDeck(null)).toBe(true);
        expect(defaultUpperDeck(5000)).toBe(false);
        expect(defaultUpperDeck(12000)).toBe(false);
        expect(defaultUpperDeck(12001)).toBe(true);
    });
});

describe('newVenue', () => {
    it("starts from today's solid slate seats, with the capacity's usual deck", () => {
        expect(newVenue(null)).toEqual({
            version: 1,
            seats: { primary: '#2a3140', secondary: '#b91c1c', pattern: 'solid' },
            upperDeck: true,
        });
        expect(newVenue(5000).upperDeck).toBe(false);
        expect(newVenue(12000).upperDeck).toBe(false);
        expect(newVenue(12001).upperDeck).toBe(true);
    });

    it('returns a fresh object each time', () => {
        expect(newVenue(null).seats).not.toBe(newVenue(null).seats);
    });
});

describe('patternChip', () => {
    const seats = { primary: '#111111', secondary: '#eeeeee' };

    it('draws each pattern from the two colours', () => {
        expect(patternChip('solid', seats)).toEqual({ background: '#111111' });
        expect(patternChip('sections', seats)).toEqual({ background: 'linear-gradient(90deg, #111111 50%, #eeeeee 50%)' });
        expect(patternChip('rows', seats)).toEqual({
            background: 'repeating-linear-gradient(180deg, #111111 0 25%, #eeeeee 25% 50%)',
        });
        expect(patternChip('gradient', seats)).toEqual({ background: 'linear-gradient(0deg, #111111, #eeeeee)' });
    });
});
