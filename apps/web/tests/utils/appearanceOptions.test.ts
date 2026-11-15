import { describe, expect, it } from 'vitest';
import { ACCESSORIES, APPEARANCE_FRAMES, FACIAL_HAIR_STYLES, HAIR_STYLES, type PersonAppearance } from '@/constants/appearance';
import { DEFAULT_APPEARANCE, DEFAULT_STAFF_APPEARANCE } from '@/utils/appearance';
import {
    ACCESSORY_DEFAULT_COLOURS,
    ACCESSORY_LABELS,
    BODY_PRESETS,
    FACIAL_HAIR_FITS,
    GEAR_SWATCHES,
    HAIR_FITS,
    HAIR_SWAP,
    agedBuild,
    agedColour,
    appearanceLabel,
    isStaffLook,
    staffAppearanceLabel,
    facialHairFits,
    fits,
    forFrame,
    presetMatching,
    recolourAccessory,
    shownAccessories,
    wearAccessories,
} from '@/utils/appearanceOptions';

const look = (change: Partial<PersonAppearance> = {}): PersonAppearance => ({ ...structuredClone(DEFAULT_APPEARANCE), ...change });

describe('fit tables', () => {
    it('gives every cut and facial hair at least one frame', () => {
        for (const style of HAIR_STYLES.filter((s) => s !== 'none')) expect(HAIR_FITS[style].length).toBeGreaterThan(0);
        for (const style of FACIAL_HAIR_STYLES.filter((s) => s !== 'none')) expect(FACIAL_HAIR_FITS[style].length).toBeGreaterThan(0);
    });

    it('swaps every cut to one that fits the other frame', () => {
        for (const [from, to] of Object.entries(HAIR_SWAP)) {
            const frame = HAIR_FITS[from as keyof typeof HAIR_FITS][0];
            const other = APPEARANCE_FRAMES.find((f) => f !== frame)!;
            expect(fits(other, to), `${from} -> ${to}`).toBe(true);
        }
    });

    it('fits none everywhere', () => {
        for (const frame of APPEARANCE_FRAMES) {
            expect(fits(frame, 'none')).toBe(true);
            expect(facialHairFits(frame, 'none')).toBe(true);
        }
    });
});

describe('forFrame', () => {
    it.for([
        ['m', 'buzzed', 'f', 'buzzedFemale'],
        ['m', 'parted', 'f', 'long'],
        ['f', 'buns', 'm', 'parted'],
        ['f', 'long', 'm', 'parted'],
        ['f', 'buzzedFemale', 'm', 'buzzed'],
    ] as const)('maps %s %s to %s %s', ([from, style, to, expected]) => {
        expect(forFrame(look({ frame: from, hair: { style, color: '#123456' } }), to).hair).toEqual({ style: expected, color: '#123456' });
    });

    it('keeps a cut that fits and no hair', () => {
        expect(forFrame(look({ frame: 'f', hair: { style: 'long', color: '#000000' } }), 'f').hair.style).toBe('long');
        expect(forFrame(look({ hair: { style: 'none', color: '#000000' } }), 'f').hair.style).toBe('none');
    });

    it("drops a beard on a frame it doesn't fit", () => {
        const bearded = look({ facialHair: { style: 'beard', color: '#3b2a1e' } });
        expect(forFrame(bearded, 'f').facialHair).toEqual({ style: 'none', color: '#3b2a1e' });
        expect(forFrame(bearded, 'm').facialHair.style).toBe('beard');
    });

    it('keeps the rest and leaves the input alone', () => {
        const before = look({ skin: '#abcdef', pose: 'celebrate', build: { girth: 0.3, shoulders: -0.2, wingspan: 0.1 }, jerseyNumber: '00' });
        const copy = structuredClone(before);
        const after = forFrame(before, 'f');
        expect(before).toEqual(copy);
        expect(after).toMatchObject({ frame: 'f', skin: '#abcdef', pose: 'celebrate', jerseyNumber: '00', build: copy.build });
        expect(after.build).not.toBe(before.build);
    });
});

describe('presetMatching', () => {
    it('names the preset whose size and build match', () => {
        const wing = BODY_PRESETS.f[1];
        expect(presetMatching('f', wing, wing.build)).toBe('wing');
    });

    it('is custom once one value moves', () => {
        const guard = BODY_PRESETS.m[0];
        expect(presetMatching('m', guard, { ...guard.build, girth: 0.1 })).toBe('custom');
        expect(presetMatching('m', { ...guard, weightPounds: 196 }, guard.build)).toBe('custom');
        // The same numbers are a different preset on the other frame, or none.
        expect(presetMatching('f', guard, guard.build)).toBe('custom');
    });
});

describe('appearanceLabel', () => {
    it('describes the look', () => {
        const nova = look({ frame: 'f', hair: { style: 'long', color: '#000000' }, pose: 'handsOnHips' });
        expect(appearanceLabel('Nova', nova)).toBe('3D preview of Nova: athletic female frame, long hair, no facial hair, hands on hips');
        expect(appearanceLabel('Max', look({ hair: { style: 'none', color: '#000000' }, facialHair: { style: 'beard', color: '#000000' } }))).toBe(
            '3D preview of Max: athletic male frame, no hair, beard, relaxed',
        );
    });
    it('lists the gear it shows', () => {
        const nova = look({ frame: 'f', hair: { style: 'long', color: '#000000' }, pose: 'handsOnHips' });
        const label = (ids: (typeof ACCESSORIES)[number][]) =>
            appearanceLabel('Nova', { ...nova, accessories: ids.map((id) => ({ id, color: '#1c1c1c' })) });
        expect(label(['headband'])).toBe('3D preview of Nova: athletic female frame, long hair, no facial hair, hands on hips, wearing a headband');
        expect(label(['headband', 'armSleeve', 'glasses'])).toMatch(/, wearing a headband, an arm sleeve and glasses$/);
        expect(label(['goggles', 'glasses'])).toMatch(/, wearing goggles$/);
    });
});

