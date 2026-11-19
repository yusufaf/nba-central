import { describe, expect, it } from 'vitest';
import { reactive } from 'vue';
import { SEAT_PATTERNS, type VenueDesign } from '@/constants/venue';
import { SCENE_COLOURS } from '@/three/arena/palette';
import {
    DEFAULT_CAPACITY,
    LED_SWATCHES,
    SEAT_PATTERN_LABELS,
    SEAT_SWATCHES,
    SECONDARY_HINTS,
    copyVenue,
    defaultUpperDeck,
    hasSeats,
    newRibbon,
    newScoreboard,
    patternChip,
    setVenuePart,
    submittedVenue,
    venueTextsValid,
    withSeatDesign,
    withoutSeatDesign,
} from '@/utils/venue';

describe('venue values', () => {
    it("starts the seat swatches with today's seat colour", () => {
        expect(SEAT_SWATCHES[0].value).toBe(SCENE_COLOURS.seat);
    });

    it('keeps every swatch as lower-case #rrggbb', () => {
        for (const swatch of [...SEAT_SWATCHES, ...LED_SWATCHES]) expect(swatch.value).toMatch(/^#[0-9a-f]{6}$/);
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

const SEATS = { primary: '#2a3140', secondary: '#b91c1c', pattern: 'solid' } as const;
const SCOREBOARD = { text: 'HARBOR', accent: '#ef4444' };
const RIBBON = { text: 'Welcome', color: '#f59e0b' };

describe('withSeatDesign', () => {
    it("starts from today's solid slate seats, with the capacity's usual deck", () => {
        expect(withSeatDesign(null, null)).toEqual({ version: 1, seats: SEATS, upperDeck: true });
        expect(withSeatDesign(null, 5000).upperDeck).toBe(false);
        expect(withSeatDesign(null, 12000).upperDeck).toBe(false);
        expect(withSeatDesign(null, 12001).upperDeck).toBe(true);
    });

    it('keeps the other parts and returns a fresh object', () => {
        const venue: VenueDesign = { version: 1, scoreboard: SCOREBOARD };
        const seated = withSeatDesign(venue, null);
        expect(seated).toEqual({ version: 1, scoreboard: SCOREBOARD, seats: SEATS, upperDeck: true });
        expect(seated).not.toBe(venue);
        expect(venue).toEqual({ version: 1, scoreboard: SCOREBOARD });
        expect(withSeatDesign(null, null).seats).not.toBe(withSeatDesign(null, null).seats);
    });
});

describe('withoutSeatDesign', () => {
    it('drops the seats and the deck, keeping the other parts', () => {
        expect(withoutSeatDesign({ version: 1, seats: SEATS, upperDeck: true, ribbon: RIBBON })).toEqual({
            version: 1,
            ribbon: RIBBON,
        });
    });

    it('is null once no part is left', () => {
        expect(withoutSeatDesign({ version: 1, seats: SEATS, upperDeck: false })).toBeNull();
    });
});

describe('hasSeats', () => {
    it('needs both the seats and the deck', () => {
        expect(hasSeats({ version: 1, seats: SEATS, upperDeck: false })).toBe(true);
        expect(hasSeats({ version: 1, seats: SEATS })).toBe(false);
        expect(hasSeats({ version: 1, scoreboard: SCOREBOARD })).toBe(false);
    });
});

describe('newScoreboard and newRibbon', () => {
    it("start from the arena's name, cut to the limits", () => {
        expect(newScoreboard('  Harbor Pavilion ')).toEqual({ text: 'Harbor Pavilion', accent: '#ef4444' });
        expect(newScoreboard('The Very Long Arena Name').text).toBe('The Very Long Ar');
        expect(newRibbon(' Harbor Pavilion ')).toEqual({ text: 'Welcome to Harbor Pavilion', color: '#f59e0b' });
        expect(newRibbon('').text).toBe('Welcome');
        expect(newRibbon('An Arena Whose Name Runs Past The Limit').text).toHaveLength(32);
    });
});

describe('setVenuePart', () => {
    it('adds or replaces a part in a new object', () => {
        const venue: VenueDesign = { version: 1, seats: SEATS, upperDeck: true };
        const next = setVenuePart(venue, 'scoreboard', SCOREBOARD);
        expect(next).toEqual({ ...venue, scoreboard: SCOREBOARD });
        expect(next).not.toBe(venue);
        expect(venue).not.toHaveProperty('scoreboard');
        expect(setVenuePart(null, 'ribbon', RIBBON)).toEqual({ version: 1, ribbon: RIBBON });
    });

    it('removes a part with undefined, and is null once nothing is left', () => {
        const venue: VenueDesign = { version: 1, scoreboard: SCOREBOARD, ribbon: RIBBON };
        expect(setVenuePart(venue, 'ribbon', undefined)).toEqual({ version: 1, scoreboard: SCOREBOARD });
        expect(setVenuePart({ version: 1, ribbon: RIBBON }, 'ribbon', undefined)).toBeNull();
        expect(setVenuePart(null, 'ribbon', undefined)).toBeNull();
    });
});

describe('copyVenue', () => {
    it('copies every present part into plain objects that structuredClone accepts', () => {
        const venue = reactive<VenueDesign>({
            version: 1,
            seats: { ...SEATS },
            upperDeck: false,
            scoreboard: { ...SCOREBOARD },
            ribbon: { ...RIBBON },
        });
        const copy = copyVenue(venue);
        expect(copy).toEqual({ version: 1, seats: SEATS, upperDeck: false, scoreboard: SCOREBOARD, ribbon: RIBBON });
        expect(() => structuredClone(copy)).not.toThrow();
        expect(copy.scoreboard).not.toBe(venue.scoreboard);
    });

    it('leaves absent parts out', () => {
        expect(Object.keys(copyVenue({ version: 1, ribbon: RIBBON }))).toEqual(['version', 'ribbon']);
    });
});

describe('submittedVenue', () => {
    it('trims the texts', () => {
        expect(
            submittedVenue({
                version: 1,
                scoreboard: { ...SCOREBOARD, text: ' HARBOR ' },
                ribbon: { ...RIBBON, text: ' Hi ' },
            }),
        ).toEqual({ version: 1, scoreboard: SCOREBOARD, ribbon: { ...RIBBON, text: 'Hi' } });
    });

    it('is null without a venue or a part', () => {
        expect(submittedVenue(null)).toBeNull();
        expect(submittedVenue({ version: 1 })).toBeNull();
    });
});

describe('venueTextsValid', () => {
    it('holds each text to its limit', () => {
        expect(venueTextsValid(null)).toBe(true);
        expect(venueTextsValid({ version: 1, scoreboard: { ...SCOREBOARD, text: 'x'.repeat(16) } })).toBe(true);
        expect(venueTextsValid({ version: 1, scoreboard: { ...SCOREBOARD, text: 'x'.repeat(17) } })).toBe(false);
        expect(venueTextsValid({ version: 1, ribbon: { ...RIBBON, text: 'x'.repeat(32) } })).toBe(true);
        expect(venueTextsValid({ version: 1, ribbon: { ...RIBBON, text: 'x'.repeat(33) } })).toBe(false);
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
