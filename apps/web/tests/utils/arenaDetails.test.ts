import { describe, it, expect } from 'vitest';
import { arenaDetails, backfillArena, parseCapacity } from '@/utils/arenaDetails';

describe('parseCapacity', () => {
    it("reads arenas.json's comma-grouped strings and passes numbers through", () => {
        expect(parseCapacity('19,200')).toBe(19200);
        expect(parseCapacity(18600)).toBe(18600);
    });

    it('treats empty, missing and unreadable values as no capacity', () => {
        for (const value of ['', 'n/a', null, undefined, Number.NaN]) {
            expect(parseCapacity(value)).toBeUndefined();
        }
    });
});

describe('arenaDetails', () => {
    it('joins the city, capacity and opened year', () => {
        expect(
            arenaDetails({ location: 'Seattle, Washington', capacity: 18600, openedYear: 2026 }),
        ).toBe('Seattle, Washington · 18,600 · opened 2026');
        expect(arenaDetails({ location: 'Dallas, Texas', capacity: '19,200', openedYear: 2001 })).toBe(
            'Dallas, Texas · 19,200 · opened 2001',
        );
    });

    it('leaves out what an arena does not have', () => {
        expect(arenaDetails({ location: '', capacity: null, openedYear: 1999 })).toBe('opened 1999');
        expect(arenaDetails({})).toBe('');
    });
});

describe('backfillArena', () => {
    it('fills a legacy built-in ref from arenas.json by exact name', () => {
        expect(backfillArena({ name: 'Ball Arena' })).toMatchObject({
            name: 'Ball Arena',
            location: 'Denver, Colorado',
            openedYear: 1999,
        });
        expect(backfillArena({ name: 'ball arena' })).toEqual({ name: 'ball arena' });
    });

    it('passes null and custom arenas through', () => {
        expect(backfillArena(null)).toBeNull();
        expect(backfillArena({ name: 'Ball Arena', isCustom: true })).toEqual({
            name: 'Ball Arena',
            isCustom: true,
        });
    });
});
