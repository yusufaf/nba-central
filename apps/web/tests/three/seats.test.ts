import { describe, expect, it } from 'vitest';
import type { VenueDesign } from '@/constants/venue';
import { SCENE_COLOURS } from '@/three/arena/palette';
import { ROW_BAND, SECTION_SEGMENTS, seatColouring, seatMix } from '@/three/arena/seats';

const VENUE: VenueDesign = {
    version: 1,
    seats: { primary: '#1e293b', secondary: '#b91c1c', pattern: 'sections' },
    upperDeck: true,
};
const SOLID = { primary: SCENE_COLOURS.seat, secondary: SCENE_COLOURS.seat, pattern: 'solid' };

describe('seatColouring', () => {
    it("gives arenas without a venue today's solid seats", () => {
        expect(seatColouring(null)).toEqual(SOLID);
        expect(seatColouring(undefined)).toEqual(SOLID);
    });

    it('falls back to solid seats for a malformed venue', () => {
        expect(seatColouring({ ...VENUE, seats: { ...VENUE.seats, primary: 'red' } })).toEqual(SOLID);
        expect(seatColouring({ ...VENUE, seats: { ...VENUE.seats, secondary: '#fff' } })).toEqual(SOLID);
        expect(
            seatColouring({ ...VENUE, seats: { ...VENUE.seats, pattern: 'stripes' } } as unknown as VenueDesign),
        ).toEqual(SOLID);
        expect(seatColouring({ version: 1, upperDeck: true } as unknown as VenueDesign)).toEqual(SOLID);
    });

    it("passes a valid venue's seats through", () => {
        expect(seatColouring(VENUE)).toEqual(VENUE.seats);
    });
});

describe('seatMix', () => {
    const at = (row: number, segment: number, rows = 20) => ({ row, rows, segment });

    it('is always the primary for solid seats', () => {
        for (const [row, segment] of [[0, 0], [5, 30], [19, 71]]) expect(seatMix('solid', at(row, segment))).toBe(0);
    });

    it('alternates sections every few segments', () => {
        expect(SECTION_SEGMENTS).toBe(6);
        expect(seatMix('sections', at(0, 0))).toBe(0);
        expect(seatMix('sections', at(0, 5))).toBe(0);
        expect(seatMix('sections', at(0, 6))).toBe(1);
        expect(seatMix('sections', at(9, 11))).toBe(1);
        expect(seatMix('sections', at(0, 12))).toBe(0);
    });

    it('alternates pairs of rows', () => {
        expect(ROW_BAND).toBe(2);
        expect([0, 1, 2, 3, 4, 5].map((row) => seatMix('rows', at(row, 0)))).toEqual([0, 0, 1, 1, 0, 0]);
    });

    it('runs the gradient from the primary at the bottom to the secondary at the top', () => {
        const mixes = Array.from({ length: 20 }, (_, row) => seatMix('gradient', at(row, 0)));
        expect(mixes[0]).toBe(0);
        expect(mixes[19]).toBe(1);
        for (let i = 1; i < mixes.length; i++) expect(mixes[i]).toBeGreaterThan(mixes[i - 1]);
        expect(seatMix('gradient', at(0, 0, 1))).toBe(0);
    });
});
