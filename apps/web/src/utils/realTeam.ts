import coachesData from "@/assets/data/coaches.json";
import execsData from "@/assets/data/execs.json";
import historicalJerseysData from "@/assets/data/historicalJerseys.json";
import historicalLogosData from "@/assets/data/historicalLogos.json";
import historicalTeamsData from "@/assets/data/nbaHistoricalTeams.json";
import type { ResolvedArena } from "@/models/api";
import type { Coach, GM, HistoricalJersey, HistoricalLogo } from "@/models/types";
import type {
    League,
    TeamSeason,
    TeamSeasonFile,
    TeamSeasonsIndex,
    TeamSeasonsIndexTeam,
} from "@/models/teamSeasons";
import { backfillArena } from "@/utils/arenaDetails";

const coaches = coachesData as (Coach & { href: string })[];
const execs = execsData as (GM & { href: string })[];
const historicalJerseys = historicalJerseysData as HistoricalJersey[];
const historicalLogos = historicalLogosData as HistoricalLogo[];
const historicalTeams = historicalTeamsData as { name: string; city: string; country: string }[];

/** A real team-season, as `?real=CHI-1996` names it: team code and season end year. */
export interface RealTeamRef {
    code: string;
    year: number;
}

export const parseRealParam = (value: unknown): RealTeamRef | null => {
    if (typeof value !== "string") return null;
    const match = /^([A-Z]{3})-(\d{4})$/.exec(value);
    return match ? { code: match[1], year: Number(match[2]) } : null;
};

export const realParam = ({ code, year }: RealTeamRef): string => `${code}-${year}`;

/** One season the picker offers; `path` is null for the current season's file. */
export interface SeasonChoice {
    league: League;
    year: number;
    label: string;
    path: string | null;
    teams: TeamSeasonsIndexTeam[];
}

/** Every season with a file, newest first; the current one leads when it has a file. */
export const seasonChoices = (index: TeamSeasonsIndex, current: TeamSeasonFile | null): SeasonChoice[] => {
    const finished: SeasonChoice[] = index.seasons.map((s) => ({ ...s }));
    // Around the rollover the finished-season index can already hold the
    // season current.json still describes; the finished file wins.
    if (!current || finished.some((s) => s.league === current.league && s.year === current.year)) {
        return finished;
    }
    const teams = current.teams.map(({ code, franchise, name }) => ({ code, franchise, name }));
    return [{ league: current.league, year: current.year, label: current.label, path: null, teams }, ...finished];
};

export interface FranchiseSeason extends TeamSeasonsIndexTeam {
    league: League;
    year: number;
    label: string;
}

export interface FranchiseChoice {
    franchise: string;
    // The name of its most recent team-season.
    name: string;
    // Newest first.
    seasons: FranchiseSeason[];
}

