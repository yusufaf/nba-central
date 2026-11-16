import { SEAT_PATTERNS, type SeatPatternId, type VenueDesign } from '@/constants/venue';
import { SCENE_COLOURS } from './palette';

export interface SeatColouring {
    primary: string;
    secondary: string;
    pattern: SeatPatternId;
}

// Sections are this many of the bowl's 72 segments: 12 sections, edges on the axes.
export const SECTION_SEGMENTS = 6;
// Rows alternate in pairs; single rows shimmer at broadcast distance.
export const ROW_BAND = 2;

const HEX = /^#[0-9a-f]{6}$/i;

/** Arenas without a venue, and any malformed one, get today's solid seats. */
export const seatColouring = (venue: VenueDesign | null | undefined): SeatColouring => {
    const seats = venue?.seats;
    if (seats && HEX.test(seats.primary) && HEX.test(seats.secondary) && SEAT_PATTERNS.includes(seats.pattern)) {
        return { primary: seats.primary, secondary: seats.secondary, pattern: seats.pattern };
    }
    return { primary: SCENE_COLOURS.seat, secondary: SCENE_COLOURS.seat, pattern: 'solid' };
};

/**
 * How far one riser goes from the primary (0) to the secondary (1). `row`
 * counts up through both decks, lower first, and `rows` is the total.
 */
export const seatMix = (pattern: SeatPatternId, at: { row: number; rows: number; segment: number }): number => {
    switch (pattern) {
        case 'solid':
            return 0;
        case 'sections':
            return Math.floor(at.segment / SECTION_SEGMENTS) % 2;
        case 'rows':
            return Math.floor(at.row / ROW_BAND) % 2;
        case 'gradient':
            return at.rows <= 1 ? 0 : at.row / (at.rows - 1);
    }
};
