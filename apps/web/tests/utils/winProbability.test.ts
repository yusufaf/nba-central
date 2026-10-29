import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ESPNGameSummary, ESPNPlay, ESPNWinProbability } from '@/models/types';
import {
    BIG_SWING,
    THEME_HEX,
    actorSwings,
    biggestSwings,
    buildWpSeries,
    comeback,
    elapsedSeconds,
    excitement,
    formatDelta,
    formatWp,
    gameLength,
    isBigSwing,
    parseClock,
    periodLabel,
    pickWpColors,
    playerWpa,
    pointIndexAt,
    summaryWpSeries,
    swingByPlayId,
    wpDelta,
    type WpPoint,
} from '@/utils/winProbability';

const TEAMS = { homeId: 'H', awayId: 'A' };

interface PlayInput {
    id: string;
    period?: number;
    clock?: string;
    text?: string;
    type?: string;
    team?: 'H' | 'A';
    home?: number;
    away?: number;
    scoring?: boolean;
    // true gives athlete '1'; an array gives those ids.
    participants?: boolean | string[];
}

const play = ({
    id,
    period = 1,
    clock = '10:00',
    text = `play ${id}`,
    type = 'Jump Shot',
    team,
    home,
    away,
    scoring,
    participants = team !== undefined,
}: PlayInput): ESPNPlay => ({
    id,
    sequenceNumber: id,
    type: { id: '1', text: type },
    text,
    homeScore: home,
    awayScore: away,
    period: { number: period, displayValue: periodLabel(period) },
    clock: { displayValue: clock },
    scoringPlay: scoring,
    team: team ? { id: team } : undefined,
    participants:
        participants === true
            ? [{ athlete: { id: '1' } }]
            : participants
              ? participants.map((athleteId) => ({ athlete: { id: athleteId } }))
              : undefined,
});

const wp = (playId: string, home: number): ESPNWinProbability => ({
    playId,
    homeWinPercentage: home,
    tiePercentage: 0,
});

// Builds a series from [play, homeWp] pairs.
const seriesOf = (rows: [PlayInput, number][]) =>
    buildWpSeries(
        rows.map(([p]) => play(p)),
        rows.map(([p, home]) => wp(p.id, home)),
        TEAMS,
    );

describe('parseClock', () => {
    it.each<[string, number | null]>([
        ['5:12', 312],
        ['34.2', 34.2],
        ['0.0', 0],
        ['12:00', 720],
        ['', null],
        ['abc', null],
    ])('%s -> %s', (clock, seconds) => {
        expect(parseClock(clock)).toBe(seconds);
    });
});

describe('elapsedSeconds, gameLength and periodLabel', () => {
    it.each<[number, string, number]>([
        [1, '12:00', 0],
        [1, '5:12', 408],
        [4, '0.0', 2880],
        [5, '5:00', 2880],
        [5, '2:30', 3030],
        [6, '0.0', 3480],
    ])('period %i at %s is %i s in', (period, clock, elapsed) => {
        expect(elapsedSeconds(period, clock)).toBe(elapsed);
    });

    it('counts 720 s quarters and 300 s overtimes', () => {
        expect(gameLength(4)).toBe(2880);
        expect(gameLength(5)).toBe(3180);
        expect(gameLength(2)).toBe(2880);
    });

    it('labels quarters and overtimes like the play-by-play', () => {
        expect(periodLabel(1)).toBe('Q1');
        expect(periodLabel(5)).toBe('OT');
        expect(periodLabel(6)).toBe('OT2');
    });
});

