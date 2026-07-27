import type { PlayerSeasonStats } from '@/models/api';

export type StatColumn = {
    name: string;
    label: string;
    field: string;
    title: string;
};

/**
 * Basketball-Reference's own column abbreviations, in its column order. Spelled
 * out, these headers were wider than the numbers beneath them; the full name
 * lives in a tooltip instead.
 *
 * Every counting stat here is a per-game average, which is why the tooltips say
 * so rather than implying season totals.
 */
export const STAT_COLUMNS: StatColumn[] = [
    { name: 'season', label: 'Season', field: 'season', title: 'Season' },
    { name: 'games_played', label: 'G', field: 'games_played', title: 'Games Played' },
    { name: 'min', label: 'MP', field: 'min', title: 'Minutes Played per Game' },
    { name: 'fgm', label: 'FG', field: 'fgm', title: 'Field Goals Made per Game' },
    { name: 'fga', label: 'FGA', field: 'fga', title: 'Field Goals Attempted per Game' },
    { name: 'fg_pct', label: 'FG%', field: 'fg_pct', title: 'Field Goal Percentage' },
    { name: 'fg3m', label: '3P', field: 'fg3m', title: '3-Point Field Goals Made per Game' },
    { name: 'fg3a', label: '3PA', field: 'fg3a', title: '3-Point Field Goals Attempted per Game' },
    { name: 'fg3_pct', label: '3P%', field: 'fg3_pct', title: '3-Point Field Goal Percentage' },
    { name: 'ftm', label: 'FT', field: 'ftm', title: 'Free Throws Made per Game' },
    { name: 'fta', label: 'FTA', field: 'fta', title: 'Free Throws Attempted per Game' },
    { name: 'ft_pct', label: 'FT%', field: 'ft_pct', title: 'Free Throw Percentage' },
    { name: 'oreb', label: 'ORB', field: 'oreb', title: 'Offensive Rebounds per Game' },
    { name: 'dreb', label: 'DRB', field: 'dreb', title: 'Defensive Rebounds per Game' },
    { name: 'reb', label: 'TRB', field: 'reb', title: 'Total Rebounds per Game' },
    { name: 'ast', label: 'AST', field: 'ast', title: 'Assists per Game' },
    { name: 'stl', label: 'STL', field: 'stl', title: 'Steals per Game' },
    { name: 'blk', label: 'BLK', field: 'blk', title: 'Blocks per Game' },
    { name: 'turnover', label: 'TOV', field: 'turnover', title: 'Turnovers per Game' },
    { name: 'pf', label: 'PF', field: 'pf', title: 'Personal Fouls per Game' },
    { name: 'pts', label: 'PTS', field: 'pts', title: 'Points per Game' },
];

/** Stats where a lower number is the better performance. */
const LOWER_IS_BETTER = new Set(['turnover', 'pf']);

export const isBetter = (field: string, value: number, other: number): boolean =>
    LOWER_IS_BETTER.has(field) ? value < other : value > other;

/** Shooting percentages must be recomputed from makes and attempts, never averaged. */
const PERCENTAGE_SOURCES: Record<string, [string, string]> = {
    fg_pct: ['fgm', 'fga'],
    fg3_pct: ['fg3m', 'fg3a'],
    ft_pct: ['ftm', 'fta'],
};

// Season rows are already per-game, so a career rate is the games-weighted mean
// of the seasons - a plain mean would let a 5-game season count as much as an
// 82-game one.
const COUNTING_STATS = [
    'min', 'fgm', 'fga', 'fg3m', 'fg3a', 'ftm', 'fta',
    'oreb', 'dreb', 'reb', 'ast', 'stl', 'blk', 'turnover', 'pf', 'pts',
];

export type CareerAverages = Record<string, number> & {
    games_played: number;
    seasons: number;
};

export const careerAverages = (
    seasons: PlayerSeasonStats[] | undefined | null,
): CareerAverages | null => {
    const rows = (seasons ?? []).filter(
        (row) => row && Number.isFinite(Number(row.games_played)),
    );
    if (!rows.length) return null;

    const totalGames = rows.reduce((sum, row) => sum + Number(row.games_played), 0);
    if (totalGames <= 0) return null;

    const out: Record<string, number> = {
        games_played: totalGames,
        seasons: rows.length,
    };

    for (const field of COUNTING_STATS) {
        const weighted = rows.reduce((sum, row) => {
            const value = Number((row as any)[field]);
            return Number.isFinite(value)
                ? sum + value * Number(row.games_played)
                : sum;
        }, 0);
        out[field] = weighted / totalGames;
    }

    for (const [pct, [madeField, attemptedField]] of Object.entries(PERCENTAGE_SOURCES)) {
        const attempted = out[attemptedField];
        out[pct] = attempted > 0 ? out[madeField] / attempted : 0;
    }

    return out as CareerAverages;
};

/** Percentages read as .513; counting stats as 24.4; games played as a whole number. */
export const formatStat = (field: string, value: number | undefined): string => {
    if (value === undefined || !Number.isFinite(value)) return '—';
    if (field in PERCENTAGE_SOURCES) return value.toFixed(3).replace(/^0/, '');
    if (field === 'games_played' || field === 'seasons' || field === 'season') {
        return String(Math.round(value));
    }
    return value.toFixed(1);
};
