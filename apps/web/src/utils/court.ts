import type { CourtDesign } from '@/models/api';

// Court colours are user content, not design tokens: they're the same in
// both themes, and they're hex because that's what CourtDesign stores. This
// is a .ts file, so check:styles (which reads .vue and .css) never sees them.

export type CourtWood = CourtDesign['wood'];

export const COURT_WOODS: Record<CourtWood, { label: string; base: string; stain: number }> = {
    // `stain` darkens the floor into the apron when the apron is null. Each
    // one is tuned so every plank tone stays clear of the luminance band
    // where neither black nor white text reaches 4.5:1 (tests/utils/court.test.ts).
    maple: { label: 'Maple', base: '#dcb886', stain: 0.45 },
    honey: { label: 'Honey', base: '#d08c4c', stain: 0.45 },
    walnut: { label: 'Walnut', base: '#7b4f30', stain: 0.35 },
    ash: { label: 'Ash', base: '#ddd3c2', stain: 0.3 },
    ebony: { label: 'Ebony', base: '#2e2723', stain: 0.3 },
};

export const PAINT_SWATCHES = [
    { label: 'Purple', value: '#4b2a7b' },
    { label: 'Green', value: '#0f6b3c' },
    { label: 'Burnt orange', value: '#c2410c' },
    { label: 'Royal blue', value: '#1d4ed8' },
    { label: 'Red', value: '#b91c1c' },
    { label: 'Black', value: '#111111' },
    { label: 'Gold', value: '#f59e0b' },
    { label: 'Teal', value: '#0e7490' },
];

export const LINE_PRESETS = [
    { label: 'White', value: '#ffffff' },
    { label: 'Black', value: '#111111' },
];

export const BASELINE_TEXT_MAX = 20;
export const SIDELINE_TEXT_MAX = 24;

export const newCourt = (arenaName: string): CourtDesign => ({
    version: 1,
    wood: 'maple',
    paint: PAINT_SWATCHES[0].value,
    apron: PAINT_SWATCHES[0].value,
    lines: LINE_PRESETS[0].value,
    centerLogo: 'team',
    baselineText: arenaName.trim().slice(0, BASELINE_TEXT_MAX).trimEnd(),
    sidelineText: '',
});

// How the Apron and Lines controls are set. Not stored: "Custom" can hold
// a colour that happens to equal the paint or a preset, so the mode can't be
// read back from the colours once the user has picked it.
export type ApronMode = 'match' | 'stained' | 'custom';
export type LinesMode = string;

export const courtModes = (court: CourtDesign): { apron: ApronMode; lines: LinesMode } => ({
    apron: court.apron === null ? 'stained' : court.apron === court.paint ? 'match' : 'custom',
    lines: LINE_PRESETS.some((preset) => preset.value === court.lines) ? court.lines : 'custom',
});

