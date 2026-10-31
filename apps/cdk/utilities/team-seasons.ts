/**
 * Parsers and roster ordering for the team-seasons dataset: one file per
 * league season listing each team's name, arena, coach and its 15 players in
 * Team Builder slot order. Used by refresh-team-seasons.ts for finished
 * seasons and by setPlayersData for the current one.
 *
 * Only the ordered roster leaves this module. The per-game numbers it parses
 * decide the order and are then dropped, so nothing stored is a stats table.
 */
import * as cheerio from "cheerio";
import type {
	League,
	TeamSeason,
	TeamSeasonFile,
	TeamSeasonsIndexSeason,
} from "../models/team-seasons";

export type { League };

/** One player's line for one team in one season, as the season page lists it. */
export interface PerGameRow {
	id: string;
	team: string;
	// "" when the page leaves it blank (most BAA rows).
	pos: string;
	g: number;
	// null when the column doesn't exist yet: no games started before
	// 1981-82, no minutes before 1951-52.
	gs: number | null;
	mpg: number | null;
	ppg: number | null;
}

export interface CoachRow {
	// Basketball-Reference coach id, e.g. "jacksph01c" - the same id as the
	// `href` in apps/web's coaches.json.
	coachId: string;
	name: string;
	team: string;
	g: number;
}

export interface LeagueTeam {
	code: string;
	name: string;
	arena: string | null;
}

/** A player in the running for a roster spot. */
export interface RosterCandidate {
	id: string;
	pos: string;
	// 0 for a current-season player who is on the roster but hasn't played.
	g: number;
	gs: number | null;
	mpg: number | null;
	ppg: number | null;
	// 2K rating, the only signal for a player with no games yet.
	rating?: number | null;
}

export interface OrderedRoster {
	// Slot order: the first `starters` ids fill slots 1-5, the rest the bench.
	roster: string[];
	starters: number;
	// The next players by the same order, for the builder to fall back on when
	// a roster id is missing from players.json.
	alternates: string[];
}

export const ROSTER_SIZE = 15;
export const STARTER_COUNT = 5;
export const ALTERNATE_COUNT = 3;

// Team Builder's starter slots run PG, SG, SF, PF, C. Season pages use those
// five; players.json uses the coarse G/F/C forms, which sit between them.
const POSITION_RANK: Record<string, number> = {
	PG: 1,
	G: 1.5,
	SG: 2,
	SF: 3,
	F: 3.5,
	PF: 4,
	C: 5,
};

/**
 * Where a position sits on the guard-to-center line, or null when unknown.
 * A combined position ("SG-SF", "F-C") ranks by its first part.
 */
export const positionRank = (pos: string): number | null =>
	POSITION_RANK[pos.split("-")[0].trim().toUpperCase()] ?? null;

/**
 * Orders a team-season's candidates into Team Builder slots.
 *
 * - Players who appeared (g > 0) come first, weighted by ONE metric every one
 *   of them has, best first: total minutes (g * mpg), then total points
 *   (g * ppg), then games. Mixing metrics would compare minutes with points.
 * - Starters are the STARTER_COUNT appeared players with the most games
 *   started when the season tracks it (any appeared player has a gs value; a
 *   blank one counts as 0), else the top by weight.
 *   Ties go to the higher weight. Starters are then sorted guard to center by
 *   positionRank (equal ranks keep their order), but only when every starter
 *   has a known position.
 * - Bench: the remaining appeared players by weight, then players with no
 *   games by rating (unrated last). With fewer than STARTER_COUNT appeared
 *   players, the first bench players fill the open starter slots.
 * - Any remaining tie breaks by id, so the output is stable.
 * - roster = first ROSTER_SIZE; alternates = the next ALTERNATE_COUNT;
 *   starters = min(STARTER_COUNT, roster.length).
 */
