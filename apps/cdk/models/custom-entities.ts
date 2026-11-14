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

// A custom person's look (spec: docs/superpowers/specs/2026-11-05-3d-builders-design.md).
// Real people never have one: they render as figurines. apps/web keeps a copy
// of these arrays in src/constants/appearance.ts; test/utilities/appearance.test.ts
// fails if the two drift. A new id ships here (and is deployed) before the web.
export const APPEARANCE_FRAMES = ["m", "f"] as const;
export const HAIR_STYLES = ["none", "buzzed", "parted", "buzzedFemale", "long", "buns"] as const;
export const FACIAL_HAIR_STYLES = ["none", "beard"] as const;
export const ACCESSORIES = ["headband", "armSleeve", "goggles", "glasses"] as const;
export const POSES = ["relaxed", "handsOnHips", "armsCrossed", "celebrate"] as const;
export const MAX_ACCESSORIES = 4;

export type AppearanceFrame = (typeof APPEARANCE_FRAMES)[number];
export type HairStyleId = (typeof HAIR_STYLES)[number];
export type FacialHairId = (typeof FACIAL_HAIR_STYLES)[number];
export type AccessoryId = (typeof ACCESSORIES)[number];
export type PoseId = (typeof POSES)[number];

export interface PersonAppearance {
	version: 1;
	frame: AppearanceFrame;
	skin: string;
	hair: { style: HairStyleId; color: string };
	facialHair: { style: FacialHairId; color: string };
	build: { girth: number; shoulders: number; wingspan: number };
	accessories: { id: AccessoryId; color: string }[];
	// Worn when the team gives the player no roster number.
	jerseyNumber?: string;
	pose: PoseId;
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
	appearance?: PersonAppearance;
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