/** The picker's franchise list, alphabetical, each with its seasons. */
export const franchiseChoices = (choices: SeasonChoice[]): FranchiseChoice[] => {
    const byFranchise = new Map<string, FranchiseSeason[]>();
    for (const choice of choices) {
        for (const team of choice.teams) {
            const season = { ...team, league: choice.league, year: choice.year, label: choice.label };
            byFranchise.set(team.franchise, [...(byFranchise.get(team.franchise) ?? []), season]);
        }
    }
    return [...byFranchise]
        .map(([franchise, seasons]) => ({ franchise, name: seasons[0].name, seasons }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

/** Where `ref` lives among `choices`, or null for a team-season with no file. */
export const findSeasonChoice = (choices: SeasonChoice[], ref: RealTeamRef): SeasonChoice | null =>
    choices.find((c) => c.year === ref.year && c.teams.some((t) => t.code === ref.code)) ?? null;

// The builder's slots: 1-5 start, 6-15 come off the bench.
const FIRST_BENCH_SLOT = 6;
const LAST_SLOT = 15;

/**
 * Slot -> player id for a team-season. A roster id missing from `known`
 * (getPlayers didn't return it) gives its spot to the next alternate.
 */
export const rosterSlots = (team: TeamSeason, known: Set<string>): Map<number, string> => {
    const alternates = team.alternates.filter((id) => known.has(id) && !team.roster.includes(id));
    const ids = [
        ...new Set(
            team.roster.flatMap((id) => {
                if (known.has(id)) return [id];
                const next = alternates.shift();
                return next ? [next] : [];
            }),
        ),
    ];
    const starters = Math.min(team.starters, ids.length);
    const slots = ids.map((id, i): [number, string] => [i < starters ? i + 1 : FIRST_BENCH_SLOT + i - starters, id]);
    return new Map(slots.filter(([slot]) => slot <= LAST_SLOT));
};

const logoFranchise = new Map(historicalLogos.map((row) => [row.team, row.franchise]));
// Mirrors FRANCHISE_OVERRIDES in apps/cdk/utilities/team-seasons.ts.
const franchiseOf = (code: string) => (code === "NYN" ? "NJN" : logoFranchise.get(code) ?? code);

/** The team-season's logo era from historicalLogos.json. */
export const findLogo = (code: string, year: number): string =>
    historicalLogos.find((row) => row.team === code && row.startYear <= year && year <= row.endYear)?.logo ?? "";

/**
 * The season's home/road jersey, else any of its jerseys. Matched on the
 * year range: many rows leave `seasons` empty. A "...-Present" design is
 * still worn, whatever season its row's endYear stopped at.
 */
export const findJersey = (franchise: string, year: number): string => {
    const worn = historicalJerseys.filter(
        (row) =>
            row.franchise === franchise &&
            row.startYear <= year &&
            (year <= row.endYear || /present/i.test(row.name)),
    );
    return (worn.find((row) => row.slot === "home-road") ?? worn[0])?.jersey ?? "";
};

/** coaches.json's row, so stats and the Hall of Fame star come along; else the name alone. */
export const findCoach = (team: TeamSeason): Coach | null => {
    const row = team.coachId ? coaches.find((c) => c.href === `/coaches/${team.coachId}.html`) : undefined;
    if (row) return row;
    return team.coachName ? ({ name: team.coachName, isCustom: false } as Coach) : null;
};

interface Stint {
    franchise: string;
    start: number;
    end: number;
}

// "CHI (1985-2003)", "BOS (2003-21)", "FTW (1957)", and across a move,
// "SEA/OKC (2007-27)" (one lineage, so the first code names it).
export const parseStint = (text: string): Stint | null => {
    const match = /^([A-Z]{3})(?:\/[A-Z]{3})* \((\d{4})(?:-(\d{2}|\d{4}))?\)$/.exec(text.trim());
    if (!match) return null;
    const start = Number(match[2]);
    let end = match[3] ? Number(match[3]) : start;
    if (match[3]?.length === 2) {
        end += start - (start % 100);
        if (end < start) end += 100;
    }
    return { franchise: franchiseOf(match[1]), start, end };
};

/**
 * The executive running the franchise that season. A stint's first year is
 * when he was hired, so in a year two stints share, the one hired earlier ran
 * the season and the newcomer was hired at its end.
 */
export const findGM = (franchise: string, year: number): GM | null => {
    let best: { gm: GM; start: number } | null = null;
    for (const gm of execs) {
        for (const text of gm.teams) {
            const stint = parseStint(text);
            if (!stint || stint.franchise !== franchise || year < stint.start || year > stint.end) continue;
            if (!best || stint.start < best.start) best = { gm, start: stint.start };
        }
    }
    return best?.gm ?? null;
};

/** "Madison Square Garden (IV)" -> "Madison Square Garden", to match arenas.json. */
export const arenaName = (raw: string): string => raw.replace(/\s+\((?:[IVX]+)\)$/, "").trim();

export interface RealTeamDetails {
    teamName: string;
    teamCity: string;
    teamCountry: string;
    teamLogo: string;
    teamJersey: string;
    teamCoach: Coach | null;
    teamGM: GM | null;
    teamArena: ResolvedArena | null;
}

/** Everything but the roster for a team-season. */
export const realTeamDetails = (team: TeamSeason, season: { year: number; label: string }): RealTeamDetails => {
    const place = historicalTeams.find((t) => t.name === team.name);
    return {
        teamName: `${season.label} ${team.name}`,
        teamCity: place?.city ?? "",
        teamCountry: place?.country ?? "",
        teamLogo: findLogo(team.code, season.year),
        teamJersey: findJersey(team.franchise, season.year),
        teamCoach: findCoach(team),
        teamGM: findGM(team.franchise, season.year),
        teamArena: team.arena ? backfillArena({ name: arenaName(team.arena) } as ResolvedArena) : null,
    };
};