describe('accessories', () => {
    const worn = (...entries: [(typeof ACCESSORIES)[number], string][]) => entries.map(([id, color]) => ({ id, color }));

    it('gives every accessory a label and a default colour from the gear swatches', () => {
        const swatches = GEAR_SWATCHES.map((s) => s.value);
        for (const id of ACCESSORIES) {
            expect(ACCESSORY_LABELS[id]).toBeTruthy();
            expect(swatches).toContain(ACCESSORY_DEFAULT_COLOURS[id]);
        }
    });

    it('wears gear in a fixed order, in its default colour', () => {
        expect(wearAccessories([], ['glasses', 'headband'])).toEqual(worn(['headband', '#f5f5f5'], ['glasses', '#1c1c1c']));
    });

    it('keeps the colours of gear already worn, and takes off what is dropped', () => {
        const current = worn(['headband', '#c8102e'], ['glasses', '#1d428a']);
        expect(wearAccessories(current, ['headband', 'glasses', 'armSleeve'])).toEqual(
            worn(['headband', '#c8102e'], ['armSleeve', '#1c1c1c'], ['glasses', '#1d428a']),
        );
        expect(wearAccessories(current, ['glasses'])).toEqual(worn(['glasses', '#1d428a']));
    });

    it('swaps goggles and glasses for the one just pressed', () => {
        expect(wearAccessories(worn(['goggles', '#c8102e']), ['goggles', 'glasses'])).toEqual(worn(['glasses', '#1c1c1c']));
        expect(wearAccessories(worn(['glasses', '#c8102e']), ['glasses', 'goggles'])).toEqual(worn(['goggles', '#1c1c1c']));
    });

    it('keeps goggles when it cannot tell which eyewear was pressed', () => {
        expect(wearAccessories([], ['goggles', 'glasses'])).toEqual(worn(['goggles', '#1c1c1c']));
        const both = worn(['goggles', '#c8102e'], ['glasses', '#1d428a']);
        expect(wearAccessories(both, ['goggles', 'glasses', 'headband'])).toEqual(worn(['headband', '#f5f5f5'], ['goggles', '#c8102e']));
    });

    it('ignores unknown ids and never changes what it was given', () => {
        const current = worn(['headband', '#c8102e']);
        const copy = structuredClone(current);
        expect(wearAccessories(current, ['headband', 'cape' as never])).toEqual(copy);
        expect(current).toEqual(copy);
    });

    it('recolours only the accessory named', () => {
        const current = worn(['headband', '#f5f5f5'], ['armSleeve', '#1c1c1c']);
        expect(recolourAccessory(current, 'armSleeve', '#007a33')).toEqual(worn(['headband', '#f5f5f5'], ['armSleeve', '#007a33']));
        expect(recolourAccessory(current, 'glasses', '#007a33')).toEqual(current);
        expect(current[1].color).toBe('#1c1c1c');
    });

    it('shows goggles over glasses, and everything else as worn', () => {
        expect(shownAccessories(worn(['headband', '#f5f5f5'], ['goggles', '#1c1c1c'], ['glasses', '#1c1c1c']))).toEqual(
            worn(['headband', '#f5f5f5'], ['goggles', '#1c1c1c']),
        );
        const glasses = worn(['armSleeve', '#1c1c1c'], ['glasses', '#1c1c1c']);
        expect(shownAccessories(glasses)).toEqual(glasses);
    });
});

describe('age looks', () => {
    it('leaves the colour alone when young', () => {
        expect(agedColour('#3B2A1E', 'young')).toBe('#3B2A1E');
    });

    it('greys toward silver, more at veteran than prime', () => {
        expect(agedColour('#000000', 'veteran')).toBe('#898989');
        const prime = parseInt(agedColour('#000000', 'prime').slice(1, 3), 16);
        expect(prime).toBeGreaterThan(0);
        expect(prime).toBeLessThan(0x89);
        expect(agedColour('#3b2a1e', 'prime')).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('adds girth only at veteran', () => {
        const staff = structuredClone(DEFAULT_STAFF_APPEARANCE);
        expect(agedBuild({ ...staff, ageLook: 'young' }).girth).toBe(0);
        expect(agedBuild({ ...staff, ageLook: 'prime' }).girth).toBe(0);
        expect(agedBuild({ ...staff, ageLook: 'veteran' }).girth).toBeCloseTo(0.4);
    });

    it('tells a staff look from a player look', () => {
        expect(isStaffLook(DEFAULT_STAFF_APPEARANCE)).toBe(true);
        expect(isStaffLook(DEFAULT_APPEARANCE)).toBe(false);
        expect(isStaffLook(null)).toBe(false);
    });

    it('names the age and outfit in the label', () => {
        const label = staffAppearanceLabel('Coach Vega', {
            ...structuredClone(DEFAULT_STAFF_APPEARANCE),
            ageLook: 'veteran',
            outfit: { style: 'tracksuit', primary: '#000000', secondary: '#ffffff' },
        });
        expect(label).toMatch(/^3D preview of Coach Vega: /);
        expect(label).toMatch(/, veteran tracksuit$/);
    });
});
