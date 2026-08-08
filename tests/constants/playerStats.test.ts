import { describe, it, expect } from 'vitest';
import {
  formatSeason,
  formatCellValue,
  careerAverages,
  careerTotals,
} from '@/constants/playerStats';

describe('playerStats helpers', () => {
  describe('formatSeason', () => {
    it('formats season start year to standard NBA format YYYY-YY by default', () => {
      expect(formatSeason(2010)).toBe('2010-11');
      expect(formatSeason(2019)).toBe('2019-20');
      expect(formatSeason(1999)).toBe('1999-00');
      expect(formatSeason(2009)).toBe('2009-10');
    });

    it('formats season to full range YYYY-YYYY', () => {
      expect(formatSeason(2010, 'YYYY-YYYY')).toBe('2010-2011');
      expect(formatSeason(2019, 'YYYY-YYYY')).toBe('2019-2020');
    });

    it('formats season to start year YYYY', () => {
      expect(formatSeason(2010, 'YYYY')).toBe('2010');
    });

    it('formats season to end year YYYY+1', () => {
      expect(formatSeason(2010, 'YYYY+1')).toBe('2011');
    });

    it('preserves already formatted strings or invalid input', () => {
      expect(formatSeason('2010-11')).toBe('2010-11');
      expect(formatSeason(null)).toBe('—');
      expect(formatSeason(undefined)).toBe('—');
    });
  });

  describe('formatCellValue', () => {
    const mockRow = {
      season: 2010,
      games_played: 81,
      min: 17.9,
      pts: 5.6,
      fg_pct: 0.394,
    };

    it('formats season field according to preference', () => {
      expect(formatCellValue('season', mockRow, 'YYYY-YY')).toBe('2010-11');
      expect(formatCellValue('season', mockRow, 'YYYY')).toBe('2010');
    });

    it('formats per_game counting stats and percentages', () => {
      expect(formatCellValue('pts', mockRow, 'YYYY-YY', 'per_game')).toBe('5.6');
      expect(formatCellValue('fg_pct', mockRow, 'YYYY-YY', 'per_game')).toBe('.394');
    });

    it('formats totals mode counting stats', () => {
      expect(formatCellValue('pts', mockRow, 'YYYY-YY', 'totals')).toBe('454');
      expect(formatCellValue('fg_pct', mockRow, 'YYYY-YY', 'totals')).toBe('.394');
    });
  });

  describe('careerTotals', () => {
    it('calculates total career counting stats accurately', () => {
      const mockSeasons = [
        { season: 2010, games_played: 81, pts: 5.6, fgm: 2, fga: 5, fg_pct: 0.4 },
        { season: 2011, games_played: 66, pts: 6.0, fgm: 2.3, fga: 5.5, fg_pct: 0.418 },
      ] as any[];

      const totals = careerTotals(mockSeasons);
      expect(totals).not.toBeNull();
      expect(totals?.games_played).toBe(147);
      expect(totals?.seasons).toBe(2);
      expect(totals?.pts).toBe(850);
    });
  });
});
