// An arena's 3D venue (#295). Mirrors apps/cdk/models/custom-entities.ts;
// apps/cdk/test/utilities/venue.test.ts fails if the two drift. Import-free,
// since that test loads this file outside Vite.
export const SEAT_PATTERNS = ['solid', 'sections', 'rows', 'gradient'] as const;
export type SeatPatternId = (typeof SEAT_PATTERNS)[number];

// Scoreboard and LED ribbon text limits (#296), counted in .length like the court's.
export const SCOREBOARD_TEXT_MAX = 16;
export const RIBBON_TEXT_MAX = 32;

// Rafters banners (#297): championship or retired-number banners.
export const BANNER_KINDS = ['title', 'number'] as const;
export type BannerKindId = (typeof BANNER_KINDS)[number];
export const BANNERS_MAX = 8;
export const BANNER_TITLE_MAX = 16;
export const BANNER_SUBTITLE_MAX = 24;

export interface VenueBanner {
    kind: BannerKindId;
    title: string;
    subtitle: string;
    color: string;
}

// Lighting (#298): the arena's lighting preset and tint.
export const LIGHTING_PRESETS = ['broadcast', 'theater'] as const;
export type LightingPresetId = (typeof LIGHTING_PRESETS)[number];

export interface VenueLighting {
    preset: LightingPresetId;
    tint: string;
}

// Every part is optional (#296): an arena can have a scoreboard without a seat design.
export interface VenueDesign {
    version: 1;
    seats?: { primary: string; secondary: string; pattern: SeatPatternId };
    upperDeck?: boolean;
    scoreboard?: { text: string; accent: string };
    ribbon?: { text: string; color: string };
    banners?: VenueBanner[];
    lighting?: VenueLighting;
}
