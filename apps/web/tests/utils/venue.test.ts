import { describe, expect, it } from 'vitest';
import { reactive } from 'vue';
import { BANNERS_MAX, BANNER_KINDS, LIGHTING_PRESETS, SEAT_PATTERNS, type VenueBanner, type VenueDesign } from '@/constants/venue';
import { SCENE_COLOURS } from '@/three/arena/palette';
import {
    BANNER_KIND_LABELS,
    BANNER_SWATCHES,
    DEFAULT_CAPACITY,
    DEFAULT_LIGHTING,
    LIGHT_SWATCHES,
    LIGHTING_PRESET_HINTS,
    LIGHTING_PRESET_LABELS,
    lightingDesign,
    setLighting,
    LED_SWATCHES,
    addBanner,
    moveBanner,
    newBanner,
    removeBanner,
    setBanner,
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
        for (const swatch of [...SEAT_SWATCHES, ...LED_SWATCHES, ...BANNER_SWATCHES, ...LIGHT_SWATCHES]) expect(swatch.value).toMatch(/^#[0-9a-f]{6}$/);
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

const BANNER: VenueBanner = { kind: 'title', title: 'CHAMPIONS', subtitle: '1998', color: '#c9a227' };
const RETIRED: VenueBanner = { kind: 'number', title: '23', subtitle: 'JORDAN', color: '#b91c1c' };

describe('banner values (#297)', () => {
    it('labels every kind', () => {
        for (const kind of BANNER_KINDS) expect(BANNER_KIND_LABELS[kind]).toBeTruthy();
    });

    it('starts a new banner as a championship in the first swatch', () => {
        expect(newBanner()).toEqual({ kind: 'title', title: 'Champions', subtitle: '', color: BANNER_SWATCHES[0].value });
        expect(newBanner()).not.toBe(newBanner());
    });
});

describe('addBanner', () => {
    it('starts a venue from nothing', () => {
        expect(addBanner(null)).toEqual({ version: 1, banners: [newBanner()] });
    });

    it('appends to a new venue and list, leaving the old ones alone', () => {
        const venue: VenueDesign = { version: 1, ribbon: RIBBON, banners: [BANNER] };
        const next = addBanner(venue);
        expect(next).toEqual({ ...venue, banners: [BANNER, newBanner()] });
        expect(next.banners).not.toBe(venue.banners);
        expect(venue.banners).toEqual([BANNER]);
    });

    it('stops at the limit', () => {
        const full: VenueDesign = { version: 1, banners: Array.from({ length: BANNERS_MAX }, () => BANNER) };
        expect(addBanner(full)).toBe(full);
    });
});

describe('setBanner', () => {
    it('changes one banner in a new venue', () => {
        const venue: VenueDesign = { version: 1, banners: [BANNER, RETIRED] };
        const next = setBanner(venue, 1, { title: '33' });
        expect(next?.banners).toEqual([BANNER, { ...RETIRED, title: '33' }]);
        expect(next?.banners?.[0]).toBe(BANNER);
        expect(venue.banners?.[1]).toEqual(RETIRED);
    });

    it('leaves the venue as it is when there is no banner there', () => {
        const venue: VenueDesign = { version: 1, banners: [BANNER] };
        expect(setBanner(venue, 3, { title: 'X' })).toBe(venue);
        expect(setBanner(null, 0, { title: 'X' })).toBeNull();
    });
});

describe('moveBanner', () => {
    it('moves a banner in a new list', () => {
        const venue: VenueDesign = { version: 1, banners: [BANNER, RETIRED] };
        const next = moveBanner(venue, 0, 1);
        expect(next?.banners).toEqual([RETIRED, BANNER]);
        expect(venue.banners).toEqual([BANNER, RETIRED]);
    });

    it('ignores a move out of range', () => {
        const venue: VenueDesign = { version: 1, banners: [BANNER, RETIRED] };
        expect(moveBanner(venue, 1, 2)).toBe(venue);
        expect(moveBanner(venue, -1, 0)).toBe(venue);
        expect(moveBanner(null, 0, 1)).toBeNull();
    });
});

describe('removeBanner', () => {
    it('removes one banner in a new list', () => {
        const venue: VenueDesign = { version: 1, ribbon: RIBBON, banners: [BANNER, RETIRED] };
        expect(removeBanner(venue, 0)).toEqual({ version: 1, ribbon: RIBBON, banners: [RETIRED] });
        expect(venue.banners).toHaveLength(2);
    });

    it('drops the key with the last banner, and the venue once nothing is left', () => {
        expect(removeBanner({ version: 1, ribbon: RIBBON, banners: [BANNER] }, 0)).toEqual({ version: 1, ribbon: RIBBON });
        expect(removeBanner({ version: 1, banners: [BANNER] }, 0)).toBeNull();
        expect(removeBanner(null, 0)).toBeNull();
    });
});

describe('banners in copyVenue, submittedVenue and venueTextsValid', () => {
    it('copies the list and each banner', () => {
        const venue = reactive<VenueDesign>({ version: 1, banners: [{ ...BANNER }] });
        const copy = copyVenue(venue);
        expect(copy).toEqual({ version: 1, banners: [BANNER] });
        expect(copy.banners).not.toBe(venue.banners);
        expect(copy.banners?.[0]).not.toBe(venue.banners?.[0]);
        expect(() => structuredClone(copy)).not.toThrow();
    });

    it('trims each title and subtitle', () => {
        expect(submittedVenue({ version: 1, banners: [{ ...BANNER, title: ' CHAMPIONS ', subtitle: ' 1998 ' }] })).toEqual(
            { version: 1, banners: [BANNER] },
        );
    });

    it('holds the list and each text to its limit', () => {
        const valid = (banners: VenueBanner[]) => venueTextsValid({ version: 1, banners });
        expect(valid([{ ...BANNER, title: 'x'.repeat(16), subtitle: 'x'.repeat(24) }])).toBe(true);
        expect(valid([{ ...BANNER, title: 'x'.repeat(17) }])).toBe(false);
        expect(valid([{ ...BANNER, subtitle: 'x'.repeat(25) }])).toBe(false);
        expect(valid(Array.from({ length: BANNERS_MAX }, () => BANNER))).toBe(true);
        expect(valid(Array.from({ length: BANNERS_MAX + 1 }, () => BANNER))).toBe(false);
    });
});

const THEATER = { preset: 'theater', tint: '#a855f7' } as const;

describe('lighting values (#298)', () => {
    it('labels and hints every preset, and starts the swatches with white', () => {
        for (const preset of LIGHTING_PRESETS) {
            expect(LIGHTING_PRESET_LABELS[preset]).toBeTruthy();
            expect(LIGHTING_PRESET_HINTS[preset]).toBeTruthy();
        }
        expect(LIGHT_SWATCHES[0].value).toBe(DEFAULT_LIGHTING.tint);
        expect(DEFAULT_LIGHTING).toEqual({ preset: 'broadcast', tint: '#ffffff' });
    });
});

describe('lightingDesign', () => {
    it.for([
        ['no venue', null],
        ['undefined', undefined],
        ['a venue without lighting', { version: 1 }],
        ['null lighting', { version: 1, lighting: null }],
        ['an unknown preset', { version: 1, lighting: { ...THEATER, preset: 'disco' } }],
        ['a named tint', { version: 1, lighting: { ...THEATER, tint: 'blue' } }],
        ['a short tint', { version: 1, lighting: { ...THEATER, tint: '#fff' } }],
    ] as [string, VenueDesign | null | undefined][])('is the default for %s', ([, venue]) => {
        const lighting = lightingDesign(venue);
        expect(lighting).toEqual(DEFAULT_LIGHTING);
        expect(lighting).not.toBe(DEFAULT_LIGHTING);
    });

    it('copies a valid lighting, dropping anything else', () => {
        const stored = { ...THEATER, extra: 1 };
        const lighting = lightingDesign({ version: 1, lighting: stored } as VenueDesign);
        expect(lighting).toEqual(THEATER);
        expect(lighting).not.toBe(stored);
    });
});

describe('setLighting', () => {
    it('starts a venue from nothing', () => {
        expect(setLighting(null, { preset: 'theater' })).toEqual({
            version: 1,
            lighting: { preset: 'theater', tint: '#ffffff' },
        });
    });

    it('keeps the preset when the tint changes, in a new venue', () => {
        const venue: VenueDesign = { version: 1, ribbon: RIBBON, lighting: { ...THEATER } };
        const next = setLighting(venue, { tint: '#22c55e' });
        expect(next).toEqual({ version: 1, ribbon: RIBBON, lighting: { preset: 'theater', tint: '#22c55e' } });
        expect(venue.lighting).toEqual(THEATER);
    });

    it('drops standard lighting, and the venue once nothing else is left', () => {
        const lit: VenueDesign = { version: 1, lighting: { preset: 'theater', tint: '#ffffff' } };
        expect(setLighting(lit, { preset: 'broadcast' })).toBeNull();
        expect(setLighting({ version: 1, lighting: { preset: 'broadcast', tint: '#a855f7' } }, { tint: '#FFFFFF' })).toBeNull();
        expect(setLighting({ ...lit, ribbon: RIBBON }, { preset: 'broadcast' })).toEqual({ version: 1, ribbon: RIBBON });
        expect(lit.lighting).toEqual({ preset: 'theater', tint: '#ffffff' });
    });
});

describe('lighting in copyVenue and submittedVenue', () => {
    it('copies the lighting into a new object, and submits it', () => {
        const venue = reactive<VenueDesign>({ version: 1, lighting: { ...THEATER } });
        const copy = copyVenue(venue);
        expect(copy).toEqual({ version: 1, lighting: THEATER });
        expect(copy.lighting).not.toBe(venue.lighting);
        expect(() => structuredClone(copy)).not.toThrow();
        expect(submittedVenue(venue)).toEqual({ version: 1, lighting: THEATER });
    });
});