/** `#rrggbb` in lower case, from `#rgb`, `#rrggbb` or `#rrggbbaa`; null otherwise. */
export const normaliseHex = (value: string): string | null => {
    const hex = value.trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(hex)) return `#${[...hex.slice(1)].map((c) => c + c).join('')}`;
    if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(hex)) return hex.slice(0, 7);
    return null;
};

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const toHex = (rgb: number[]) =>
    `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;

/** Mixes towards white (amount > 0) or black (amount < 0). */
export const shade = (hex: string, amount: number) => {
    const target = amount > 0 ? 255 : 0;
    const weight = Math.abs(amount);
    return toHex(channels(hex).map((c) => c + (target - c) * weight));
};

// WCAG 2.x relative luminance and contrast ratio.
const relativeLuminance = (hex: string) => {
    const [r, g, b] = channels(hex).map((c) => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (a: string, b: string) => {
    const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
};

const TONE_SPREAD = [-0.08, -0.04, 0, 0.04, 0.08];

/** The plank tones of a floor: its base colour, a little lighter and darker. */
export const woodTones = (wood: CourtWood) => TONE_SPREAD.map((amount) => shade(COURT_WOODS[wood].base, amount));

const stainedTones = (wood: CourtWood) => {
    const stained = shade(COURT_WOODS[wood].base, -COURT_WOODS[wood].stain);
    return TONE_SPREAD.map((amount) => shade(stained, amount));
};

/** Every colour the court's text can sit on: one solid apron, or each stained plank tone. */
export const apronColours = (court: CourtDesign) => (court.apron ? [court.apron] : stainedTones(court.wood));

// Pure black and white: for any one background colour, the better of the
// two is at least 4.58:1. An off-black would drop that floor below 4.5.
const TEXT_COLOURS = ['#ffffff', '#000000'] as const;

/** Baseline and sideline text colour, picked for contrast with the apron. */
export const courtTextColour = (court: CourtDesign): (typeof TEXT_COLOURS)[number] => {
    const backgrounds = apronColours(court);
    const worst = (text: string) => Math.min(...backgrounds.map((bg) => contrastRatio(text, bg)));
    return worst(TEXT_COLOURS[0]) >= worst(TEXT_COLOURS[1]) ? TEXT_COLOURS[0] : TEXT_COLOURS[1];
};

/** The image drawn in the centre circle, if the setting asks for one that exists. */
export const centreLogoUrl = (
    court: CourtDesign | null | undefined,
    logos: { teamLogo?: string | null; uploadedLogo?: string | null },
): string | undefined => {
    if (court?.centerLogo === 'team') return logos.teamLogo || undefined;
    if (court?.centerLogo === 'upload') return logos.uploadedLogo || undefined;
    return undefined;
};

// Bold uppercase Inter averages about 0.72em a glyph, plus the 0.14em of
// letter spacing the court text uses.
const GLYPH_ADVANCE = 0.86;

/** The largest font size, up to `max`, at which `text` fits in `available` units. */
export const fitFontSize = (text: string, available: number, max: number) => {
    if (!text) return max;
    return Math.min(max, Math.floor((available / (text.length * GLYPH_ADVANCE)) * 10) / 10);
};

export interface PlankArea {
    x: number;
    y: number;
    width: number;
    height: number;
}

const PLANK_ROW = 10;
const PLANK_MIN = 80;
const PLANK_MAX = 240;

// mulberry32: tiny, seedable, and good enough to scatter planks.
const seededRandom = (seed: number) => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const round = (n: number) => Math.round(n * 10) / 10;

const plankCache = new Map<string, string[]>();

/**
 * The floor's planks as one SVG path per tone, so a court is a handful of
 * elements rather than hundreds of rects. Rows run the length of the court,
 * each plank 1 unit short of its neighbours so the seams show the base
 * colour underneath. Generated from a seed, so the floor loads nothing and
 * every surface draws the same one.
 */
export const plankPaths = (seed: number, area: PlankArea, toneCount: number): string[] => {
    const key = `${seed}:${area.x},${area.y},${area.width},${area.height}:${toneCount}`;
    const cached = plankCache.get(key);
    if (cached) return cached;

    const random = seededRandom(seed);
    const paths: string[][] = Array.from({ length: toneCount }, () => []);
    const right = area.x + area.width;
    for (let y = area.y; y < area.y + area.height; y += PLANK_ROW) {
        const rowHeight = Math.min(PLANK_ROW, area.y + area.height - y) - 1;
        // Stagger each row so the joints don't line up.
        let x = area.x - random() * PLANK_MAX;
        while (x < right) {
            const length = PLANK_MIN + random() * (PLANK_MAX - PLANK_MIN);
            const start = Math.max(x, area.x);
            const end = Math.min(x + length, right);
            if (end - start > 1 && rowHeight > 0) {
                const tone = Math.floor(random() * toneCount);
                paths[tone].push(`M${round(start)} ${round(y)}h${round(end - start - 1)}v${rowHeight}h${round(start - end + 1)}z`);
            }
            x += length;
        }
    }
    const result = paths.map((segments) => segments.join(''));
    plankCache.set(key, result);
    return result;
};
