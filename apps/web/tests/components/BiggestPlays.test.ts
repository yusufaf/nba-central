import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BiggestPlays from '@/components/BoxScore/BiggestPlays.vue';
import type { WpSwing } from '@/utils/winProbability';

const swing = (rank: number, side: 'home' | 'away', actorDelta: number): WpSwing => ({
    rank,
    index: rank,
    homeDelta: side === 'home' ? actorDelta : -actorDelta,
    actorDelta,
    point: {
        playId: `p${rank}`,
        elapsed: rank * 100,
        period: 4,
        clock: '1:16',
        text: `Play ${rank}`,
        type: 'Jump Shot',
        scoring: false,
        homeScore: 0,
        awayScore: 0,
        homeWp: 0.5,
        side,
    },
});

const SWINGS = [swing(1, 'home', 0.09), swing(2, 'away', -0.093), swing(3, 'home', 0.04)];
const COLORS = { home: { fill: '#1d428a', ink: '#ffffff' }, away: { fill: '#c4ced4', ink: '#000000' } };

const mountList = (activePlayId: string | null = null) =>
    mount(BiggestPlays, {
        props: { swings: SWINGS, colors: COLORS, teams: { home: 'NY', away: 'SA' }, activePlayId },
    });

describe('BiggestPlays', () => {
    it('lists the swings in rank order with signed chips for the acting team', () => {
        const rows = mountList().findAll('[data-testid="wp-play"]');
        expect(rows.map((r) => r.text())).toEqual([
            expect.stringMatching(/^1\s*Play 1\s*Q4 · 1:16\s*NY\s*\+9\.0%$/),
            expect.stringMatching(/^2\s*Play 2\s*Q4 · 1:16\s*SA\s*−9\.3%$/),
            expect.stringMatching(/^3\s*Play 3/),
        ]);
    });

    it('selects a row, and deselects it when tapped again', async () => {
        const wrapper = mountList();
        await wrapper.findAll('[data-testid="wp-play"]')[1].trigger('click');
        expect(wrapper.emitted('select')).toEqual([['p2']]);

        const selected = mountList('p2');
        const row = selected.findAll('[data-testid="wp-play"]')[1];
        expect(row.attributes('aria-pressed')).toBe('true');
        await row.trigger('click');
        expect(selected.emitted('select')).toEqual([[null]]);
    });
});
