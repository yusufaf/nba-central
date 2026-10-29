import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AdvancedStats from '@/components/BoxScore/AdvancedStats.vue';
import type { ESPNCompetitor, ESPNGameSummary } from '@/models/types';
import type { WpPoint } from '@/utils/winProbability';

const NAMES = ['FG', '+/-', 'PTS', 'REB', 'AST'];

const team = (id: string, athleteId: string, name: string, plusMinus: string) => ({
    team: { id, abbreviation: id, displayName: `Team ${id}`, logo: `${id}.png` },
    statistics: [
        {
            names: NAMES,
            athletes: [{ athlete: { id: athleteId, displayName: name }, starter: true, stats: ['6-10', plusMinus, '14', '5', '3'] }],
        },
    ],
});

const BOXSCORE = { players: [team('A', 'a1', 'Away One', '-4'), team('H', 'h1', 'Home One', '+4')] } as unknown as NonNullable<
    ESPNGameSummary['boxscore']
>;

const point = (playId: string, elapsed: number, homeWp: number, side: 'home' | 'away' | null, athlete?: string): WpPoint => ({
    playId,
    elapsed,
    period: 1,
    clock: '',
    text: '',
    type: 'Jump Shot',
    scoring: false,
    homeScore: 0,
    awayScore: 0,
    homeWp,
    side,
    participants: athlete ? [athlete] : [],
});

const headings = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('h2, h3').map((h) => h.text());

describe('AdvancedStats', () => {
    it('renders the existing cards and no WPA card without series', () => {
        const wrapper = mount(AdvancedStats, { props: { boxscore: BOXSCORE } });
        const text = wrapper.text();
        expect(text).toContain('Plus/Minus Leaders');
        expect(text).toContain('Shooting Efficiency');
        expect(text).toContain('Bench Production');
        expect(text).not.toContain('Win Probability Added');
    });

    it('puts the WPA card first when given a series', () => {
        const competitors = [
            { homeAway: 'home', team: { id: 'H', abbreviation: 'H', displayName: 'Team H' } },
            { homeAway: 'away', team: { id: 'A', abbreviation: 'A', displayName: 'Team A' } },
        ] as unknown as ESPNCompetitor[];
        const series = [point('0', 0, 0.5, null), point('1', 60, 0.6, 'home', 'h1')];
        const wrapper = mount(AdvancedStats, { props: { boxscore: BOXSCORE, series, competitors, final: false } });
        expect(headings(wrapper)[0]).toBe('Win Probability Added');
        expect(wrapper.text()).toContain('Home One');
    });
});
