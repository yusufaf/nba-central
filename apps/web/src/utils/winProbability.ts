import type { ESPNPlay, ESPNTeamInfo, ESPNWinProbability } from '@/models/types';
import { contrastRatio, normaliseHex } from '@/utils/court';

export type WpSide = 'home' | 'away';

export interface WpTeams {
    homeId: string;
    awayId: string;
}

export interface WpPoint {
    playId: string;
    elapsed: number;
    period: number;
    clock: string;
    text: string;
    type: string;
    scoring: boolean;
    homeScore: number;
    awayScore: number;
    homeWp: number;
    // The acting team, or null for a play no team made (timeouts, reviews, ...).
    side: WpSide | null;
}

export interface WpSwing {
    index: number;
    rank: number;
    point: WpPoint;
    homeDelta: number;
    // The change for the acting team: negative when its own play hurt it.
    actorDelta: number;
}

export const REGULATION_PERIODS = 4;
export const QUARTER_SECONDS = 720;
export const OVERTIME_SECONDS = 300;

/** ESPN's clock: "5:12" above a minute, "34.2" below it. */
export const parseClock = (clock: string): number | null => {
    const match = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(clock.trim());
    if (!match) return null;
    return Number(match[1] ?? 0) * 60 + Number(match[2]);
};

export const periodLength = (period: number) =>
    period <= REGULATION_PERIODS ? QUARTER_SECONDS : OVERTIME_SECONDS;

const secondsBefore = (period: number) =>
    Math.min(period - 1, REGULATION_PERIODS) * QUARTER_SECONDS +
    Math.max(0, period - 1 - REGULATION_PERIODS) * OVERTIME_SECONDS;

export const elapsedSeconds = (period: number, clock: string): number | null => {
    const remaining = parseClock(clock);
    if (remaining === null) return null;
    return secondsBefore(period) + periodLength(period) - remaining;
};

export const gameLength = (periods: number) => secondsBefore(Math.max(periods, REGULATION_PERIODS) + 1);

export const periodLabel = (period: number) => {
    if (period <= REGULATION_PERIODS) return `Q${period}`;
    const overtime = period - REGULATION_PERIODS;
    return overtime === 1 ? 'OT' : `OT${overtime}`;
};

// Plays a team is credited with that aren't basketball actions, so they never
// count as a swing. Measured on 44 games: a coach's challenge that stood moved
// WP by 34.9%, a double personal foul 13.6%, a full timeout 9.9%, a
// substitution 6.9%. "Double" is limited to fouls so a double dribble turnover
// still counts. End of period/game and reviews usually carry no team at all.
const NON_ACTOR_TYPE =
    /substitution|timeout|challenge|review|jump ?ball|ejection|double (personal|technical)|end (of )?(period|game)/i;

/**
 * One point per play with a WP entry, in game order. `winprobability[]` is
 * sorted by sequence number, which isn't chronological, so this walks
 * `plays[]` and joins by id.
 */
export const buildWpSeries = (
    plays: ESPNPlay[],
    winprobability: ESPNWinProbability[],
    teams: WpTeams,
): WpPoint[] => {
    const wpById = new Map(winprobability.map((entry) => [entry.playId, entry.homeWinPercentage]));
    const seen = new Set<string>();
    const series: WpPoint[] = [];
    let homeScore = 0;
    let awayScore = 0;

    for (const play of plays) {
        // ESPN repeats some plays verbatim, sometimes with another play
        // between, so a copy anywhere at the same moment is dropped. That also
        // drops a real repeat (a team rebound after each missed free throw),
        // which ESPN prices the same as the first, so only its tooltip is lost.
        // The score is part of the key because consecutive technical free
        // throws share their text.
        const key = [play.period.number, play.clock.displayValue, play.text, play.awayScore, play.homeScore].join(
            '|',
        );
        if (seen.has(key)) continue;

        homeScore = play.homeScore ?? homeScore;
        awayScore = play.awayScore ?? awayScore;
        const homeWp = wpById.get(play.id);
        const elapsed = elapsedSeconds(play.period.number, play.clock.displayValue);
        if (homeWp === undefined || elapsed === null) continue;
        seen.add(key);

        const teamId = play.team?.id;
        const side: WpSide | null =
            teamId === undefined || NON_ACTOR_TYPE.test(play.type.text)
                ? null
                : teamId === teams.homeId
                  ? 'home'
                  : teamId === teams.awayId
                    ? 'away'
                    : null;

        series.push({
            playId: play.id,
            elapsed,
            period: play.period.number,
            clock: play.clock.displayValue,
            text: play.text,
            type: play.type.text,
            scoring: play.scoringPlay === true,
            homeScore,
            awayScore,
            homeWp,
            side,
        });
    }
    return series;
};

export const wpDelta = (series: WpPoint[]) =>
    series.map((point, i) => (i === 0 ? 0 : point.homeWp - series[i - 1].homeWp));

const sameMoment = (a: WpPoint, b: WpPoint) => a.period === b.period && a.clock === b.clock;

const OVERTURNED = /overturned/i;

