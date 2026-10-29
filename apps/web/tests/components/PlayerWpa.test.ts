import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PlayerWpa from '@/components/BoxScore/PlayerWpa.vue';
import type { ESPNCompetitor, ESPNPlay, ESPNTeamPlayers } from '@/models/types';
import { buildWpSeries } from '@/utils/winProbability';

// [clock, acting team, athlete, type, home score, away score, homeWp]
type Row = [string, 'H' | 'A' | null, string | null, string, number, number, number];

// h1 +0.27, a2 +0.20, a1 -0.05, h2 -0.07; home wins 5-3 after falling to 38%.
const ROWS: Row[] = [
    ['12:00', null, null, 'Jumpball', 0, 0, 0.5],
    ['11:00', 'H', 'h1', 'Jump Shot', 2, 0, 0.6],
    ['10:00', 'A', 'a1', 'Jump Shot', 2, 0, 0.65],
    ['9:00', 'A', 'a2', 'Jump Shot', 2, 3, 0.45],
    ['8:00', 'H', 'h2', 'Bad Pass Turnover', 2, 3, 0.38],
    ['7:00', 'H', 'h1', 'Jump Shot', 5, 3, 0.55],
];

const seriesOf = (rows: Row[]) =>
    buildWpSeries(
        rows.map(
            ([clock, team, athlete, type, home, away], i): ESPNPlay => ({
                id: `p${i}`,
                sequenceNumber: `${i}`,
                type: { id: '1', text: type },
                text: `Play ${i}`,
                homeScore: home,
                awayScore: away,
                period: { number: 1, displayValue: '1st Quarter' },
                clock: { displayValue: clock },
                team: team ? { id: team } : undefined,
                participants: athlete ? [{ athlete: { id: athlete } }] : undefined,
            }),
        ),
        rows.map(([, , , , , , homeWp], i) => ({ playId: `p${i}`, homeWinPercentage: homeWp, tiePercentage: 0 })),
        { homeId: 'H', awayId: 'A' },
    );

const team = (id: string, abbreviation: string, displayName: string, athletes: [string, string][]) =>
    ({
        team: { id, abbreviation, displayName, logo: `${abbreviation}.png` },
        statistics: [{ athletes: athletes.map(([athleteId, name]) => ({ athlete: { id: athleteId, displayName: name } })) }],
    }) as unknown as ESPNTeamPlayers;

// ESPN's boxscore lists away first.
const PLAYERS = [
    team('A', 'SA', 'San Antonio Spurs', [
        ['a1', 'Away One'],
        ['a2', 'Away Two'],
    ]),
    team('H', 'NY', 'New York Knicks', [
        ['h1', 'Home One'],
        ['h2', 'Home Two'],
    ]),
];

// The summary endpoint's header sends team.logo: null.
const COMPETITORS = [
    { homeAway: 'home', team: { id: 'H', abbreviation: 'NY', displayName: 'New York Knicks', logo: null } },
    { homeAway: 'away', team: { id: 'A', abbreviation: 'SA', displayName: 'San Antonio Spurs', logo: null } },
] as unknown as ESPNCompetitor[];

const mountCard = (props: Partial<{ series: ReturnType<typeof seriesOf>; players: ESPNTeamPlayers[]; final: boolean }> = {}) =>
    mount(PlayerWpa, {
        props: { series: seriesOf(ROWS), players: PLAYERS, competitors: COMPETITORS, final: true, ...props },
    });

describe('PlayerWpa', () => {
    it("lists each team's players by WPA, away first", () => {
        const wrapper = mountCard();
        const teams = wrapper.findAll('[data-testid="wpa-team"]');
        expect(teams.map((t) => t.find('h4').text())).toEqual(['San Antonio Spurs', 'New York Knicks']);
        const rows = (i: number) => teams[i].findAll('[data-testid="wpa-row"]').map((r) => r.text());
        expect(rows(0)).toEqual(['Away Two+20.0%', 'Away One−5.0%']);
        expect(rows(1)).toEqual(['Home One+27.0%', 'Home Two−7.0%']);
    });

    it('names the MVP and LVP and the comeback for a final game', () => {
        const wrapper = mountCard();
        expect(wrapper.get('[data-testid="wpa-mvp"]').text()).toContain('Home One');
        expect(wrapper.get('[data-testid="wpa-mvp"]').text()).toContain('+27.0%');
        expect(wrapper.get('[data-testid="wpa-lvp"]').text()).toContain('Home Two');
        expect(wrapper.get('[data-testid="wpa-comeback"]').text()).toContain('NY won after being down to 38%');
    });

    it('hides MVP, LVP and comeback while the game is live but keeps the tables and excitement', () => {
        const wrapper = mountCard({ final: false });
        expect(wrapper.find('[data-testid="wpa-mvp"]').exists()).toBe(false);
        expect(wrapper.find('[data-testid="wpa-lvp"]').exists()).toBe(false);
        expect(wrapper.find('[data-testid="wpa-comeback"]').exists()).toBe(false);
        expect(wrapper.findAll('[data-testid="wpa-row"]')).toHaveLength(4);
        // 0.10 + 0.05 + 0.20 + 0.07 + 0.17
        const excitement = wrapper.get('[data-testid="wpa-excitement"]').text();
        expect(excitement).toContain('0.6');
        // A partial game isn't comparable to a typical full one.
        expect(excitement).not.toContain('typical game');
        expect(mountCard({ final: true }).get('[data-testid="wpa-excitement"]').text()).toContain('typical game');
    });

    it('renders nothing for an empty series', () => {
        const wrapper = mountCard({ series: [] });
        expect(wrapper.find('[data-testid="wpa-team"]').exists()).toBe(false);
        expect(wrapper.text()).toBe('');
    });

    it("explains that players don't add up to the team", () => {
        expect(mountCard().text()).toContain("a team's players don't add up to its total");
    });

    it("falls back to 'Unknown player' when a team has no statistics", () => {
        const players = [{ ...PLAYERS[0], statistics: [] } as unknown as ESPNTeamPlayers, PLAYERS[1]];
        const rows = mountCard({ players })
            .findAll('[data-testid="wpa-team"]')[0]
            .findAll('[data-testid="wpa-row"]')
            .map((r) => r.text());
        expect(rows).toEqual(['Unknown player+20.0%', 'Unknown player−5.0%']);
    });

    it('shows each team logo from the boxscore when the header logo is null', () => {
        const logos = mountCard()
            .findAll('[data-testid="wpa-team"] img')
            .map((img) => img.attributes('src'));
        expect(logos).toEqual(['SA.png', 'NY.png']);
    });
});
