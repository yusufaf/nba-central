import { describe, expect, it } from 'vitest';
import { cleanNumber, isJerseyNumber, rosterNumbers, swapNumbers, withNumber } from '@/utils/rosterNumbers';

describe('isJerseyNumber', () => {
    it.for(['0', '00', '7', '23', '99'])('accepts %s', (value) => {
        expect(isJerseyNumber(value)).toBe(true);
    });

    it.for(['07', '100', '-1', '', ' 7', '1a', 23, null, undefined].map((value) => ({ value })))(
        'rejects $value',
        ({ value }) => {
            expect(isJerseyNumber(value)).toBe(false);
        },
    );
});

describe('rosterNumbers', () => {
    it('keeps only valid numbers, by slot', () => {
        expect(
            rosterNumbers([
                { slot: 1, number: '23' },
                { slot: 2, number: '07' },
                { slot: 3, number: null },
                { slot: 4 },
                { slot: 5, number: 33 },
                { slot: 6, number: '00' },
            ]),
        ).toEqual({ 1: '23', 6: '00' });
    });
});

describe('withNumber', () => {
    it('adds, replaces and deletes without touching the original', () => {
        const start = { 1: '23' };
        expect(withNumber(start, 2, '7')).toEqual({ 1: '23', 2: '7' });
        expect(withNumber(start, 1, '24')).toEqual({ 1: '24' });
        expect(withNumber(start, 1, null)).toEqual({});
        expect(withNumber(start, 1, '')).toEqual({});
        expect(start).toEqual({ 1: '23' });
    });

    it('returns the same object when nothing changes', () => {
        const start = { 1: '23' };
        expect(withNumber(start, 1, '23')).toBe(start);
        expect(withNumber(start, 2, null)).toBe(start);
    });
});

describe('swapNumbers', () => {
    it('swaps two numbers', () => {
        expect(swapNumbers({ 1: '23', 2: '7' }, 1, 2)).toEqual({ 1: '7', 2: '23' });
    });

    it('moves a number to a slot without one', () => {
        expect(swapNumbers({ 1: '23' }, 1, 4)).toEqual({ 4: '23' });
    });

    it('returns the same object when neither slot has a number', () => {
        const start = { 3: '0' };
        expect(swapNumbers(start, 1, 2)).toBe(start);
    });
});

describe('cleanNumber', () => {
    it.for([
        ['23', '23'],
        ['00', '00'],
        ['0', '0'],
        ['07', '7'],
        ['070', '70'],
        ['234', '23'],
        ['2a', '2'],
        ['#7', '7'],
        ['', ''],
    ])('%s becomes "%s"', ([raw, cleaned]) => {
        expect(cleanNumber(raw)).toBe(cleaned);
    });

    it('only ever gives a jersey number or nothing', () => {
        for (let n = 0; n < 1000; n++) {
            for (const raw of [String(n), `0${n}`, `00${n}`]) {
                const cleaned = cleanNumber(raw);
                expect(cleaned === '' || isJerseyNumber(cleaned), `${raw} -> ${cleaned}`).toBe(true);
            }
        }
    });
});
