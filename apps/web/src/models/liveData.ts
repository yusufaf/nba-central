// The live season files the assets CDN serves under live/, written hourly by
// apps/cdk's setSeasonContextData (its models/live-data.ts is the source of
// truth). Only the fields the web reads.

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

export interface StandingsConference {
    name: ConferenceName;
    teams: StandingsTeam[];
}

export interface StandingsFile {
    version: 1;
    generatedAt: string;
    season: { year: number; displayName: string };
    conferences: StandingsConference[];
}

export type GameStatus = "scheduled" | "live" | "final" | "postponed";

export interface ScheduleTeam {
    espnId: string;
    abbreviation: string;
    score: number | null;
}

export interface ScheduleGame {
    id: string;
    date: string;
    status: GameStatus;
    home: ScheduleTeam;
    away: ScheduleTeam;
}

export interface ScheduleFile {
    version: 1;
    generatedAt: string;
    dates: string[];
    games: ScheduleGame[];
}

export interface HeadshotsFile {
    version: 1;
    generatedAt: string;
    // Keyed by Basketball-Reference id; `image` is relative to live/ and null
    // until the image is mirrored.
    players: Record<string, { image: string | null }>;
}
