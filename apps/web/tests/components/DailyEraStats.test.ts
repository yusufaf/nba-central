import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DailyEraStats from '@/components/DailyEra/DailyEraStats.vue';
import type { DailyEraStats as Stats } from '@/utils/dailyEra';

const stats: Stats = { played: 4, wins: 3, currentStreak: 2, bestStreak: 5, distribution: [2, 0, 1, 0] };

const mountStats = (props: Partial<{ stats: Stats; attempts: number | null; archive: boolean }> = {}) =>
    mount(DailyEraStats, { props: { stats, attempts: 3, archive: false, ...props } });

describe('DailyEraStats', () => {
    it('shows played, win rate, streak and best', () => {
        const w = mountStats();
        expect(w.find('[data-testid="stat-played"]').text()).toBe('4');
        expect(w.find('[data-testid="stat-win-rate"]').text()).toBe('75');
        expect(w.find('[data-testid="stat-streak"]').text()).toBe('2');
        expect(w.find('[data-testid="stat-best"]').text()).toBe('5');
    });

    it('shows a 0 win rate before any game is finished', () => {
        const w = mountStats({ stats: { ...stats, played: 0, wins: 0, distribution: [0, 0, 0, 0] } });
        expect(w.find('[data-testid="stat-win-rate"]').text()).toBe('0');
    });

    it("highlights this game's row in the distribution", () => {
        const rows = mountStats().findAll('[data-testid="distribution-bar"]');
        expect(rows).toHaveLength(4);
        expect(rows.map((r) => r.classes('bg-primary'))).toEqual([false, false, true, false]);
        expect(rows.map((r) => r.text())).toEqual(['2', '0', '1', '0']);

        const none = mountStats({ attempts: null }).findAll('[data-testid="distribution-bar"]');
        expect(none.some((r) => r.classes('bg-primary'))).toBe(false);
    });

    it('notes that an archive game leaves the streak alone', () => {
        const note = "Archive games don't count toward your streak.";
        expect(mountStats().text()).not.toContain(note);
        expect(mountStats({ archive: true }).text()).toContain(note);
    });
});