describe('buildWpSeries', () => {
    it('follows plays[] order and joins WP by playId, not sequence order', () => {
        const plays = [
            play({ id: '27', clock: '10:30' }),
            play({ id: '94', clock: '10:02' }),
            play({ id: '29', clock: '9:45' }),
        ];
        const series = buildWpSeries(plays, [wp('27', 0.5), wp('29', 0.7), wp('94', 0.6)], TEAMS);
        expect(series.map((p) => p.playId)).toEqual(['27', '94', '29']);
        expect(series.map((p) => p.homeWp)).toEqual([0.5, 0.6, 0.7]);
        expect(series.map((p) => p.elapsed)).toEqual([90, 118, 135]);
    });

    it('carries participant ids in order', () => {
        const [point] = seriesOf([[{ id: '1', team: 'H', participants: ['h1', 'h2'] }, 0.5]]);
        expect(point.participants).toEqual(['h1', 'h2']);
    });

    it('gives [] for a play with no participants', () => {
        const [point] = seriesOf([[{ id: '1' }, 0.5]]);
        expect(point.participants).toEqual([]);
    });

    it('skips a play with no WP entry and ignores an entry with no play', () => {
        const plays = [play({ id: '1' }), play({ id: '2' }), play({ id: '3' })];
        const series = buildWpSeries(plays, [wp('1', 0.5), wp('3', 0.6), wp('99', 0.9)], TEAMS);
        expect(series.map((p) => p.playId)).toEqual(['1', '3']);
    });

    it('skips a play with an unparsable clock', () => {
        const series = seriesOf([
            [{ id: '1' }, 0.5],
            [{ id: '2', clock: '' }, 0.6],
        ]);
        expect(series.map((p) => p.playId)).toEqual(['1']);
    });

    it('drops exact repeats but keeps free throws whose score changes', () => {
        const turnover = { clock: '10:00', text: 'Bad pass turnover', team: 'A' as const, home: 2, away: 0 };
        const ft = { period: 2, clock: '9:46', text: 'Norman Powell makes technical free throw', team: 'H' as const };
        const series = seriesOf([
            [{ id: '1', ...turnover }, 0.5],
            [{ id: '2', ...turnover }, 0.5],
            [{ id: '3', ...ft, home: 27, away: 36 }, 0.824],
            [{ id: '4', ...ft, home: 28, away: 36 }, 0.802],
            [{ id: '5', ...ft, home: 29, away: 36 }, 0.782],
        ]);
        expect(series.map((p) => p.playId)).toEqual(['1', '3', '4', '5']);
    });

    it('drops a repeat with another play between, keeping the first copy that has WP', () => {
        const at = { clock: '6:25', home: 17, away: 0 };
        const rebound = { ...at, text: 'Trail Blazers offensive team rebound', team: 'A' as const };
        const plays = [
            play({ id: '1', ...at, text: 'Deni Avdija misses free throw 1 of 2', team: 'A' }),
            play({ id: '2', ...rebound }),
            play({ id: '3', ...rebound }),
            play({ id: '4', ...at, text: 'Deni Avdija misses free throw 2 of 2', team: 'A' }),
            play({ id: '5', ...rebound }),
        ];
        // Play 2 has no WP entry, so play 3 stands in for it; play 5 is a repeat.
        const series = buildWpSeries(plays, [wp('1', 0.9), wp('3', 0.9), wp('4', 0.907), wp('5', 0.4)], TEAMS);
        expect(series.map((p) => p.playId)).toEqual(['1', '3', '4']);
    });

    it('carries the score forward when a play omits it', () => {
        const series = seriesOf([
            [{ id: '1' }, 0.5],
            [{ id: '2', home: 3, away: 0 }, 0.55],
            [{ id: '3' }, 0.56],
        ]);
        expect(series.map((p) => [p.homeScore, p.awayScore])).toEqual([
            [0, 0],
            [3, 0],
            [3, 0],
        ]);
    });

    it('marks the acting side', () => {
        const side = (input: Omit<PlayInput, 'id'>) => seriesOf([[{ id: '1', ...input }, 0.5]])[0].side;
        expect(side({ team: 'H', type: 'Jump Shot' })).toBe('home');
        expect(side({ team: 'A', type: 'Bad Pass Turnover' })).toBe('away');
        expect(side({ team: 'H', type: 'Defensive Team Rebound', participants: false })).toBe('home');
        expect(side({ team: 'A', type: 'Double Dribble Turnover' })).toBe('away');
        for (const type of [
            'Substitution',
            'Full Timeout',
            "Coach's Challenge (Stands)",
            'Double Personal Foul',
            'Double Technical Foul',
            'Jumpball',
        ]) {
            expect(side({ team: 'H', type }), type).toBeNull();
        }
        expect(side({ type: 'End Period' })).toBeNull();
        expect(side({ type: 'Ref-Initiated Review (Overturned)' })).toBeNull();
    });

    it('keeps elapsed time non-decreasing through two overtimes', () => {
        const rows: [PlayInput, number][] = [];
        for (let period = 1; period <= 6; period++) {
            for (const clock of period <= 4 ? ['12:00', '6:00', '0.0'] : ['5:00', '2:30', '0.0']) {
                rows.push([{ id: `${period}-${clock}`, period, clock }, 0.5]);
            }
        }
        const elapsed = seriesOf(rows).map((p) => p.elapsed);
        expect(elapsed).toEqual([...elapsed].sort((a, b) => a - b));
        expect(elapsed.at(-1)).toBe(3480);
    });
});

