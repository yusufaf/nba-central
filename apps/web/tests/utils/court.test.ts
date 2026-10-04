import { describe, it, expect } from 'vitest';
import {
    COURT_WOODS,
    apronColours,
    centreLogoUrl,
    contrastRatio,
    courtTextColour,
    fitFontSize,
    newCourt,
    normaliseHex,
    plankPaths,
    woodTones,
} from '@/utils/court';
import type { CourtDesign } from '@/models/api';

const court = (overrides: Partial<CourtDesign> = {}): CourtDesign => ({
    version: 1,
    wood: 'maple',
    paint: '#4b2a7b',
    apron: '#4b2a7b',
    lines: '#ffffff',
    centerLogo: 'none',
    baselineText: 'Harbor Pavilion',
    sidelineText: 'Seattle',
    ...overrides,
});

const minContrast = (design: CourtDesign) => {
    const text = courtTextColour(design);
    return Math.min(...apronColours(design).map((bg) => contrastRatio(text, bg)));
};

// A small seeded generator, so a failure names a colour that reproduces.
const seededHexes = (count: number, seed = 117) => {
    let state = seed;
    const next = () => {
        state = (state * 1664525 + 1013904223) % 2 ** 32;
        return state / 2 ** 32;
    };
    return Array.from({ length: count }, () =>
        `#${Array.from({ length: 3 }, () => Math.floor(next() * 256).toString(16).padStart(2, '0')).join('')}`,
    );
};

describe('contrastRatio', () => {
    it('matches the WCAG reference values', () => {
        expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
        expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
        expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    });
});

describe('courtTextColour', () => {
    it.each(Object.keys(COURT_WOODS))('reaches 4.5:1 on every plank of the stained %s apron', (wood) => {
        expect(minContrast(court({ wood: wood as CourtDesign['wood'], apron: null }))).toBeGreaterThanOrEqual(4.5);
    });

    it('reaches 4.5:1 on any solid apron colour', () => {
        const edges = ['#000000', '#ffffff', '#767676', '#777777', '#757575', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#808080'];
        for (const apron of [...edges, ...seededHexes(2000)]) {
            expect(minContrast(court({ apron })), apron).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('picks dark text on a light apron and light text on a dark one', () => {
        expect(courtTextColour(court({ apron: '#f5f5f5' }))).toBe('#000000');
        expect(courtTextColour(court({ apron: '#111111' }))).toBe('#ffffff');
    });

    it('ignores the paint and lines, which the text never sits on', () => {
        const base = courtTextColour(court({ apron: '#f5f5f5' }));
        expect(courtTextColour(court({ apron: '#f5f5f5', paint: '#000000', lines: '#000000' }))).toBe(base);
    });
});

describe('apronColours', () => {
    it('is the solid apron, or the stained planks when the apron is null', () => {
        expect(apronColours(court({ apron: '#123456' }))).toEqual(['#123456']);
        const stained = apronColours(court({ apron: null }));
        expect(stained.length).toBeGreaterThan(1);
        // Stained is darker than the floor it frames.
        expect(contrastRatio(stained[0], '#000000')).toBeLessThan(contrastRatio(woodTones('maple')[0], '#000000'));
    });
});

describe('plankPaths', () => {
    it('is the same floor for the same seed, so every surface draws one court', () => {
        const area = { x: 50, y: 40, width: 940, height: 500 };
        expect(plankPaths(7, area, 5)).toEqual(plankPaths(7, area, 5));
        expect(plankPaths(7, area, 5)).not.toEqual(plankPaths(8, area, 5));
    });

    it('returns one path per tone and keeps every plank inside the area', () => {
        const area = { x: 50, y: 40, width: 940, height: 500 };
        const paths = plankPaths(3, area, 4);
        expect(paths).toHaveLength(4);
        const numbers = paths.join(' ').match(/M[\d.]+ [\d.]+/g) ?? [];
        expect(numbers.length).toBeGreaterThan(100);
        for (const move of numbers) {
            const [x, y] = move.slice(1).split(' ').map(Number);
            expect(x).toBeGreaterThanOrEqual(area.x);
            expect(x).toBeLessThan(area.x + area.width);
            expect(y).toBeGreaterThanOrEqual(area.y);
            expect(y).toBeLessThan(area.y + area.height);
        }
    });
});

describe('centreLogoUrl', () => {
    const logos = { teamLogo: 'https://cdn.example/team.png', uploadedLogo: 'https://cdn.example/arenas/a1/logo-1.png' };

    it('follows the centre logo setting', () => {
        expect(centreLogoUrl(court({ centerLogo: 'none' }), logos)).toBeUndefined();
        expect(centreLogoUrl(court({ centerLogo: 'team' }), logos)).toBe(logos.teamLogo);
        expect(centreLogoUrl(court({ centerLogo: 'upload' }), logos)).toBe(logos.uploadedLogo);
    });

    it('is undefined when the chosen logo is missing', () => {
        expect(centreLogoUrl(court({ centerLogo: 'team' }), {})).toBeUndefined();
        expect(centreLogoUrl(court({ centerLogo: 'upload' }), { teamLogo: 'x' })).toBeUndefined();
        expect(centreLogoUrl(null, logos)).toBeUndefined();
    });
});

describe('fitFontSize', () => {
    it('keeps the full size for short text and shrinks long text to fit', () => {
        expect(fitFontSize('SEATTLE', 900, 26)).toBe(26);
        const long = fitFontSize('A'.repeat(20), 400, 26);
        expect(long).toBeLessThan(26);
        expect(long * 20 * 0.86).toBeLessThanOrEqual(400);
    });
});

describe('normaliseHex', () => {
    it('lowercases, expands #rgb and drops an alpha channel', () => {
        expect(normaliseHex('#AABBCC')).toBe('#aabbcc');
        expect(normaliseHex('#abc')).toBe('#aabbcc');
        expect(normaliseHex('#aabbcc80')).toBe('#aabbcc');
        expect(normaliseHex('red')).toBeNull();
    });
});

describe('newCourt', () => {
    it('starts from the arena name, cut to the baseline limit', () => {
        const design = newCourt('A very long arena name that keeps going');
        expect(design.baselineText).toBe('A very long arena na');
        expect(design.version).toBe(1);
        expect(design.centerLogo).toBe('team');
    });
});
