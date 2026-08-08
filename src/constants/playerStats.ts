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

export type SeasonFormat = 'YYYY-YY' | 'YYYY-YYYY' | 'YYYY' | 'YYYY+1';
export type StatDisplayMode = 'per_game' | 'totals';

/** Shooting percentages must be recomputed from makes and attempts, never averaged. */
export const PERCENTAGE_SOURCES: Record<string, [string, string]> = {
    fg_pct: ['fgm', 'fga'],
    fg3_pct: ['fg3m', 'fg3a'],
    ft_pct: ['ftm', 'fta'],
};

// Season rows are already per-game, so a career rate is the games-weighted mean
// of the seasons - a plain mean would let a 5-game season count as much as an
// 82-game one.
export const COUNTING_STATS = [
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

export type CareerTotals = Record<string, number> & {
    games_played: number;
    seasons: number;
};

export const careerTotals = (
    seasons: PlayerSeasonStats[] | undefined | null,
): CareerTotals | null => {
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
        const sumTotal = rows.reduce((sum, row) => {
            const value = Number((row as any)[field]);
            const games = Number(row.games_played);
            return Number.isFinite(value) && Number.isFinite(games)
                ? sum + Math.round(value * games)
                : sum;
        }, 0);
        out[field] = sumTotal;
    }

    for (const [pct, [madeField, attemptedField]] of Object.entries(PERCENTAGE_SOURCES)) {
        const attempted = out[attemptedField];
        out[pct] = attempted > 0 ? out[madeField] / attempted : 0;
    }

    return out as CareerTotals;
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

/**
 * Formats a season start year into standard NBA or custom year formats.
 * E.g., for start year 2010:
 * - YYYY-YY: '2010-11' (Standard NBA format)
 * - YYYY-YYYY: '2010-2011' (Full year range)
 * - YYYY: '2010' (Start year)
 * - YYYY+1: '2011' (End year)
 */
export const formatSeason = (
    season: number | string | undefined | null,
    format: SeasonFormat = 'YYYY-YY',
): string => {
    if (season === undefined || season === null) return '—';
    if (typeof season === 'string' && season.includes('-')) return season;

    const year = typeof season === 'number' ? season : parseInt(String(season), 10);
    if (isNaN(year)) return String(season);

    switch (format) {
        case 'YYYY-YY': {
            const nextYear = Math.abs(year + 1) % 100;
            const nextYearStr = nextYear < 10 ? `0${nextYear}` : `${nextYear}`;
            return `${year}-${nextYearStr}`;
        }
        case 'YYYY-YYYY':
            return `${year}-${year + 1}`;
        case 'YYYY+1':
            return `${year + 1}`;
        case 'YYYY':
        default:
            return `${year}`;
    }
};

/** Formats a table cell value based on column field, season format preference, and stat mode. */
export const formatCellValue = (
    field: string,
    row: any,
    seasonFormat: SeasonFormat = 'YYYY-YY',
    statMode: StatDisplayMode = 'per_game',
): string => {
    if (!row) return '—';

    if (field === 'season') {
        return formatSeason(row.season, seasonFormat);
    }

    if (field === 'games_played') {
        return formatStat('games_played', row.games_played);
    }

    const val = Number(row[field]);
    if (!Number.isFinite(val)) return '—';

    if (statMode === 'totals') {
        const games = Number(row.games_played);
        if (COUNTING_STATS.includes(field) && Number.isFinite(games) && games > 0) {
            const total = Math.round(val * games);
            return total.toLocaleString();
        }
    }

    return formatStat(field, val);
};