export const orderRoster = (candidates: RosterCandidate[]): OrderedRoster => {
	const played = candidates.filter((c) => c.g > 0);
	const unplayed = candidates.filter((c) => !(c.g > 0));

	const weight: (c: RosterCandidate) => number = played.every((c) => c.mpg !== null)
		? (c) => c.g * c.mpg!
		: played.every((c) => c.ppg !== null)
			? (c) => c.g * c.ppg!
			: (c) => c.g;
	const byWeight = (a: RosterCandidate, b: RosterCandidate) =>
		weight(b) - weight(a) || a.id.localeCompare(b.id);
	const byRating = (a: RosterCandidate, b: RosterCandidate) =>
		(b.rating ?? -1) - (a.rating ?? -1) || a.id.localeCompare(b.id);

	const hasGs = played.some((c) => c.gs !== null);
	const startFirst = [...played].sort(
		hasGs ? (a, b) => (b.gs ?? 0) - (a.gs ?? 0) || byWeight(a, b) : byWeight,
	);
	const ordered = [
		...startFirst.slice(0, STARTER_COUNT),
		...startFirst.slice(STARTER_COUNT).sort(byWeight),
		...unplayed.sort(byRating),
	];

	const lineup = ordered.slice(0, STARTER_COUNT);
	if (lineup.every((c) => positionRank(c.pos) !== null)) {
		lineup.sort((a, b) => positionRank(a.pos)! - positionRank(b.pos)!);
	}
	const ids = [...lineup, ...ordered.slice(STARTER_COUNT)].map((c) => c.id);

	return {
		roster: ids.slice(0, ROSTER_SIZE),
		starters: Math.min(STARTER_COUNT, ids.length),
		alternates: ids.slice(ROSTER_SIZE, ROSTER_SIZE + ALTERNATE_COUNT),
	};
};

const numberOrNull = (text: string | undefined): number | null => {
	if (text === undefined) return null;
	const trimmed = text.trim();
	if (!trimmed) return null;
	const value = Number(trimmed);
	return Number.isFinite(value) ? value : null;
};

const playerIdFromHref = (href: string | undefined) =>
	href?.match(/\/players\/[a-z]\/([a-z0-9]+)\.html/)?.[1];

// Traded players get a totals row ("2TM", "3TM"; "TOT" on older layouts) on
// top of one row per team. Only the per-team rows say who played where.
const isTotalsTeam = (team: string) => /^\d+TM$/.test(team) || team === "TOT";

/**
 * Parses `table#per_game_stats` of /leagues/{L}_{Y}_per_game.html. The page
 * also has `#per_game_stats_post` (playoffs) with the same columns, which is
 * skipped.
 */
export const parsePerGame = (body: string): PerGameRow[] => {
	const $ = cheerio.load(body);
	const rows: PerGameRow[] = [];
	for (const tr of $("table#per_game_stats > tbody > tr")) {
		const row = $(tr);
		if (row.hasClass("thead")) continue;
		const cell = (stat: string) => row.find(`[data-stat="${stat}"]`);
		const name = cell("name_display");
		// The id is an attribute on some layouts and only in the link on others.
		// "League Average" rows have neither.
		const id = name.attr("data-append-csv") || playerIdFromHref(name.find("a").attr("href"));
		const team = cell("team_name_abbr").text().trim();
		if (!id || !team || isTotalsTeam(team)) continue;
		const g = numberOrNull(cell("games").text());
		if (g === null) continue;
		const gsCell = cell("games_started");
		const mpCell = cell("mp_per_g");
		rows.push({
			id,
			team,
			pos: cell("pos").text().trim(),
			g,
			gs: gsCell.length ? numberOrNull(gsCell.text()) : null,
			// csk holds the unrounded value.
			mpg: mpCell.length ? numberOrNull(mpCell.attr("csk") ?? mpCell.text()) : null,
			ppg: numberOrNull(cell("pts_per_g").attr("csk") ?? cell("pts_per_g").text()),
		});
	}
	return rows;
};

/** Parses `table#{L}_coaches` of /leagues/{L}_{Y}_coaches.html. */
export const parseCoaches = (body: string, league: League): CoachRow[] => {
	const $ = cheerio.load(body);
	const rows: CoachRow[] = [];
	for (const tr of $(`table#${league}_coaches > tbody > tr`)) {
		const row = $(tr);
		if (row.hasClass("thead")) continue;
		const link = row.find('[data-stat="coach"] a');
		const coachId = link.attr("href")?.match(/\/coaches\/([a-z0-9]+)\.html/)?.[1];
		const team = row.find('[data-stat="team"]').text().trim();
		const g = numberOrNull(row.find('[data-stat="cur_g"]').text());
		if (!coachId || !team || g === null) continue;
		rows.push({ coachId, name: link.text().trim(), team, g });
	}
	return rows;
};

