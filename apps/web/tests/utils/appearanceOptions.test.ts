import { describe, expect, it } from 'vitest';
import { APPEARANCE_FRAMES, FACIAL_HAIR_STYLES, HAIR_STYLES, type PersonAppearance } from '@/constants/appearance';
import { DEFAULT_APPEARANCE } from '@/utils/appearance';
import {
    BODY_PRESETS,
    FACIAL_HAIR_FITS,
    HAIR_FITS,
    HAIR_SWAP,
    appearanceLabel,
    facialHairFits,
    fits,
    forFrame,
    presetMatching,
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
});
