import { CoachSpecialty } from "./api/custom-entities-api";

// DynamoDB Item Types (database layer)
export interface CustomGMItem {
	PK: string;
	SK: string;
	entityType: string;
	created: string;
	updated: string;
	gmUUID: string;
	name: string;
	teams: string[];
	createdBy: string;
}

export interface CustomCoachItem {
	PK: string;
	SK: string;
	entityType: string;
	created: string;
	updated: string;
	coachUUID: string;
	name: string;
	overallRating: number;
	specialty: CoachSpecialty;
	createdBy: string;
}

export interface CustomPlayerItem {
	PK: string;
	SK: string;
	entityType: string;
	created: string;
	updated: string;
	playerUUID: string;
	name: string;
	position: string;
	heightFeet: number;
	heightInches: number;
	weightPounds: number;
	overallRating: number;
	createdBy: string;
}

// Settings only: every surface draws the court from these. The hex colours
// are user content, not design tokens. Text colour isn't a setting; it's
// picked at render time for contrast against the apron.
export const COURT_WOODS = ["maple", "honey", "walnut", "ash", "ebony"] as const;
export const COURT_CENTER_LOGOS = ["none", "team", "upload"] as const;

export interface CourtDesign {
	version: 1;
	wood: (typeof COURT_WOODS)[number];
	paint: string | null;
	apron: string | null;
	lines: string;
	centerLogo: (typeof COURT_CENTER_LOGOS)[number];
	baselineText: string;
	sidelineText: string;
}

// One image per slot under arenas/<arenaUUID>/. Keys use the arena's uuid,
// never the owner's sub, so a public image URL doesn't say whose arena it is.
export const ARENA_IMAGE_SLOTS = ["photo", "logo", "drawing"] as const;
export type ArenaImageSlot = (typeof ARENA_IMAGE_SLOTS)[number];

export const MAX_CUSTOM_ARENAS = 20;

export interface CustomArenaItem {
	PK: string;
	SK: string;
	entityType: "customArena";
	created: string;
	updated: string;
	arenaUUID: string;
	name: string;
	location: string;
	capacity: number | null;
	openedYear: number | null;
	court: CourtDesign | null;
	photoUrl?: string;
	photoKey?: string;
	logoUrl?: string;
	logoKey?: string;
	drawingUrl?: string;
	drawingKey?: string;
	createdBy: string;
}
