// The team-season files on the assets CDN (apps/cdk/models/team-seasons.ts):
// finished seasons from refresh-team-seasons, the current one from
// setPlayersData. Keep the two in step.

export type League = "NBA" | "BAA" | "ABA";

export interface TeamSeason {
    // Basketball-Reference team code for that season, e.g. "SEA" in 2008.
    code: string;
    // The franchise's lineage code, e.g. "OKC" for the SuperSonics.
    franchise: string;
    name: string;
    // Basketball-Reference coach id, the `href` id in coaches.json.
    coachId: string | null;
    // For coaches coaches.json doesn't list; absent from older files.
    coachName?: string | null;
    arena: string | null;
    // BBRef player ids in Team Builder slot order.
    roster: string[];
    // The first `starters` roster ids fill the starter slots.
    starters: number;
    // Next in line, for a roster id getPlayers doesn't know.
    alternates: string[];
}

export interface TeamSeasonFile {
    version: 1;
    league: League;
    // Season end year, e.g. 1996 for 1995-96.
    year: number;
    label: string;
    generatedAt: string;
    teams: TeamSeason[];
}

export interface TeamSeasonsIndexTeam {
    code: string;
    franchise: string;
    name: string;
}

export interface TeamSeasonsIndexSeason {
    league: League;
    year: number;
    label: string;
    // Key of the season's file, relative to the assets CDN root.
    path: string;
    teams: TeamSeasonsIndexTeam[];
}

// Finished seasons only, newest first; the current season is its own file.
export interface TeamSeasonsIndex {
    version: 1;
    generatedAt: string;
    seasons: TeamSeasonsIndexSeason[];
}
