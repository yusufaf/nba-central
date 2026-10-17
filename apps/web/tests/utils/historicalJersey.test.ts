import { describe, it, expect } from 'vitest';
import historicalJerseysData from '@/assets/data/historicalJerseys.json';
import type { HistoricalJersey } from '@/models/types';
import { findHistoricalJersey, mediaIdFromJerseyUrl } from '@/utils/historicalJersey';

const rows = historicalJerseysData as HistoricalJersey[];

describe('mediaIdFromJerseyUrl', () => {
    it('takes the file stem of a CDN jersey URL', () => {
        expect(
            mediaIdFromJerseyUrl(
                'https://d2s6ea2hcvgd9x.cloudfront.net/jerseys/historical/31d308_d7be6e06a283493ea15be25ca7e6bd3a.avif',
            ),
        ).toBe('31d308_d7be6e06a283493ea15be25ca7e6bd3a');
    });

    it('returns null for an empty or non-id stem', () => {
        expect(mediaIdFromJerseyUrl('https://x/')).toBeNull();
        expect(mediaIdFromJerseyUrl('a/b-c.avif')).toBeNull();
    });
});

describe('findHistoricalJersey', () => {
    it('finds every bundled row by its unique media id', () => {
        const ids = rows.map((row) => mediaIdFromJerseyUrl(row.jersey));
        expect(ids.every((id) => id !== null)).toBe(true);
        expect(new Set(ids).size).toBe(rows.length);
        rows.forEach((row, i) => expect(findHistoricalJersey(ids[i]!)).toBe(row));
    });

    it('returns undefined for an unknown id', () => {
        expect(findHistoricalJersey('nope')).toBeUndefined();
    });
});
