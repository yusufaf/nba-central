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
	appearance?: StaffAppearance;
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
	appearance?: StaffAppearance;
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

// Custom coaches and GMs (#294). Staff wear only what STAFF_ACCESSORIES lists.
export const OUTFIT_STYLES = ["suit", "polo", "tracksuit"] as const;
export const AGE_LOOKS = ["young", "prime", "veteran"] as const;
export const STAFF_ACCESSORIES = ["glasses"] as const;
export const STAFF_HEIGHT_INCHES = { min: 60, max: 90 } as const;

export type OutfitStyleId = (typeof OUTFIT_STYLES)[number];
export type AgeLookId = (typeof AGE_LOOKS)[number];

export interface StaffOutfit {
	style: OutfitStyleId;
	primary: string;
	secondary: string;
}

// A staff look is a person's look plus these; it never has a jersey number.
export interface StaffAppearance extends Omit<PersonAppearance, "build" | "jerseyNumber"> {
	build: PersonAppearance["build"] & { heightIn: number };
	outfit: StaffOutfit;
	ageLook: AgeLookId;
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

// An arena's 3D venue (#295). Later tabs (#296-#298) add optional keys; version stays 1.
// apps/web keeps a copy of SEAT_PATTERNS, BANNER_KINDS and the text limits in src/constants/venue.ts;
// test/utilities/venue.test.ts fails on drift.
export const SEAT_PATTERNS = ["solid", "sections", "rows", "gradient"] as const;
export type SeatPatternId = (typeof SEAT_PATTERNS)[number];

export const SCOREBOARD_TEXT_MAX = 16;
export const RIBBON_TEXT_MAX = 32;

// Rafters banners (#297): championship or retired-number banners.
export const BANNER_KINDS = ["title", "number"] as const;
export type BannerKindId = (typeof BANNER_KINDS)[number];
export const BANNERS_MAX = 8;
export const BANNER_TITLE_MAX = 16;
export const BANNER_SUBTITLE_MAX = 24;

export interface VenueBanner {
	kind: BannerKindId;
	title: string;
	subtitle: string;
	color: string;
}

// Every part is optional (#296): an arena can have a scoreboard without a seat design.
export interface VenueDesign {
	version: 1;
	seats?: { primary: string; secondary: string; pattern: SeatPatternId };
	upperDeck?: boolean;
	scoreboard?: { text: string; accent: string };
	ribbon?: { text: string; color: string };
	banners?: VenueBanner[];
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
	venue?: VenueDesign;
	photoUrl?: string;
	photoKey?: string;
	logoUrl?: string;
	logoKey?: string;
	drawingUrl?: string;
	drawingKey?: string;
	createdBy: string;
}
