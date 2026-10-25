// The live season files setSeasonContextData writes under live/ in the assets
// bucket, served by the assets CDN. The web reads them instead of ESPN, so
// every field here is something a page shows or a later run needs.

export interface StandingsTeam {
	espnId: string;
	name: string;
	abbreviation: string;
	seed: number;
	wins: number;
	losses: number;
	winPercent: number;
	gamesBehind: number;
	streak: string;
	lastTen: string;
	home: string;
	road: string;
}

export type ConferenceName = "East" | "West";

export interface StandingsFile {
	version: 1;
	generatedAt: string;
	season: { year: number; displayName: string };
	// Teams sorted by seed.
	conferences: { name: ConferenceName; teams: StandingsTeam[] }[];
}

export type GameStatus = "scheduled" | "live" | "final" | "postponed";

export interface ScheduleTeam {
	espnId: string;
	abbreviation: string;
	// null until the game starts.
	score: number | null;
}

export interface ScheduleGame {
	id: string;
	// As ESPN sends it, e.g. "2026-10-26T23:00Z" (no seconds).
	date: string;
	status: GameStatus;
	home: ScheduleTeam;
	away: ScheduleTeam;
}

export interface ScheduleFile {
	version: 1;
	generatedAt: string;
	// The ET calendar days covered, YYYYMMDD.
	dates: string[];
	games: ScheduleGame[];
}

export interface HeadshotEntry {
	espnId: string;
	team: string;
	// The ESPN roster lists a headshot for this athlete.
	hasHeadshot: boolean;
	// "headshots/{espnId}.png" under live/, once mirrored.
	image: string | null;
	// Epoch seconds of the last 200 or 304 for the image.
	imageAt: number | null;
	// Epoch seconds of the last fetch, whatever the outcome.
	attemptAt: number | null;
	etag: string | null;
}

export interface HeadshotsFile {
	version: 1;
	generatedAt: string;
	// Last successful roster rebuild; null until the first one.
	rostersAt: string | null;
	// Last rebuild attempt, successful or not.
	rostersAttemptedAt: string;
	// Keyed by Basketball-Reference id.
	players: Record<string, HeadshotEntry>;
	// ESPN athletes that matched no BBRef player, as "Name (espnId)".
	unmatched: string[];
}

export interface RosterAthlete {
	espnId: string;
	name: string;
	heightInches: number | null;
	team: string;
	hasHeadshot: boolean;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