/** Each team's coach: the one who coached it the most games that season. */
export const coachByTeam = (rows: CoachRow[]): Map<string, CoachRow> => {
	const best = new Map<string, CoachRow>();
	for (const row of rows) {
		const current = best.get(row.team);
		if (!current || row.g > current.g) best.set(row.team, row);
	}
	return best;
};

/**
 * Parses `table#advanced-team` of /leagues/{L}_{Y}.html: every team's code
 * (from its link), full name for that season and home arena.
 */
export const parseLeagueTeams = (body: string): LeagueTeam[] => {
	const $ = cheerio.load(body);
	const teams: LeagueTeam[] = [];
	for (const tr of $("table#advanced-team > tbody > tr")) {
		const row = $(tr);
		const link = row.find('[data-stat="team"] a');
		const code = link.attr("href")?.match(/\/teams\/([A-Z0-9]+)\/\d{4}\.html/)?.[1];
		const name = link.text().trim();
		if (!code || !name) continue;
		const arena = row.find('[data-stat="arena_name"]').text().trim();
		teams.push({ code, name, arena: arena || null });
	}
	return teams;
};

// Codes historicalLogos.json files under another franchise than their own,
// or doesn't list at all and that belong to one it does.
const FRANCHISE_OVERRIDES: Record<string, string> = {
	// historicalLogos files the Nets' first NBA season under NYA.
	NYN: "NJN",
};

/**
 * Lineage code for a season's team code: historicalLogos.json's `team ->
 * franchise`, then the overrides, then the code itself (defunct BAA teams).
 */
export const franchiseResolver = (logoRows: { team: string; franchise: string }[]) => {
	const map = new Map(logoRows.map((row) => [row.team, row.franchise]));
	return (code: string) => FRANCHISE_OVERRIDES[code] ?? map.get(code) ?? code;
};

const perGameTotal = (rows: PerGameRow[], field: "mpg" | "ppg") =>
	rows.some((row) => row[field] === null)
		? null
		: rows.reduce((sum, row) => sum + row.g * row[field]!, 0);

/**
 * One row per player and team. A player traded away and back can be listed
 * twice for the same team; his stints are combined, with per-game numbers
 * weighted by games, so he takes one roster spot.
 */
export const mergeStints = (rows: PerGameRow[]): PerGameRow[] => {
	const groups = new Map<string, PerGameRow[]>();
	for (const row of rows) {
		const key = `${row.id} ${row.team}`;
		groups.set(key, [...(groups.get(key) ?? []), row]);
	}
	return [...groups.values()].map((stints) => {
		if (stints.length === 1) return stints[0];
		const g = stints.reduce((sum, row) => sum + row.g, 0);
		const minutes = perGameTotal(stints, "mpg");
		const points = perGameTotal(stints, "ppg");
		return {
			...stints[0],
			g,
			gs: stints.every((row) => row.gs === null) ? null : stints.reduce((sum, row) => sum + (row.gs ?? 0), 0),
			mpg: minutes === null || !g ? null : minutes / g,
			ppg: points === null || !g ? null : points / g,
		};
	});
};

export const MIN_TEAMS_PER_SEASON = 5;
export const MIN_PLAYERS_PER_TEAM = 8;

/** A player on a team's current roster, before the season page is joined in. */
export interface RosterMember {
	id: string;
	rating?: number | null;
}

export interface SeasonPages {
	league: League;
	year: number;
	perGame: PerGameRow[];
	coaches: CoachRow[];
	teams: LeagueTeam[];
}

/**
 * Builds one season's file from its three parsed pages. `problems` lists
 * whatever makes the season untrustworthy; the caller refuses to publish it
 * when any are reported.
 */