describe('summaryWpSeries', () => {
    const competitor = (homeAway: 'home' | 'away', id: string) => ({ homeAway, team: { id } });
    const summary = (competitors: ReturnType<typeof competitor>[]) =>
        ({
            header: { competitions: [{ competitors }] },
            plays: [play({ id: '1', team: 'H' }), play({ id: '2', clock: '9:00', team: 'A' })],
            winprobability: [wp('1', 0.5), wp('2', 0.4)],
        }) as unknown as ESPNGameSummary;

    it('builds the series with the header teams', () => {
        const series = summaryWpSeries(summary([competitor('home', 'H'), competitor('away', 'A')]));
        expect(series.map((p) => p.side)).toEqual(['home', 'away']);
    });

    it('returns [] without both competitors', () => {
        expect(summaryWpSeries(summary([competitor('home', 'H')]))).toEqual([]);
        expect(summaryWpSeries({} as ESPNGameSummary)).toEqual([]);
    });
});

describe('actorSwings', () => {
    it('keeps zero swings that biggestSwings drops', () => {
        const series = seriesOf([
            [{ id: '0', clock: '12:00', team: 'H' }, 0.5],
            [{ id: '1', clock: '11:00', team: 'A' }, 0.5],
            [{ id: '2', clock: '10:00', team: 'H' }, 0.55],
        ]);
        expect(actorSwings(series).map((s) => s.point.playId)).toEqual(['1', '2']);
        expect(biggestSwings(series, 5).map((s) => s.point.playId)).toEqual(['2']);
    });
});

describe('wpDelta', () => {
    it('gives the home-side change from the previous point', () => {
        const series = seriesOf([
            [{ id: '1' }, 0.5],
            [{ id: '2' }, 0.6],
            [{ id: '3' }, 0.45],
        ]);
        expect(wpDelta(series).map((d) => Number(d.toFixed(2)))).toEqual([0, 0.1, -0.15]);
    });
});

