import { describe, expect, it } from 'vitest';
import type { PersonAppearance } from '@/constants/appearance';
import { DEFAULT_APPEARANCE, parseAppearance } from '@/utils/appearance';

const FULL: PersonAppearance = {
    version: 1,
    frame: 'f',
    skin: '#f1c7a5',
    hair: { style: 'parted', color: '#3b2a1e' },
    facialHair: { style: 'beard', color: '#3B2A1E' },
    build: { girth: 0.4, shoulders: -0.5, wingspan: 1 },
    accessories: [
        { id: 'headband', color: '#ffffff' },
        { id: 'armSleeve', color: '#000000' },
    ],
    jerseyNumber: '8',
    pose: 'relaxed',
};

const without = <T extends object>(value: T, key: keyof T) => {
    const copy = { ...value };
    delete copy[key];
    return copy;
};

describe('parseAppearance', () => {
    it.for([null, undefined, 'look', ['m'], 7, true].map((value) => ({ value })))('$value is no appearance', ({ value }) => {
        expect(parseAppearance(value)).toBeNull();
    });

    it('keeps a valid appearance as it is', () => {
        expect(parseAppearance(FULL)).toEqual(FULL);
    });

    it('fills every field of an empty object with the default', () => {
        expect(parseAppearance({})).toEqual(DEFAULT_APPEARANCE);
    });

    it.for<[string, Record<string, unknown>, Partial<PersonAppearance>]>([
        ['a bad frame', { frame: 'x' }, { frame: 'm' }],
        ['an unknown hair style', { hair: { style: 'mohawk', color: '#3b2a1e' } }, { hair: { style: 'buzzed', color: '#3b2a1e' } }],
        ['a short hex skin', { skin: '#fff' }, { skin: DEFAULT_APPEARANCE.skin }],
        ['a colour name for hair', { hair: { style: 'parted', color: 'brown' } }, { hair: { style: 'parted', color: DEFAULT_APPEARANCE.hair.color } }],
        ['an unknown facial hair', { facialHair: { style: 'goatee', color: '#3B2A1E' } }, { facialHair: { style: 'none', color: '#3B2A1E' } }],
        ['a NaN girth', { build: { ...FULL.build, girth: Number.NaN } }, { build: { ...FULL.build, girth: 0 } }],
        ['a string shoulders', { build: { ...FULL.build, shoulders: '1' } }, { build: { ...FULL.build, shoulders: 0 } }],
        ['an infinite wingspan', { build: { ...FULL.build, wingspan: Infinity } }, { build: { ...FULL.build, wingspan: 0 } }],
        ['an unknown pose', { pose: 'dunk' }, { pose: 'relaxed' }],
        ['a female-only cut, until the female body ships', { hair: { style: 'long', color: '#3b2a1e' } }, { hair: { style: 'buzzed', color: '#3b2a1e' } }],
    ])('defaults %s and keeps the rest', ([, change, expected]) => {
        expect(parseAppearance({ ...FULL, ...change })).toEqual({ ...FULL, ...expected });
    });

    it('clamps build sliders to -1..1', () => {
        expect(parseAppearance({ ...FULL, build: { girth: 2, shoulders: -3, wingspan: 0.5 } })?.build).toEqual({
            girth: 1,
            shoulders: -1,
            wingspan: 0.5,
        });
    });

    it('keeps only known, coloured, distinct accessories, at most four', () => {
        const parse = (accessories: unknown) => parseAppearance({ ...FULL, accessories })?.accessories;
        expect(parse('headband')).toEqual([]);
        expect(parse([{ id: 'cape', color: '#ffffff' }, { id: 'goggles', color: '#ffffff' }])).toEqual([
            { id: 'goggles', color: '#ffffff' },
        ]);
        expect(parse([{ id: 'goggles', color: 'red' }, 'glasses'])).toEqual([]);
        expect(parse([{ id: 'goggles', color: '#111111' }, { id: 'goggles', color: '#222222' }])).toEqual([
            { id: 'goggles', color: '#111111' },
        ]);
        const many = ['headband', 'armSleeve', 'goggles', 'glasses'].map((id) => ({ id, color: '#123456' }));
        expect(parse([...many, { id: 'headband', color: '#000000' }, { id: 'glasses', color: '#000000' }])).toEqual(many);
    });

    it('keeps a jersey number only when it is one', () => {
        expect(parseAppearance({ ...FULL, jerseyNumber: '00' })?.jerseyNumber).toBe('00');
        for (const jerseyNumber of ['07', 7, null, '']) {
            expect(parseAppearance({ ...FULL, jerseyNumber })).toEqual(without(FULL, 'jerseyNumber'));
        }
    });

    it('never copies unknown keys, at any level', () => {
        const parsed = parseAppearance({
            ...FULL,
            version: 3,
            secret: 'x',
            hair: { ...FULL.hair, extra: 1 },
            build: { ...FULL.build, height: 90 },
            accessories: [{ id: 'goggles', color: '#ffffff', size: 'xl' }],
        });
        expect(parsed).toEqual({ ...FULL, accessories: [{ id: 'goggles', color: '#ffffff' }] });
        expect(parsed?.version).toBe(1);
    });
});
