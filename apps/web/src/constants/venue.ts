// An arena's 3D venue (#295). Mirrors apps/cdk/models/custom-entities.ts;
// apps/cdk/test/utilities/venue.test.ts fails if the two drift. Import-free,
// since that test loads this file outside Vite.
export const SEAT_PATTERNS = ['solid', 'sections', 'rows', 'gradient'] as const;
export type SeatPatternId = (typeof SEAT_PATTERNS)[number];

export interface VenueDesign {
    version: 1;
    seats: { primary: string; secondary: string; pattern: SeatPatternId };
    upperDeck: boolean;
}
