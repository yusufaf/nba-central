import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import WinProbabilityCard from '@/components/BoxScore/WinProbabilityCard.vue';
import type { ESPNGameSummary } from '@/models/types';

type State = 'pre' | 'in' | 'post';

// [homeWp, acting team] per play, a minute apart in Q1.
type Row = [number, 'H' | 'A'];

const summary = (rows: Row[], state: State = 'post', withWp = true): ESPNGameSummary =>
    ({
        header: {
            competitions: [
                {
                    status: { type: { state, completed: state === 'post' } },
                    competitors: [
                        { homeAway: 'home', team: { id: 'H', abbreviation: 'NY', color: '1d428a', alternateColor: 'f58426' } },
                        { homeAway: 'away', team: { id: 'A', abbreviation: 'SA', color: '000000', alternateColor: 'c4ced4' } },
                    ],
                },
            ],
        },
        plays: rows.map(([, team], i) => ({
            id: `p${i}`,
            sequenceNumber: `${i}`,
            type: { id: '1', text: 'Jump Shot' },
            text: `Play ${i}`,
            period: { number: 1, displayValue: '1st Quarter' },
            clock: { displayValue: `${11 - i}:00` },
            team: { id: team },
        })),
        winprobability: withWp
            ? rows.map(([homeWp], i) => ({ playId: `p${i}`, homeWinPercentage: homeWp, tiePercentage: 0 }))
            : [],
    }) as unknown as ESPNGameSummary;

// Swings of 0.10, 0.05, 0.20, 0.03 and 0.02.
const ROWS: Row[] = [
    [0.5, 'H'],
    [0.6, 'H'],
    [0.55, 'A'],
    [0.75, 'H'],
    [0.72, 'A'],
    [0.74, 'H'],
];

const pressed = (wrapper: ReturnType<typeof mount>) =>
    wrapper
        .findAll('[data-testid="wp-play"]')
        .filter((row) => row.attributes('aria-pressed') === 'true')
        .map((row) => row.text());

describe('WinProbabilityCard', () => {
    it('shows the chart, the biggest plays and the credit for a finished game', () => {
        const wrapper = mount(WinProbabilityCard, { props: { gameSummary: summary(ROWS) } });
        expect(wrapper.find('svg').exists()).toBe(true);
        expect(wrapper.findAll('[data-testid="wp-play"]')).toHaveLength(5);
        expect(wrapper.text()).toContain('Win probability: ESPN Analytics');
        expect(wrapper.find('[data-testid="wp-live"]').exists()).toBe(false);
    });

    it("shows each team's current WP while live", () => {
        const wrapper = mount(WinProbabilityCard, { props: { gameSummary: summary(ROWS, 'in') } });
        const live = wrapper.find('[data-testid="wp-live"]').text();
        expect(live).toContain('NY 74%');
        expect(live).toContain('SA 26%');
    });

    it.each<[string, ESPNGameSummary]>([
        ['a scheduled game', summary(ROWS, 'pre')],
        ['a game without WP data', summary(ROWS, 'post', false)],
        ['a single WP point', summary(ROWS.slice(0, 1))],
    ])('renders nothing for %s', (_, gameSummary) => {
        const wrapper = mount(WinProbabilityCard, { props: { gameSummary } });
        expect(wrapper.find('svg').exists()).toBe(false);
        expect(wrapper.text()).toBe('');
    });

    it('keeps the selected play across live updates until it leaves the top five', async () => {
        const wrapper = mount(WinProbabilityCard, { props: { gameSummary: summary(ROWS, 'in') } });
        // Rank 2 is Play 1 (+0.10).
        await wrapper.findAll('[data-testid="wp-play"]')[1].trigger('click');
        expect(pressed(wrapper)).toEqual([expect.stringContaining('Play 1')]);
        const active = () => wrapper.findAll('[data-testid="wp-swing"]').filter((d) => d.attributes('data-active') !== undefined);
        expect(active().map((d) => d.text())).toEqual(['2']);

        // A bigger swing arrives: Play 1 drops to rank 3 but stays selected.
        await wrapper.setProps({ gameSummary: summary([...ROWS, [0.3, 'A']], 'in') });
        expect(pressed(wrapper)).toEqual([expect.stringContaining('Play 1')]);
        expect(active().map((d) => d.text())).toEqual(['3']);

        // Five bigger swings push it out of the list.
        const bigger: Row[] = [[0.9, 'H'], [0.3, 'A'], [0.9, 'H'], [0.3, 'A'], [0.9, 'H']];
        await wrapper.setProps({ gameSummary: summary([...ROWS, ...bigger], 'in') });
        expect(pressed(wrapper)).toEqual([]);
        expect(active()).toHaveLength(0);
    });
});
