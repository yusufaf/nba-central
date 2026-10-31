// The team-season files in the assets bucket, served by the assets CDN. The
// web reads them to start a team from a real NBA, BAA or ABA team-season.
// Finished seasons are written once by refresh-team-seasons; the current
// season weekly by setPlayersData.

export type League = "NBA" | "BAA" | "ABA";

export interface TeamSeason {
	// Basketball-Reference team code for that season, e.g. "SEA" in 2008.
	code: string;
	// The franchise's lineage code, e.g. "OKC" for the SuperSonics.
	franchise: string;
	name: string;
	// Basketball-Reference coach id, the `href` id in apps/web's coaches.json.
	coachId: string | null;
	// For coaches coaches.json doesn't list (mostly ABA-only ones). Absent
	// from files published before it was added.
	coachName?: string | null;
	arena: string | null;
	// BBRef player ids in Team Builder slot order.
	roster: string[];
	// The first `starters` roster ids fill the starter slots.
	starters: number;
	// Next in line, for a roster id the builder can't resolve.
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

// Finished seasons only; the current season is its own file.
export interface TeamSeasonsIndex {
	version: 1;
	generatedAt: string;
	// Newest first.
	seasons: TeamSeasonsIndexSeason[];
}
