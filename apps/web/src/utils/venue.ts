import type { SeatPatternId, VenueDesign } from '@/constants/venue';
import type { Swatch } from '@/utils/appearanceOptions';

// Shared by the Seats tab and the 3D bowl, so it lives outside src/three. The
// colours are a physical arena's, so they don't follow the theme (#295).

// The bowl's size when an arena has no capacity.
export const DEFAULT_CAPACITY = 18000;
// Above this, an arena without a venue gets an upper deck.
export const UPPER_DECK_ABOVE = 12000;

export const defaultUpperDeck = (capacity: number | null): boolean => (capacity ?? DEFAULT_CAPACITY) > UPPER_DECK_ABOVE;

// The first is the scene's standard seat colour (SCENE_COLOURS.seat).
export const SEAT_SWATCHES: Swatch[] = [
    { value: '#2a3140', label: 'Slate' },
    { value: '#16181d', label: 'Black' },
    { value: '#b91c1c', label: 'Red' },
    { value: '#1d4ed8', label: 'Royal' },
    { value: '#1d2a44', label: 'Navy' },
    { value: '#0f6b3c', label: 'Green' },
    { value: '#4b2a7b', label: 'Purple' },
    { value: '#c9a227', label: 'Gold' },
];

export const SEAT_PATTERN_LABELS: Record<SeatPatternId, string> = {
    solid: 'Solid',
    sections: 'Sections',
    rows: 'Rows',
    gradient: 'Gradient',
};

export const SECONDARY_HINTS: Record<SeatPatternId, string> = {
    solid: 'Not used by Solid.',
    sections: 'Every other section.',
    rows: 'Every other pair of rows.',
    gradient: 'The top rows; the primary is at the bottom.',
};

// Starts from today's look, so nothing in the preview jumps when it's created.
export const newVenue = (capacity: number | null): VenueDesign => ({
    version: 1,
    seats: { primary: SEAT_SWATCHES[0].value, secondary: '#b91c1c', pattern: 'solid' },
    upperDeck: defaultUpperDeck(capacity),
});

// The pattern buttons' little preview of each pattern in the current colours.
export const patternChip = (
    pattern: SeatPatternId,
    { primary, secondary }: { primary: string; secondary: string },
): { background: string } => {
    switch (pattern) {
        case 'solid':
            return { background: primary };
        case 'sections':
            return { background: `linear-gradient(90deg, ${primary} 50%, ${secondary} 50%)` };
        case 'rows':
            return { background: `repeating-linear-gradient(180deg, ${primary} 0 25%, ${secondary} 25% 50%)` };
        case 'gradient':
            return { background: `linear-gradient(0deg, ${primary}, ${secondary})` };
    }
};