describe('biggestSwings', () => {
    const deltas = (swings: ReturnType<typeof biggestSwings>) =>
        swings.map((s) => [s.point.playId, Number(s.homeDelta.toFixed(3))]);

    it('ranks actor plays by the size of their swing', () => {
        const series = seriesOf([
            [{ id: '0', clock: '12:00' }, 0.5],
            [{ id: '1', clock: '11:00', team: 'H' }, 0.55],
            [{ id: '2', clock: '10:00', type: 'Full Timeout', team: 'A' }, 0.8],
            [{ id: '3', clock: '9:00', team: 'A' }, 0.6],
            [{ id: '4', clock: '8:00', team: 'H' }, 0.63],
        ]);
        const swings = biggestSwings(series, 5);
        // The timeout's +25% is not a candidate.
        expect(deltas(swings)).toEqual([
            ['3', -0.2],
            ['1', 0.05],
            ['4', 0.03],
        ]);
        expect(swings.map((s) => s.rank)).toEqual([1, 2, 3]);
    });

    it('signs actorDelta from the acting team', () => {
        const series = seriesOf([
            [{ id: '0', clock: '12:00' }, 0.5],
            [{ id: '1', clock: '11:00', team: 'H', type: 'Jump Shot' }, 0.6],
            [{ id: '2', clock: '10:00', team: 'A', type: 'Free Throw - 1 of 2' }, 0.62],
        ]);
        const [make, miss] = biggestSwings(series, 5);
        expect(make.actorDelta).toBeCloseTo(0.1);
        expect(miss.actorDelta).toBeCloseTo(-0.02);
    });

    it('breaks ties by the earlier play, caps at n and never counts the first point', () => {
        const series = seriesOf([
            [{ id: '0', clock: '12:00', team: 'H' }, 0.5],
            [{ id: '1', clock: '11:00', team: 'H' }, 0.6],
            [{ id: '2', clock: '10:00', team: 'A' }, 0.5],
            [{ id: '3', clock: '9:00', team: 'A' }, 0.48],
        ]);
        expect(biggestSwings(series, 2).map((s) => s.point.playId)).toEqual(['1', '2']);
        expect(biggestSwings(series, 10)).toHaveLength(3);
    });

    it('measures a play after a challenge from before the challenge', () => {
        const at = { period: 4, clock: '1:16' };
        const series = seriesOf([
            [{ id: '0', period: 4, clock: '1:30', team: 'H' }, 0.6],
            [{ id: '1', ...at, team: 'H', type: 'Shooting Foul' }, 0.55],
            [{ id: '2', ...at, team: 'A', type: 'Free Throw - 1 of 2', home: 0, away: 1 }, 0.27],
            [{ id: '3', ...at, team: 'H', type: 'Full Timeout' }, 0.27],
            [{ id: '4', ...at, team: 'H', type: "Coach's Challenge (Stands)" }, 0.62],
            [{ id: '5', ...at, team: 'A', type: 'Free Throw - 2 of 2', home: 0, away: 2 }, 0.34],
        ]);
        const byId = Object.fromEntries(deltas(biggestSwings(series, 10)));
        expect(byId['5']).toBe(0.07);
        expect(byId['2']).toBe(-0.28);
    });

    describe('an overturned call', () => {
        const rows = (challenge: string): [PlayInput, number][] => [
            [{ id: '0', period: 4, clock: '4:30', team: 'H', type: 'Bad Pass Turnover' }, 0.3],
            [{ id: '1', period: 4, clock: '4:22', team: 'A', type: 'Loose Ball Foul' }, 0.495],
            [{ id: '2', period: 4, clock: '4:22', team: 'H', type: 'Challenge' }, 0.387],
            [{ id: '3', period: 4, clock: '4:22', team: 'H', type: challenge }, 0.387],
            [{ id: '4', period: 4, clock: '4:22', team: 'A', type: 'Bad Pass Turnover' }, 0.387],
        ];

        it('drops the reversed call and measures the next play from before it', () => {
            const swings = biggestSwings(seriesOf(rows("Coach's Challenge (Overturned)")), 10);
            expect(swings.map((s) => s.point.playId)).not.toContain('1');
            const turnover = swings.find((s) => s.point.playId === '4')!;
            expect(turnover.homeDelta).toBeCloseTo(0.087);
            expect(turnover.actorDelta).toBeCloseTo(-0.087);
        });

        it('keeps the call when the challenge fails', () => {
            const swings = biggestSwings(seriesOf(rows("Coach's Challenge (Stands)")), 10);
            expect(swings.find((s) => s.point.playId === '1')?.homeDelta).toBeCloseTo(0.195);
        });

        it('keeps plays that stood at the same moment', () => {
            const series = seriesOf([
                [{ id: '0', period: 2, clock: '6:10' }, 0.5],
                [{ id: '1', period: 2, clock: '6:00', team: 'H', scoring: true, home: 2 }, 0.58],
                [{ id: '2', period: 2, clock: '6:00', team: 'A', type: 'Personal Foul' }, 0.62],
                [{ id: '3', period: 2, clock: '6:00', type: 'Ref-Initiated Review (Overturned)' }, 0.58],
                [{ id: '4', period: 3, clock: '1:10' }, 0.5],
                [{ id: '5', period: 3, clock: '1:00', team: 'H', scoring: true, home: 5 }, 0.6],
                [{ id: '6', period: 3, clock: '1:00', type: 'Ref-Initiated Review (Overturned)' }, 0.6],
                [{ id: '7', period: 4, clock: '0.5', team: 'A', scoring: true, away: 3 }, 0.1],
                [{ id: '8', period: 4, clock: '0.5', type: 'Review (Supported)' }, 0.1],
            ]);
            const byId = Object.fromEntries(deltas(biggestSwings(series, 10)));
            expect(byId['1']).toBe(0.08);
            expect(byId['2']).toBeUndefined();
            expect(byId['5']).toBe(0.1);
            expect(byId['7']).toBe(-0.5);
        });

        it('copes with an overturned row first and an actor play last', () => {
            const series = seriesOf([
                [{ id: '0', type: 'Ref-Initiated Review (Overturned)' }, 0.5],
                [{ id: '1', clock: '9:00', team: 'H' }, 0.6],
            ]);
            expect(() => biggestSwings(series, 5)).not.toThrow();
            expect(biggestSwings(series, 5)).toHaveLength(1);
        });
    });

    it('does not skip a timeout at an earlier clock', () => {
        const series = seriesOf([
            [{ id: '0', clock: '10:00', team: 'H' }, 0.5],
            [{ id: '1', clock: '9:30', team: 'A', type: 'Full Timeout' }, 0.4],
            [{ id: '2', clock: '9:00', team: 'H' }, 0.45],
        ]);
        const byId = Object.fromEntries(deltas(biggestSwings(series, 10)));
        expect(byId['2']).toBe(0.05);
    });
});

