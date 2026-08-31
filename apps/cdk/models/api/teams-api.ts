import { ApiResponse } from "./custom-entities-api";

// A player record as embedded in a saved team - a snapshot so a team
// renders exactly as it was saved, independent of later roster/rating
// changes upstream. Mirrors the frontend's `Player` union (models/types.ts):
// API players and custom players carry different field sets (snake_case
// height/weight + team vs. camelCase + no team), so only `fullName` - always
// set before a player reaches the roster - is required here.
export interface PlayerSnapshot {
	fullName: string;
	id?: string;
	first_name?: string;
	last_name?: string;
	position?: string;
	team?: {
		full_name?: string;
		abbreviation?: string;
	};
	height_feet?: number | null;
	height_inches?: number | null;
	weight_pounds?: number | null;
	active?: boolean;
	rating?: number;
	ratingSource?: string;
	positions?: string[];
	isCustom?: boolean;
	playerUUID?: string;
	heightFeet?: number;
	heightInches?: number;
	weightPounds?: number;
	overallRating?: number;
}

export interface TeamRosterEntry {
	slot: number;
	player: PlayerSnapshot;
}

// Coaches/GMs from the checked-in JSON are only identified by name; custom
// ones also carry a UUID. Keeping both means a team still renders if a
// refresh-* script later drops the underlying row.
export interface EntityRef {
	name: string;
	isCustom: boolean;
	uuid?: string;
}

export interface TeamArenaRef {
	name: string;
	imgLink?: string;
}

export interface SaveTeamPayload {
	title: string;
	description?: string;
	city?: string;
	country?: string;
	logoUrl?: string;
	roster: TeamRosterEntry[];
	coach: EntityRef | null;
	gm: EntityRef | null;
	arena: TeamArenaRef | null;
}

export interface UpdateTeamPayload extends SaveTeamPayload {
	teamUUID: string;
}

export interface SavedTeam {
	teamUUID: string;
	userUUID: string;
	username: string;
	title: string;
	description: string;
	city: string;
	country: string;
	logoUrl: string;
	playerCount: number;
	roster: TeamRosterEntry[];
	coach: EntityRef | null;
	gm: EntityRef | null;
	arena: TeamArenaRef | null;
	favorited: boolean;
	label: string;
	lastViewed: number;
	createdAt: number;
	updatedAt: number;
}

export type TeamSummary = Omit<SavedTeam, "roster" | "coach" | "gm" | "arena">;

export interface ListTeamsData {
	teams: TeamSummary[];
}

export type CreateTeamResponse = ApiResponse<SavedTeam>;
export type ListTeamsResponse = ApiResponse<ListTeamsData>;
export type GetTeamResponse = ApiResponse<SavedTeam>;
export type UpdateTeamResponse = ApiResponse<SavedTeam>;
export type DeleteTeamResponse = ApiResponse<void>;
