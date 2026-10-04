import { ApiResponse } from "./custom-entities-api";
import type { CourtDesign } from "../custom-entities";

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

// What a team stores for its arena. Built-in arenas keep their full details
// (rows saved before #116 only have name and imgLink). A custom arena keeps
// its uuid plus a text copy of its details, which is what's shown if the
// arena is later deleted, or when the team is someone else's remix.
export interface TeamArenaRef {
	name: string;
	location?: string;
	capacity?: number;
	openedYear?: number;
	// Built-in only: the Wikimedia thumbnail.
	imgLink?: string;
	// Absent = built-in.
	isCustom?: boolean;
	// Custom only, and only ever the team owner's own arena (see
	// resources/dynamo/arenas.ts).
	arenaUUID?: string;
}

// What getTeam and getPublicTeam return: the stored ref with the live
// arena's details, court and images. A separate type, so none of these is
// ever saved back onto the team.
export interface ResolvedArena extends TeamArenaRef {
	court?: CourtDesign;
	photoUrl?: string;
	logoUrl?: string;
	drawingUrl?: string;
	// The arenaUUID no longer resolves: show the text copy alone.
	missing?: true;
}

export interface SaveTeamPayload {
	title: string;
	description?: string;
	city?: string;
	country?: string;
	logoUrl?: string;
	jerseyUrl?: string;
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
	jerseyUrl: string;
	playerCount: number;
	roster: TeamRosterEntry[];
	coach: EntityRef | null;
	gm: EntityRef | null;
	arena: ResolvedArena | null;
	favorited: boolean;
	label: string;
	// Share loop (see docs/superpowers/specs/2026-09-19-share-loop-design.md).
	// `public` is opt-in and link-only; absent on rows saved before the
	// feature shipped, which readers treat as false.
	public: boolean;
	publishedAt?: number;
	cardUrl?: string;
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

// What the anonymous `/api/teams/public/{teamUUID}` reader returns. The
// owner's `username` is deliberate attribution; `userUUID` never leaves the
// API, and the owner-only bookkeeping fields go with it.
export type PublicTeam = Omit<
	SavedTeam,
	"userUUID" | "favorited" | "label" | "lastViewed"
>;

export interface PublishTeamPayload {
	teamUUID: string;
	public: boolean;
	// Base64-encoded PNG (no data: prefix) rendered client-side. Optional so
	// unpublishing, and publishing when the render failed, still work.
	cardPng?: string | null;
}

export type PublishTeamResponse = ApiResponse<SavedTeam>;
export type GetPublicTeamResponse = ApiResponse<PublicTeam>;