describe('pointIndexAt', () => {
    const series = [0, 100, 100, 200].map((elapsed) => ({ elapsed }) as WpPoint);

    it('finds the last point at or before a time, clamped to the ends', () => {
        expect(pointIndexAt([], 50)).toBeNull();
        expect(pointIndexAt(series, -10)).toBe(0);
        expect(pointIndexAt(series, 50)).toBe(0);
        expect(pointIndexAt(series, 100)).toBe(2);
        expect(pointIndexAt(series, 150)).toBe(2);
        expect(pointIndexAt(series, 999)).toBe(3);
    });

    it('returns 0 when the target is before the first point', () => {
        expect(pointIndexAt([{ elapsed: 30 } as WpPoint], 10)).toBe(0);
    });
});

describe('formatting', () => {
    it('formats WP and signed deltas', () => {
        expect(formatWp(0.288)).toBe('29%');
        expect(formatDelta(0.09)).toBe('+9.0%');
        expect(formatDelta(-0.093)).toBe('−9.3%');
    });
});

describe('pickWpColors', () => {
    const team = (color: string, alternateColor: string) => ({ color, alternateColor });
    const ATL = team('c8102e', 'fdb927');
    const MIA = team('98002e', '000000');
    const GS = team('fdb927', '1d428a');
    const CHI = team('ce1141', '000000');
    const TOR = team('d91244', '000000');
    const DET = team('1d428a', 'c8102e');
    const NY = team('1d428a', 'f58426');

    it('uses both primaries when they are legible and distinct', () => {
        const { home, away } = pickWpColors(ATL, MIA, 'light');
        expect(home.fill).toBe('#c8102e');
        expect(away.fill).toBe('#98002e');
    });

    it('falls back to the alternate when the primary lacks contrast', () => {
        expect(pickWpColors(GS, ATL, 'light').home.fill).toBe('#1d428a');
    });

    it('gives a team with no legible colour a neutral token', () => {
        expect(pickWpColors(ATL, MIA, 'dark').away.fill).toBe('hsl(var(--muted-foreground))');
    });

    it('takes the away alternate when the primaries are too similar', () => {
        expect(pickWpColors(CHI, TOR, 'light').away.fill).toBe('#000000');
    });

    it('takes a neutral when the away team has no distinct legible colour', () => {
        expect(pickWpColors(DET, NY, 'light').away.fill).toBe('hsl(var(--muted-foreground))');
    });

    it('keeps the two neutrals apart when neither team is legible', () => {
        const { home, away } = pickWpColors(MIA, team('98002e', '000000'), 'dark');
        expect(home.fill).toBe('hsl(var(--muted-foreground))');
        expect(away.fill).toBe('hsl(var(--foreground))');
        expect(away.ink).toBe('hsl(var(--card))');
    });

    it('picks black or white ink by contrast', () => {
        expect(pickWpColors(team('fdb927', '000000'), NY, 'dark').home.ink).toBe('#000000');
        expect(pickWpColors(NY, ATL, 'light').home.ink).toBe('#ffffff');
    });

    it('shadows the main.css tokens it stands in for', () => {
        const css = readFileSync(resolve(__dirname, '../../src/assets/main.css'), 'utf8');
        const tokensIn = (selector: string) => {
            const start = css.indexOf(`\n${selector} {`);
            const body = css.slice(start, css.indexOf('\n}', start));
            return Object.fromEntries(
                [...body.matchAll(/(--[\w-]+):\s*0 0% (\d[\d.]*)%;/g)].map((m) => {
                    const channel = Math.round((Number(m[2]) / 100) * 255).toString(16).padStart(2, '0');
                    return [m[1], `#${channel.repeat(3)}`];
                }),
            );
        };
        for (const [theme, selector] of [
            ['light', ':root'],
            ['dark', '.dark'],
        ] as const) {
            const tokens = tokensIn(selector);
            expect(THEME_HEX[theme]).toEqual({
                card: tokens['--card'],
                foreground: tokens['--foreground'],
                mutedForeground: tokens['--muted-foreground'],
            });
        }
    });
});

