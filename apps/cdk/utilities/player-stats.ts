export const PLAYER_STATS_PK = "PLAYERSTATS";
// The first BAA season, 1946-47.
export const FIRST_SEASON = 1946;
// More than any player has appeared in during one regular season.
export const MAX_GAMES = 100;
const PCT_FIELDS = ["fg_pct", "fg3_pct", "ft_pct"] as const;

// setPlayerStatsData fires at :00/:20/:40 UTC (shared by its CDK wrapper and
// its handler, so this file must stay free of aws-cdk-lib imports).
export const SNAPSHOT_INTERVAL_MINUTES = 20;
// No snapshot request runs past this many minutes into its slot, however late
// the run started; setPlayersData's slot sits after it.
export const SNAPSHOT_STOP_AFTER_MINUTES = 12;

// One season of per-game averages, in the BALLDONTLIE season_averages shape
// the frontend reads. `season` is the start year ("2003-04" -> 2003).
export interface SeasonStats {
	season: number;
	games_played: number;
	min: number;
	fgm: number;
	fga: number;
	fg_pct: number;
	fg3m: number;
	fg3a: number;
	fg3_pct: number;
	ftm: number;
	fta: number;
	ft_pct: number;
	oreb: number;
	dreb: number;
	reb: number;
	ast: number;
	stl: number;
	blk: number;
	turnover: number;
	pf: number;
	pts: number;
}

// setPlayerStatsData writes `stats`/`scrapedAt`/`checkedAt`/`lastError`.
// Items left by the old on-demand cache have `freshUntil`/`ttl`/`failed`
// instead, and are served until the snapshot rewrites them.
export interface PlayerStatsItem {
	PK: string;
	SK: string;
	stats?: SeasonStats[];
	scrapedAt?: number;
	checkedAt?: number;
	lastError?: string;
	failed?: boolean;
	freshUntil?: number;
	ttl?: number;
}

// The career to serve, or null when the snapshot has none for this player.
export const servableStats = (item: PlayerStatsItem | undefined): SeasonStats[] | null =>
	item && !item.failed && Array.isArray(item.stats) ? item.stats : null;

// Per-game points are 2*FG + 3P + FT. Each column is rounded to 0.1, so they
// agree within 0.25; a renamed points or shooting column reads as 0 and doesn't.
export const POINTS_TOLERANCE = 1;

// Why a scraped career can't be stored, or null if it can. A cell that's
// missing or blank parses as 0 (pre-1979 seasons have no 3P, steals, blocks),
// so the checks below are what catch a renamed column. An empty career is
// valid only for a current player (a rookie before his first game): everyone
// else in BBRef's index has played.
export const validateCareer = (
	stats: SeasonStats[],
	latestSeason: number,
	active: boolean,
): string | null => {
	if (stats.length === 0) return active ? null : "no seasons for a retired player";
	for (let i = 0; i < stats.length; i++) {
		const row = stats[i];
		if (!Number.isInteger(row.season) || row.season < FIRST_SEASON || row.season > latestSeason) {
			return `season ${row.season} is out of range`;
		}
		if (i > 0 && row.season >= stats[i - 1].season) {
			return `season ${row.season} is out of order`;
		}
		for (const [field, value] of Object.entries(row)) {
			if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
				return `${field} is ${value} in ${row.season}`;
			}
		}
		if (!Number.isInteger(row.games_played) || row.games_played > MAX_GAMES) {
			return `games_played is ${row.games_played} in ${row.season}`;
		}
		for (const field of PCT_FIELDS) {
			if (row[field] > 1) return `${field} is ${row[field]} in ${row.season}`;
		}
		const made = 2 * row.fgm + row.fg3m + row.ftm;
		if (Math.abs(row.pts - made) > POINTS_TOLERANCE) {
			return `pts is ${row.pts} but made shots add up to ${made} in ${row.season}`;
		}
	}
	// A renamed games column (or a fully renamed table) would read as 0 in every
	// row. This also turns away a rookie whose only row is Did Not Play: he
	// shows no stats, which beats overwriting a real season with zeros.
	if (!stats.some((row) => row.games_played > 0)) return "no season with a game played";
	return null;
};
