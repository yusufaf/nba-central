import { describe, it, expect } from 'vitest';
import { gameLeaders } from '@/utils/gameLeaders';
import type { ESPNCompetitor } from '@/models/types';
import finalEvent from '../components/fixtures/scoreboard-event-final.json';
import scheduledEvent from '../components/fixtures/scoreboard-event-scheduled.json';

// Real ESPN scoreboard events: a finished game (2026-04-15) and a scheduled
// one whose competitors have no `leaders` yet (2026-10-21).
const competitorsOf = (event: unknown) =>
    (event as { competitions: { competitors: ESPNCompetitor[] }[] }).competitions[0].competitors;

describe('gameLeaders', () => {
    it("takes each team's overall (rating) leader, away team first", () => {
        const leaders = gameLeaders(competitorsOf(finalEvent));

        expect(leaders.map((l) => l?.teamId)).toEqual(
            [...competitorsOf(finalEvent)].reverse().map((c) => c.team.id),
        );
        expect(leaders[1]).toMatchObject({ name: 'T. Maxey', position: 'G', statline: '31 PTS, 6 AST' });
        expect(leaders[1]?.headshot).toMatch(/^https:\/\//);
    });

    it('has no leader for either team in a scheduled game with no leaders yet', () => {
        expect(gameLeaders(competitorsOf(scheduledEvent))).toEqual([null, null]);
    });

    // The card has no team label on a leader, only its side: a lone home
    // leader must stay on the home (right) side, not slide into the away slot.
    it('keeps each team in its own slot when only one has a leader', () => {
        const [home, away] = competitorsOf(finalEvent);

        const homeOnly = gameLeaders([home, { ...away, leaders: undefined }]);
        expect(homeOnly[0]).toBeNull();
        expect(homeOnly[1]?.teamId).toBe(home.team.id);

        const awayOnly = gameLeaders([{ ...home, leaders: undefined }, away]);
        expect(awayOnly[0]?.teamId).toBe(away.team.id);
        expect(awayOnly[1]).toBeNull();
    });

    it('treats empty leader lists like missing ones', () => {
        const [home, away] = competitorsOf(finalEvent);
        const emptyCategory = { ...home.leaders!.at(-1)!, leaders: [] };

        expect(gameLeaders([{ ...home, leaders: [] }, { ...away, leaders: [emptyCategory] }])).toEqual([null, null]);
    });

    it('leaves the position blank when ESPN omits it', () => {
        const [home, away] = competitorsOf(finalEvent);
        const rating = home.leaders!.at(-1)!;
        const top = rating.leaders[0];
        const noPosition = {
            ...home,
            leaders: [{ ...rating, leaders: [{ ...top, athlete: { ...top.athlete, position: undefined } }] }],
        } as unknown as ESPNCompetitor;

        expect(gameLeaders([noPosition, away])[1]?.position).toBe('');
    });
});