describe('player win probability added', () => {
    // Hand fixture: each row's credit is in the comment beside it.
    const FIXTURE: [PlayInput, number][] = [
        [{ id: '0', clock: '12:00', team: 'H', type: 'Jumpball', participants: ['h1', 'a1'] }, 0.5], // none
        [{ id: '1', clock: '11:40', team: 'H', scoring: true, home: 2, participants: ['h1', 'h2'] }, 0.56], // h1 +0.06
        [{ id: '2', clock: '11:20', team: 'A', type: 'Bad Pass Turnover', participants: ['a1', 'h2'] }, 0.6], // a1 -0.04
        [{ id: '3', clock: '11:00', team: 'H', participants: ['h2', 'a2'] }, 0.55], // h2 -0.05
        [{ id: '4', clock: '10:58', team: 'A', type: 'Defensive Rebound', participants: ['a2'] }, 0.53], // a2 +0.02
        [{ id: '5', clock: '10:40', team: 'H', type: 'Shooting Foul', participants: ['h1'] }, 0.47], // a1 +0.06
        [{ id: '6', clock: '10:40', team: 'A', type: 'Full Timeout', participants: false }, 0.45], // none
        [{ id: '7', clock: '10:40', team: 'A', type: 'Free Throw - 1 of 2', away: 1, participants: ['a1'] }, 0.46], // a1 +0.01
        [{ id: '8', clock: '10:40', team: 'A', type: 'Free Throw - 2 of 2', participants: ['a1'] }, 0.48], // a1 -0.02
        [{ id: '9', clock: '10:38', team: 'H', type: 'Defensive Team Rebound', participants: false }, 0.49], // none
        [{ id: '10', clock: '10:20', team: 'A', type: 'Offensive Foul', participants: ['a2'] }, 0.53], // a2 -0.04
        [{ id: '11', clock: '10:20', team: 'A', type: 'Offensive Foul Turnover', participants: ['a2'] }, 0.53], // a2 0
        [{ id: '12', clock: '10:00', team: 'H', type: 'Personal Foul', participants: ['h2'] }, 0.52], // none
        [{ id: '13', clock: '9:40', team: 'H', scoring: true, home: 4, participants: ['h1'] }, 0.58], // h1 +0.06
    ];
    const series = seriesOf(FIXTURE);
    const byId = (rows: ReturnType<typeof playerWpa>) => Object.fromEntries(rows.map((r) => [r.athleteId, r]));

    // A charge by a9 that a challenge overturns, then a turnover by a8.
    const OVERTURNED: [PlayInput, number][] = [
        [{ id: '0', period: 4, clock: '4:30', team: 'H', type: 'Bad Pass Turnover', participants: ['h9'] }, 0.3],
        [{ id: '1', period: 4, clock: '4:22', team: 'A', type: 'Offensive Charge', participants: ['a9'] }, 0.495],
        [{ id: '2', period: 4, clock: '4:22', team: 'H', type: 'Challenge', participants: false }, 0.387],
        [{ id: '3', period: 4, clock: '4:22', team: 'H', type: "Coach's Challenge (Overturned)", participants: false }, 0.387],
        [{ id: '4', period: 4, clock: '4:22', team: 'A', type: 'Bad Pass Turnover', participants: ['a8'] }, 0.387],
    ];

    describe('playerWpa', () => {
        it('credits each player signed for their own team', () => {
            const rows = playerWpa(series);
            expect(rows.map((r) => [r.athleteId, r.side])).toEqual([
                ['h1', 'home'],
                ['a1', 'away'],
                ['a2', 'away'],
                ['h2', 'home'],
            ]);
            [0.12, 0.01, -0.02, -0.05].forEach((expected, i) => expect(rows[i].wpa).toBeCloseTo(expected));
        });

        it('leaves team rebounds, timeouts, jump balls and fouls with no free throws unattributed', () => {
            // Row 12's personal foul would otherwise take h2 to -0.04.
            expect(byId(playerWpa(series)).h2.wpa).toBeCloseTo(-0.05);
            expect(playerWpa(series)).toHaveLength(4);
        });

        it("gives a foul's swing to the free-throw shooter it sends to the line", () => {
            const rows = byId(playerWpa(seriesOf(FIXTURE.slice(4, 9))));
            expect(rows.h1).toBeUndefined();
            expect(rows.a1.wpa).toBeCloseTo(0.06 + 0.01 - 0.02);
        });

        it("counts an offensive foul as the fouler's turnover", () => {
            const rows = byId(playerWpa(seriesOf(FIXTURE.slice(9, 12))));
            expect(rows.a2.wpa).toBeCloseTo(-0.04);
        });

        it('gives assisters, stealers and blockers nothing', () => {
            const rows = byId(playerWpa(seriesOf(FIXTURE.slice(0, 4))));
            expect(rows.h1.wpa).toBeCloseTo(0.06);
            expect(rows.a1.wpa).toBeCloseTo(-0.04);
            expect(rows.h2.wpa).toBeCloseTo(-0.05);
            expect(rows.a2).toBeUndefined();
        });

        it('does not credit a call a challenge overturned', () => {
            const rows = byId(playerWpa(seriesOf(OVERTURNED)));
            expect(rows.a9).toBeUndefined();
            expect(rows.a8.wpa).toBeCloseTo(-0.087);
        });

        it("players don't add up to the team's change", () => {
            const home = playerWpa(series)
                .filter((r) => r.side === 'home')
                .reduce((sum, r) => sum + r.wpa, 0);
            expect(home).toBeCloseTo(0.07);
            expect(series.at(-1)!.homeWp - series[0].homeWp).toBeCloseTo(0.08);
        });

        it('gives a shooting foul and a technical at one stoppage each their own shooter', () => {
            const at = { clock: '5:00' };
            const rows = byId(
                playerWpa(
                    seriesOf([
                        [{ id: '0', clock: '5:10', team: 'H', participants: ['h9'] }, 0.5],
                        [{ id: '1', ...at, team: 'H', type: 'Shooting Foul', participants: ['h1'] }, 0.44], // a1 +0.06
                        [{ id: '2', ...at, team: 'H', type: 'Technical Foul', participants: ['h2'] }, 0.42], // a2 +0.02
                        [{ id: '3', ...at, team: 'A', type: 'Free Throw - 1 of 2', participants: ['a1'] }, 0.43], // a1 -0.01
                        [{ id: '4', ...at, team: 'A', type: 'Free Throw - Technical', participants: ['a2'] }, 0.41], // a2 +0.02
                        [{ id: '5', ...at, team: 'A', type: 'Free Throw - 2 of 2', participants: ['a1'] }, 0.4], // a1 +0.01
                    ]),
                ),
            );
            expect(rows.a1.wpa).toBeCloseTo(0.06);
            expect(rows.a2.wpa).toBeCloseTo(0.04);
        });

        it('gives a lone technical the free throw ESPN labels "1 of 1"', () => {
            const rows = byId(
                playerWpa(
                    seriesOf([
                        [{ id: '0', clock: '3:10', team: 'H', participants: ['h9'] }, 0.5],
                        [{ id: '1', clock: '3:00', team: 'H', type: 'Defensive 3-Seconds Technical', participants: ['h1'] }, 0.47], // a1 +0.03
                        [{ id: '2', clock: '3:00', team: 'A', type: 'Free Throw - 1 of 1', participants: ['a1'] }, 0.46], // a1 +0.01
                    ]),
                ),
            );
            expect(rows.h1).toBeUndefined();
            expect(rows.a1.wpa).toBeCloseTo(0.04);
        });

        it('gives a lone flagrant the free throws ESPN labels "Technical", even after an offensive foul', () => {
            const rows = byId(
                playerWpa(
                    seriesOf([
                        [{ id: '0', clock: '1:10', team: 'H', participants: ['h9'] }, 0.5],
                        [{ id: '1', clock: '1:00', team: 'A', type: 'Offensive Foul', participants: ['a9'] }, 0.52], // a9 -0.02
                        [{ id: '2', clock: '1:00', team: 'H', type: 'Flagrant Foul Type 1', participants: ['h1'] }, 0.47], // a1 +0.05
                        [{ id: '3', clock: '1:00', team: 'A', type: 'Free Throw - Technical', participants: ['a1'] }, 0.45], // a1 +0.02
                    ]),
                ),
            );
            expect(rows.h1).toBeUndefined();
            expect(rows.a1.wpa).toBeCloseTo(0.07);
            expect(rows.a9.wpa).toBeCloseTo(-0.02);
        });

        it("doesn't give a personal foul the free throw of a technical called with it", () => {
            const rows = byId(
                playerWpa(
                    seriesOf([
                        [{ id: '0', clock: '2:10', team: 'H', participants: ['h9'] }, 0.5],
                        [{ id: '1', clock: '2:00', team: 'H', type: 'Personal Foul', participants: ['h1'] }, 0.49], // none
                        [{ id: '2', clock: '2:00', team: 'H', type: 'Technical Foul', participants: ['h2'] }, 0.47], // a1 +0.02
                        [{ id: '3', clock: '2:00', team: 'A', type: 'Free Throw - Technical', participants: ['a1'] }, 0.46], // a1 +0.01
                    ]),
                ),
            );
            expect(rows.a1.wpa).toBeCloseTo(0.03);
        });

        it('rounds away float residue so swings that cancel give +0.0%', () => {
            const [row] = playerWpa(
                seriesOf([
                    [{ id: '0', clock: '12:00' }, 0.1],
                    [{ id: '1', clock: '11:00', team: 'H', participants: ['h1'] }, 0.3],
                    [{ id: '2', clock: '10:00', team: 'H', participants: ['h1'] }, 0.2],
                    [{ id: '3', clock: '9:00', team: 'H', participants: ['h1'] }, 0.1],
                ]),
            );
            expect(Object.is(row.wpa, 0)).toBe(true);
            expect(formatDelta(row.wpa)).toBe('+0.0%');
        });

        it('returns [] for an empty series', () => {
            expect(playerWpa([])).toEqual([]);
        });
    });

    describe('swingByPlayId', () => {
        it("maps every actor play to the acting team's swing", () => {
            const swings = swingByPlayId(series);
            expect(swings.get('1')).toBeCloseTo(0.06);
            expect(swings.get('2')).toBeCloseTo(-0.04);
            expect(swings.has('0')).toBe(false);
            expect(swings.has('6')).toBe(false);
        });

        it('leaves out an overturned call', () => {
            expect(swingByPlayId(seriesOf(OVERTURNED)).has('1')).toBe(false);
        });
    });

    describe('excitement', () => {
        it('sums the size of every actor swing', () => {
            expect(excitement(series)).toBeCloseTo(0.38);
        });

        it('does not count an overturned call and its reversal', () => {
            expect(excitement(seriesOf(OVERTURNED))).toBeCloseTo(0.087);
        });
    });

    describe('comeback', () => {
        it("gives the winner's lowest WP over every point", () => {
            expect(comeback(series)).toEqual({ side: 'home', low: 0.45 });
        });

        it('reads an away winner from the home WP', () => {
            const result = comeback(
                seriesOf([
                    [{ id: '0', clock: '12:00' }, 0.5],
                    [{ id: '1', clock: '11:00', team: 'H', scoring: true, home: 2 }, 0.8],
                    [{ id: '2', clock: '10:00', team: 'A', scoring: true, away: 3 }, 0.3],
                ]),
            );
            expect(result?.side).toBe('away');
            expect(result?.low).toBeCloseTo(0.2);
        });

        it('returns null for a tied score or an empty series', () => {
            const tied = seriesOf([
                [{ id: '0' }, 0.5],
                [{ id: '1', clock: '9:00' }, 0.6],
            ]);
            expect(comeback(tied)).toBeNull();
            expect(comeback([])).toBeNull();
        });
    });

    describe('isBigSwing', () => {
        it('counts a 5.0% move that float subtraction leaves just under 0.05', () => {
            expect(0.5 - 0.45).toBeLessThan(BIG_SWING);
            expect(isBigSwing(0.5 - 0.45)).toBe(true);
            expect(isBigSwing(0.45 - 0.5)).toBe(true);
            expect(isBigSwing(0.049)).toBe(false);
        });
    });
});
