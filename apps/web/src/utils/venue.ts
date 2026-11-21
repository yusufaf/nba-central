import {
    BANNER_SUBTITLE_MAX,
    BANNER_TITLE_MAX,
    BANNERS_MAX,
    RIBBON_TEXT_MAX,
    SCOREBOARD_TEXT_MAX,
    type BannerKindId,
    type SeatPatternId,
    type VenueBanner,
    type VenueDesign,
} from '@/constants/venue';
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

// A venue whose Seats tab is designed: both seat keys are there.
export type SeatedVenue = VenueDesign & Required<Pick<VenueDesign, 'seats' | 'upperDeck'>>;

export const hasSeats = (venue: VenueDesign): venue is SeatedVenue =>
    venue.seats !== undefined && venue.upperDeck !== undefined;

// A venue with no part left is no venue: the arena keeps the standard bowl.
const orNull = (venue: VenueDesign): VenueDesign | null =>
    Object.keys(venue).some((key) => key !== 'version') ? venue : null;

// Starts from today's look, so nothing in the preview jumps when it's created.
export const withSeatDesign = (venue: VenueDesign | null, capacity: number | null): SeatedVenue => ({
    ...(venue ?? { version: 1 }),
    seats: { primary: SEAT_SWATCHES[0].value, secondary: '#b91c1c', pattern: 'solid' },
    upperDeck: defaultUpperDeck(capacity),
});

export const withoutSeatDesign = (venue: VenueDesign): VenueDesign | null => {
    const { seats: _seats, upperDeck: _upperDeck, ...rest } = venue;
    return orNull(rest);
};

// LED colours: bright, since they're lit screens on a black panel.
export const LED_SWATCHES: Swatch[] = [
    { value: '#ffffff', label: 'White' },
    { value: '#f59e0b', label: 'Amber' },
    { value: '#ef4444', label: 'Red' },
    { value: '#22c55e', label: 'Green' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#a855f7', label: 'Purple' },
    { value: '#c9a227', label: 'Gold' },
];

export const newScoreboard = (arenaName: string): NonNullable<VenueDesign['scoreboard']> => ({
    text: arenaName.trim().slice(0, SCOREBOARD_TEXT_MAX),
    accent: '#ef4444',
});

export const newRibbon = (arenaName: string): NonNullable<VenueDesign['ribbon']> => {
    const name = arenaName.trim();
    return { text: (name ? `Welcome to ${name}` : 'Welcome').slice(0, RIBBON_TEXT_MAX), color: '#f59e0b' };
};

// Banner fabric colours (#297).
export const BANNER_SWATCHES: Swatch[] = [
    { value: '#1d2a44', label: 'Navy' },
    { value: '#b91c1c', label: 'Red' },
    { value: '#1d4ed8', label: 'Royal' },
    { value: '#0f6b3c', label: 'Green' },
    { value: '#4b2a7b', label: 'Purple' },
    { value: '#c9a227', label: 'Gold' },
    { value: '#16181d', label: 'Black' },
    { value: '#f5f5f4', label: 'White' },
];

export const BANNER_KIND_LABELS: Record<BannerKindId, string> = {
    title: 'Championship',
    number: 'Retired number',
};

export const newBanner = (): VenueBanner => ({
    kind: 'title',
    title: 'Champions',
    subtitle: '',
    color: BANNER_SWATCHES[0].value,
});

/** A new venue with one part set, or removed with undefined. */
export const setVenuePart = <K extends 'scoreboard' | 'ribbon' | 'banners'>(
    venue: VenueDesign | null,
    key: K,
    value: VenueDesign[K] | undefined,
): VenueDesign | null => {
    const next: VenueDesign = { ...(venue ?? { version: 1 }) };
    if (value === undefined) delete next[key];
    else next[key] = value;
    return orNull(next);
};

const withBanners = (venue: VenueDesign | null, banners: VenueBanner[]): VenueDesign | null =>
    setVenuePart(venue, 'banners', banners.length > 0 ? banners : undefined);

export const addBanner = (venue: VenueDesign | null): VenueDesign => {
    const banners = venue?.banners ?? [];
    if (venue && banners.length >= BANNERS_MAX) return venue;
    return { ...(venue ?? { version: 1 }), banners: [...banners, newBanner()] };
};

export const setBanner = (
    venue: VenueDesign | null,
    index: number,
    change: Partial<VenueBanner>,
): VenueDesign | null => {
    const banners = venue?.banners;
    if (!banners?.[index]) return venue;
    return withBanners(
        venue,
        banners.map((banner, i) => (i === index ? { ...banner, ...change } : banner)),
    );
};

export const moveBanner = (venue: VenueDesign | null, from: number, to: number): VenueDesign | null => {
    const banners = venue?.banners;
    if (!banners?.[from] || !banners[to]) return venue;
    const next = [...banners];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return withBanners(venue, next);
};

export const removeBanner = (venue: VenueDesign | null, index: number): VenueDesign | null => {
    const banners = venue?.banners;
    if (!banners?.[index]) return venue;
    return withBanners(
        venue,
        banners.filter((_, i) => i !== index),
    );
};

// A plain copy two levels deep: a loaded venue can hold reactive proxies,
// which structuredClone (and so the 3D scene's inputs) can't take.
export const copyVenue = (venue: VenueDesign): VenueDesign => ({
    version: 1,
    ...(venue.seats && { seats: { ...venue.seats } }),
    ...(venue.upperDeck !== undefined && { upperDeck: venue.upperDeck }),
    ...(venue.scoreboard && { scoreboard: { ...venue.scoreboard } }),
    ...(venue.ribbon && { ribbon: { ...venue.ribbon } }),
    ...(venue.banners && { banners: venue.banners.map((banner) => ({ ...banner })) }),
});

export const submittedVenue = (venue: VenueDesign | null): VenueDesign | null => {
    if (!venue) return null;
    const copy = copyVenue(venue);
    if (copy.scoreboard) copy.scoreboard.text = copy.scoreboard.text.trim();
    if (copy.ribbon) copy.ribbon.text = copy.ribbon.text.trim();
    for (const banner of copy.banners ?? []) {
        banner.title = banner.title.trim();
        banner.subtitle = banner.subtitle.trim();
    }
    return orNull(copy);
};

// Behind the inputs' maxlength, which a paste or a script can get past.
export const venueTextsValid = (venue: VenueDesign | null): boolean =>
    (venue?.scoreboard?.text.length ?? 0) <= SCOREBOARD_TEXT_MAX &&
    (venue?.ribbon?.text.length ?? 0) <= RIBBON_TEXT_MAX &&
    (venue?.banners ?? []).length <= BANNERS_MAX &&
    (venue?.banners ?? []).every(
        (banner) => banner.title.length <= BANNER_TITLE_MAX && banner.subtitle.length <= BANNER_SUBTITLE_MAX,
    );

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