export const buildTeamSeasonFile = (
	pages: SeasonPages,
	franchiseOf: (code: string) => string,
	// players.json's coarse G/F/C positions, for rows the season page leaves blank.
	coarsePositions: Map<string, string>,
	generatedAt: string,
	// The current season's rosters by team code. Without them a team is
	// everyone the per-game page lists for it, which suits a finished season;
	// mid-season that would keep players traded away and miss signings who
	// haven't played.
	members?: Map<string, RosterMember[]>,
): { file: TeamSeasonFile; problems: string[] } => {
	const { league, year } = pages;
	const season = `${league}-${year}`;
	const problems: string[] = [];
	const coaches = coachByTeam(pages.coaches);
	const rowsByTeam = new Map<string, PerGameRow[]>();
	for (const row of mergeStints(pages.perGame)) {
		rowsByTeam.set(row.team, [...(rowsByTeam.get(row.team) ?? []), row]);
	}
	const named = new Set(pages.teams.map((team) => team.code));
	for (const code of rowsByTeam.keys()) {
		if (!named.has(code)) problems.push(`${season}: players listed for ${code}, which the league page doesn't name`);
	}
	if (pages.teams.length < MIN_TEAMS_PER_SEASON) {
		problems.push(`${season}: only ${pages.teams.length} teams`);
	}

	const teams: TeamSeason[] = pages.teams.map((team) => {
		const rows = rowsByTeam.get(team.code) ?? [];
		const listed: RosterCandidate[] = members
			? (members.get(team.code) ?? []).map(({ id, rating }) => ({
					...(rows.find((row) => row.id === id) ?? { id, pos: "", g: 0, gs: null, mpg: null, ppg: null }),
					rating,
				}))
			: rows;
		const candidates = listed.map((row) => ({
			...row,
			pos: row.pos || coarsePositions.get(row.id) || "",
		}));
		if (candidates.length < MIN_PLAYERS_PER_TEAM) {
			problems.push(`${season}: ${team.code} has ${candidates.length} players`);
		}
		const coach = coaches.get(team.code);
		if (!coach) console.warn(`${season}: no coach for ${team.code}`);
		return {
			code: team.code,
			franchise: franchiseOf(team.code),
			name: team.name,
			coachId: coach?.coachId ?? null,
			coachName: coach?.name ?? null,
			arena: team.arena,
			...orderRoster(candidates),
		};
	});

	return {
		file: { version: 1, league, year, label: seasonLabel(year), generatedAt, teams },
		problems,
	};
};

/** "1995-96" for 1996; "1999-00" for 2000. */
export const seasonLabel = (year: number) =>
	`${year - 1}-${String(year % 100).padStart(2, "0")}`;

/**
 * Every finished season Basketball-Reference has a page for: the BAA's three
 * (1947-49), the NBA's since, and the ABA's nine (1968-76).
 */
export const finishedSeasons = (lastFinishedYear: number): { league: League; year: number }[] => {
	const seasons: { league: League; year: number }[] = [];
	for (let year = 1947; year <= 1949; year++) seasons.push({ league: "BAA", year });
	for (let year = 1950; year <= lastFinishedYear; year++) seasons.push({ league: "NBA", year });
	for (let year = 1968; year <= 1976; year++) seasons.push({ league: "ABA", year });
	return seasons;
};

const LEAGUE_ORDER: League[] = ["NBA", "BAA", "ABA"];

/** The index entry for a season file, at `path`. */
export const indexSeason = (file: TeamSeasonFile, path: string): TeamSeasonsIndexSeason => ({
	league: file.league,
	year: file.year,
	label: file.label,
	path,
	teams: file.teams.map(({ code, franchise, name }) => ({ code, franchise, name })),
});

/**
 * `seasons` with `entry` added or replaced, newest first. Throws when one of
 * its team codes is already used that year by the other league, since the
 * web's `?real=CODE-YEAR` links could no longer tell them apart.
 */
export const withIndexSeason = (
	seasons: TeamSeasonsIndexSeason[],
	entry: TeamSeasonsIndexSeason,
): TeamSeasonsIndexSeason[] => {
	const others = seasons.filter((s) => !(s.league === entry.league && s.year === entry.year));
	const taken = new Set(
		others.filter((s) => s.year === entry.year).flatMap((s) => s.teams.map((t) => t.code)),
	);
	const clash = entry.teams.find((t) => taken.has(t.code));
	if (clash) throw new Error(`${clash.code}-${entry.year} is used by two leagues`);
	return [...others, entry].sort(
		(a, b) => b.year - a.year || LEAGUE_ORDER.indexOf(a.league) - LEAGUE_ORDER.indexOf(b.league),
	);
};

/** Season page paths, relative to the Basketball-Reference origin. */
export const seasonPaths = (league: League, year: number) => ({
	perGame: `/leagues/${league}_${year}_per_game.html`,
	coaches: `/leagues/${league}_${year}_coaches.html`,
	league: `/leagues/${league}_${year}.html`,
});
