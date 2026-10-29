import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import WinProbabilityChart from '@/components/BoxScore/WinProbabilityChart.vue';
import type { WpPoint, WpSwing } from '@/utils/winProbability';

const point = (i: number, elapsed: number, homeWp: number, side: WpPoint['side'] = 'home'): WpPoint => ({
    playId: `p${i}`,
    elapsed,
    period: Math.min(5, Math.floor(elapsed / 720) + 1),
    clock: '6:00',
    text: `Play ${i}`,
    type: 'Jump Shot',
    scoring: false,
    homeScore: i,
    awayScore: 0,
    homeWp,
    side,
});

// A point every 360 s through one overtime (3180 s).
const SERIES = Array.from({ length: 9 }, (_, i) => point(i, Math.min(i * 360, 3180), 0.3 + i * 0.05, i % 2 ? 'away' : 'home'));
const swing = (rank: number, index: number): WpSwing => ({
    rank,
    index,
    point: SERIES[index],
    homeDelta: 0.05,
    actorDelta: 0.05,
});
const SWINGS = [swing(1, 4), swing(2, 2), swing(3, 7)];
const COLORS = { home: { fill: '#1d428a', ink: '#ffffff' }, away: { fill: '#c4ced4', ink: '#000000' } };

const mountChart = (props: Partial<InstanceType<typeof WinProbabilityChart>['$props']> = {}) =>
    mount(WinProbabilityChart, {
        props: {
            series: SERIES,
            swings: SWINGS,
            colors: COLORS,
            teams: { home: 'NY', away: 'SA' },
            periods: 5,
            activePlayId: null,
            ...props,
        },
    });

// The overlay sits 40 px into the svg and is 540 px wide, so a scrub that
// ignored the left gutter would land on the wrong play.
const PLOT_BOX = { left: 40, width: 540, top: 0, height: 192, right: 580, bottom: 192, x: 40, y: 0 };

const scrubber = (wrapper: ReturnType<typeof mountChart>) => {
    const rect = wrapper.find('.wp-scrub');
    (rect.element as Element).getBoundingClientRect = () => PLOT_BOX as DOMRect;
    return rect;
};

const at = (elapsed: number, total = 3180) => PLOT_BOX.left + (PLOT_BOX.width * elapsed) / total;

// VTU's trigger can't set clientX on a PointerEvent (it lives on
// MouseEvent's prototype), so dispatch one directly.
const fire = async (
    wrapper: ReturnType<typeof mountChart>,
    type: string,
    init: PointerEventInit = {},
) => {
    wrapper.find('.wp-scrub').element.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }));
    await wrapper.vm.$nextTick();
};

describe('WinProbabilityChart', () => {
    it('draws both areas and lines, the period gridlines and labels, and the swing dots', () => {
        const wrapper = mountChart();
        const areas = wrapper.findAll('[data-testid="wp-area"]');
        const lines = wrapper.findAll('[data-testid="wp-line"]');
        expect(areas).toHaveLength(2);
        expect(lines).toHaveLength(2);
        for (const path of [...areas, ...lines]) expect(path.attributes('d')).toMatch(/^M/);

        expect(wrapper.findAll('[data-testid="wp-gridline"]')).toHaveLength(4);
        const labels = wrapper.findAll('.wp-label').map((t) => t.text());
        expect(labels).toEqual(expect.arrayContaining(['Q1', 'Q2', 'Q3', 'Q4', 'OT']));

        const dots = wrapper.findAll('[data-testid="wp-swing"]');
        expect(dots.map((d) => d.text())).toEqual(['1', '2', '3']);
        expect(dots[0].find('circle').attributes('fill')).toBe(COLORS.home.fill);
        expect(dots[1].find('circle').attributes('fill')).toBe(COLORS.home.fill);
        expect(dots[2].find('circle').attributes('fill')).toBe(COLORS.away.fill);
    });

    it('marks the selected swing and shows its tooltip without a pointer', () => {
        const wrapper = mountChart({ activePlayId: 'p2' });
        const dots = wrapper.findAll('[data-testid="wp-swing"]');
        expect(dots[1].attributes('data-active')).toBeDefined();
        expect(dots[0].attributes('data-active')).toBeUndefined();
        expect(wrapper.find('[data-testid="wp-tooltip"]').text()).toContain('Play 2');
    });

    it('paints the scrub overlay last', () => {
        const svg = mountChart().find('svg').element;
        expect(svg.lastElementChild?.classList.contains('wp-scrub')).toBe(true);
    });

    it('maps the pointer across the plot, not the whole svg', async () => {
        const wrapper = mountChart();
        scrubber(wrapper);

        await fire(wrapper, 'pointermove', { clientX: at(1450) });
        expect(wrapper.find('[data-testid="wp-tooltip"]').text()).toContain('Play 4');

        await fire(wrapper, 'pointermove', { clientX: 30 });
        expect(wrapper.find('[data-testid="wp-tooltip"]').text()).toContain('Play 0');

        await fire(wrapper, 'pointerleave');
        expect(wrapper.find('[data-testid="wp-tooltip"]').exists()).toBe(false);
    });

    it('hides the tooltip when a touch lifts but not after a mouse click', async () => {
        const wrapper = mountChart();
        scrubber(wrapper);

        await fire(wrapper, 'pointermove', { clientX: at(1450) });
        await fire(wrapper, 'pointerup', { pointerType: 'mouse' });
        expect(wrapper.find('[data-testid="wp-tooltip"]').exists()).toBe(true);

        await fire(wrapper, 'pointerup', { pointerType: 'touch' });
        expect(wrapper.find('[data-testid="wp-tooltip"]').exists()).toBe(false);
    });

    it('keeps the hovered play when a live update inserts an earlier one', async () => {
        const wrapper = mountChart();
        scrubber(wrapper);
        await fire(wrapper, 'pointermove', { clientX: at(1450) });
        expect(wrapper.find('[data-testid="wp-tooltip"]').text()).toContain('Play 4');

        const late = { ...point(99, 500, 0.4), text: 'Late play' };
        await wrapper.setProps({ series: [...SERIES.slice(0, 2), late, ...SERIES.slice(2)] });
        expect(wrapper.find('[data-testid="wp-tooltip"]').text()).toContain('Play 4');
    });

    it('shows nothing over the unplayed part of a live game', async () => {
        const live = SERIES.slice(0, 6).map((p, i) => ({ ...p, elapsed: i * 400 }));
        const wrapper = mountChart({ series: live, swings: [], periods: 4 });
        scrubber(wrapper);

        await fire(wrapper, 'pointermove', { clientX: at(0.95 * 2880, 2880) });
        expect(wrapper.find('[data-testid="wp-tooltip"]').exists()).toBe(false);

        await fire(wrapper, 'pointermove', { clientX: at(2000 + 0.01 * 2880, 2880) });
        expect(wrapper.find('[data-testid="wp-tooltip"]').text()).toContain('Play 5');
    });
});