/**
 * The n actor plays that moved WP most. ESPN prices challenges and reviews as
 * rows of their own, so a play after one is measured from before that
 * stoppage, and a call a challenge overturned is not a candidate.
 */
export const biggestSwings = (series: WpPoint[], n: number): WpSwing[] => {
    // Each overturned row reverses the nearest call before it at that moment.
    // Baskets and free throws there stood: no overturn measured changed the score.
    const dropped = new Set<number>();
    series.forEach((point, k) => {
        if (!OVERTURNED.test(point.type)) return;
        for (let i = k - 1; i >= 0 && sameMoment(series[i], point); i--) {
            if (series[i].side !== null && !series[i].scoring) {
                dropped.add(i);
                break;
            }
        }
    });

    const candidates: Omit<WpSwing, 'rank'>[] = [];
    for (let i = 1; i < series.length; i++) {
        const point = series[i];
        if (point.side === null || dropped.has(i)) continue;
        let base = i - 1;
        while (
            base > 0 &&
            (series[base].side === null || dropped.has(base)) &&
            sameMoment(series[base], point)
        ) {
            base--;
        }
        const homeDelta = point.homeWp - series[base].homeWp;
        if (homeDelta === 0) continue;
        candidates.push({
            index: i,
            point,
            homeDelta,
            actorDelta: point.side === 'home' ? homeDelta : -homeDelta,
        });
    }

    return candidates
        .sort((a, b) => Math.abs(b.homeDelta) - Math.abs(a.homeDelta) || a.index - b.index)
        .slice(0, n)
        .map((swing, i) => ({ ...swing, rank: i + 1 }));
};

/** The last point at or before `elapsed`, clamped to the first and last. */
export const pointIndexAt = (series: WpPoint[], elapsed: number): number | null => {
    if (series.length === 0) return null;
    let low = 0;
    let high = series.length - 1;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (series[mid].elapsed <= elapsed) low = mid;
        else high = mid - 1;
    }
    return low;
};

export const formatWp = (wp: number) => `${Math.round(wp * 100)}%`;

export const formatDelta = (delta: number) =>
    `${delta < 0 ? '−' : '+'}${Math.abs(delta * 100).toFixed(1)}%`;

export type WpTheme = 'light' | 'dark';

export interface WpTeamColor {
    fill: string;
    // Text drawn on top of `fill`.
    ink: string;
}

// WCAG 1.4.11 for graphics, against the card the chart sits on.
export const MIN_GRAPHIC_CONTRAST = 3;
// CIELAB ΔE76 between the two teams' colours.
export const MIN_TEAM_COLOR_DISTANCE = 20;

// main.css's --card, --foreground and --muted-foreground as hex, for the
// contrast maths. tests/utils/winProbability.test.ts checks them.
export const THEME_HEX = {
    light: { card: '#ffffff', foreground: '#171717', mutedForeground: '#616161' },
    dark: { card: '#1c1c1c', foreground: '#fafafa', mutedForeground: '#a3a3a3' },
} as const;

type TeamColors = Pick<ESPNTeamInfo, 'color' | 'alternateColor'>;

interface Candidate {
    css: string;
    hex: string;
    neutral: boolean;
}

const lab = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const s = parseInt(hex.slice(i, i + 2), 16) / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    // sRGB to XYZ (D65), normalised by the white point.
    const xyz = [
        (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047,
        0.2126 * r + 0.7152 * g + 0.0722 * b,
        (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883,
    ].map((t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116));
    return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
};

const deltaE = (a: string, b: string) => {
    const [la, lb] = [lab(a), lab(b)];
    return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
};

const candidatesFor = (team: TeamColors, theme: WpTheme): Candidate[] => {
    const palette = THEME_HEX[theme];
    const teamColors = [team.color, team.alternateColor]
        .map((color) => (color ? normaliseHex(`#${color}`) : null))
        .filter((hex): hex is string => hex !== null && contrastRatio(hex, palette.card) >= MIN_GRAPHIC_CONTRAST)
        .map((hex) => ({ css: hex, hex, neutral: false }));
    return [
        ...teamColors,
        { css: 'hsl(var(--muted-foreground))', hex: palette.mutedForeground, neutral: true },
        { css: 'hsl(var(--foreground))', hex: palette.foreground, neutral: true },
    ];
};

const toTeamColor = ({ css, hex, neutral }: Candidate): WpTeamColor => ({
    fill: css,
    ink: neutral
        ? 'hsl(var(--card))'
        : contrastRatio(hex, '#ffffff') >= contrastRatio(hex, '#000000')
          ? '#ffffff'
          : '#000000',
});

/**
 * Each team's colour if it shows on the card, else its alternate, else a
 * neutral token. The away colour also has to look different from home.
 */
export const pickWpColors = (home: TeamColors, away: TeamColors, theme: WpTheme) => {
    const homeColor = candidatesFor(home, theme)[0];
    const awayCandidates = candidatesFor(away, theme);
    const awayColor =
        awayCandidates.find((c) => deltaE(c.hex, homeColor.hex) >= MIN_TEAM_COLOR_DISTANCE) ?? awayCandidates.at(-1)!;
    return { home: toTeamColor(homeColor), away: toTeamColor(awayColor) };
};
