import {
	ACCESSORIES,
	AGE_LOOKS,
	APPEARANCE_FRAMES,
	BANNER_KINDS,
	BANNER_SUBTITLE_MAX,
	BANNER_TITLE_MAX,
	BANNERS_MAX,
	COURT_CENTER_LOGOS,
	COURT_WOODS,
	CourtDesign,
	FACIAL_HAIR_STYLES,
	HAIR_STYLES,
	MAX_ACCESSORIES,
	OUTFIT_STYLES,
	PersonAppearance,
	POSES,
	RIBBON_TEXT_MAX,
	SCOREBOARD_TEXT_MAX,
	SEAT_PATTERNS,
	STAFF_ACCESSORIES,
	STAFF_HEIGHT_INCHES,
	StaffAppearance,
	VenueDesign,
} from "../models/custom-entities";
import { isOneOf, isRecord } from "./type-guards";

export const validateGMData = (data: unknown): { valid: boolean; error?: string } => {
	if (!isRecord(data)) {
		return { valid: false, error: "Invalid request body" };
	}

	if (!data.name || typeof data.name !== "string") {
		return { valid: false, error: "Name is required and must be a string" };
	}

	const trimmedName = data.name.trim();
	if (trimmedName.length === 0 || trimmedName.length > 100) {
		return { valid: false, error: "Name must be between 1 and 100 characters" };
	}

	if (data.teams && !Array.isArray(data.teams)) {
		return { valid: false, error: "Teams must be an array" };
	}

	if (data.teams) {
		for (const team of data.teams as unknown[]) {
			if (typeof team !== "string" || team.length < 2 || team.length > 4) {
				return { valid: false, error: "Each team code must be 2-4 characters" };
			}
			if (!/^[A-Z]+$/.test(team)) {
				return { valid: false, error: "Team codes must contain only uppercase letters" };
			}
		}
	}

	if (data.appearance != null) {
		const error = staffAppearanceError(data.appearance);
		if (error) return { valid: false, error };
	}

	return { valid: true };
};

export const validateCoachData = (data: unknown): { valid: boolean; error?: string } => {
	if (!isRecord(data)) {
		return { valid: false, error: "Invalid request body" };
	}

	if (!data.name || typeof data.name !== "string") {
		return { valid: false, error: "Name is required and must be a string" };
	}

	const trimmedName = data.name.trim();
	if (trimmedName.length === 0 || trimmedName.length > 100) {
		return { valid: false, error: "Name must be between 1 and 100 characters" };
	}

	if (typeof data.overallRating !== "number") {
		return { valid: false, error: "Overall rating is required and must be a number" };
	}

	if (data.overallRating < 0 || data.overallRating > 99) {
		return { valid: false, error: "Overall rating must be between 0 and 99" };
	}

	if (!data.specialty || typeof data.specialty !== "string") {
		return { valid: false, error: "Specialty is required and must be a string" };
	}

	const validSpecialties = ['Offensive', 'Defensive', 'Balanced'];
	if (!validSpecialties.includes(data.specialty)) {
		return { valid: false, error: "Specialty must be Offensive, Defensive, or Balanced" };
	}

	if (data.appearance != null) {
		const error = staffAppearanceError(data.appearance);
		if (error) return { valid: false, error };
	}

	return { valid: true };
};

export const validatePlayerData = (data: unknown): { valid: boolean; error?: string } => {
	if (!isRecord(data)) {
		return { valid: false, error: "Invalid request body" };
	}

	if (!data.name || typeof data.name !== "string") {
		return { valid: false, error: "Name is required and must be a string" };
	}

	const trimmedName = data.name.trim();
	if (trimmedName.length === 0 || trimmedName.length > 100) {
		return { valid: false, error: "Name must be between 1 and 100 characters" };
	}

	if (!data.position || typeof data.position !== "string") {
		return { valid: false, error: "Position is required and must be a string" };
	}

	const validPositions = ['PG', 'SG', 'SF', 'PF', 'C'];
	if (!validPositions.includes(data.position)) {
		return { valid: false, error: "Position must be PG, SG, SF, PF, or C" };
	}

	if (typeof data.heightFeet !== "number") {
		return { valid: false, error: "Height (feet) is required and must be a number" };
	}

	if (data.heightFeet < 4 || data.heightFeet > 8) {
		return { valid: false, error: "Height (feet) must be between 4 and 8" };
	}

	if (typeof data.heightInches !== "number") {
		return { valid: false, error: "Height (inches) is required and must be a number" };
	}

	if (data.heightInches < 0 || data.heightInches > 11) {
		return { valid: false, error: "Height (inches) must be between 0 and 11" };
	}

	if (typeof data.weightPounds !== "number") {
		return { valid: false, error: "Weight is required and must be a number" };
	}

	if (data.weightPounds < 100 || data.weightPounds > 400) {
		return { valid: false, error: "Weight must be between 100 and 400 pounds" };
	}

	if (typeof data.overallRating !== "number") {
		return { valid: false, error: "Overall rating is required and must be a number" };
	}

	if (data.overallRating < 0 || data.overallRating > 99) {
		return { valid: false, error: "Overall rating must be between 0 and 99" };
	}

	if (data.appearance != null) {
		const error = appearanceError(data.appearance);
		if (error) return { valid: false, error };
	}

	return { valid: true };
};

export const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

// "0" to "99" and "00"; a leading zero on anything else ("07") isn't a real
// jersey number. apps/web's src/utils/rosterNumbers.ts has the same pattern.
export const JERSEY_NUMBER = /^(?:00|0|[1-9][0-9]?)$/;

const isHex = (value: unknown): value is string => typeof value === "string" && HEX_COLOUR.test(value);
const BUILD_FIELDS = ["girth", "shoulders", "wingspan"] as const;

const styledError = (
	label: string,
	value: unknown,
	styles: readonly string[],
): string | null => {
	if (!isRecord(value)) return `Appearance ${label} must be {style, color}`;
	if (!isOneOf(styles, value.style)) return `Appearance ${label} style must be one of ${styles.join(", ")}`;
	if (!isHex(value.color)) return `Appearance ${label} color must be a #rrggbb colour`;
	return null;
};

// The checks a player's and a staff member's look share. Staff pass their own
// accessory list and skip the jersey number, which they never have.
const lookError = (value: unknown, accessories: readonly string[], jerseyNumber: boolean): string | null => {
	if (!isRecord(value)) return "Appearance must be an object";
	if (value.version !== 1) return "Appearance version must be 1";
	if (!isOneOf(APPEARANCE_FRAMES, value.frame)) return `Appearance frame must be one of ${APPEARANCE_FRAMES.join(", ")}`;
	if (!isHex(value.skin)) return "Appearance skin must be a #rrggbb colour";
	const hair = styledError("hair", value.hair, HAIR_STYLES);
	if (hair) return hair;
	const facialHair = styledError("facial hair", value.facialHair, FACIAL_HAIR_STYLES);
	if (facialHair) return facialHair;
	if (!isRecord(value.build)) return "Appearance build must be {girth, shoulders, wingspan}";
	for (const field of BUILD_FIELDS) {
		const slider = value.build[field];
		if (typeof slider !== "number" || !Number.isFinite(slider) || slider < -1 || slider > 1) {
			return `Appearance build ${field} must be a number from -1 to 1`;
		}
	}
	if (!Array.isArray(value.accessories)) return "Appearance accessories must be an array";
	if (value.accessories.length > MAX_ACCESSORIES) return `Appearance can have at most ${MAX_ACCESSORIES} accessories`;
	const seen = new Set<unknown>();
	for (const accessory of value.accessories as unknown[]) {
		if (!isRecord(accessory) || !isOneOf(accessories, accessory.id)) {
			return `Appearance accessories must be one of ${accessories.join(", ")}`;
		}
		if (!isHex(accessory.color)) return "Appearance accessory color must be a #rrggbb colour";
		if (seen.has(accessory.id)) return "Appearance accessories must not repeat";
		seen.add(accessory.id);
	}
	const number = value.jerseyNumber;
	if (jerseyNumber && number != null && (typeof number !== "string" || !JERSEY_NUMBER.test(number))) {
		return "Appearance jersey number must be 0-99 or 00";
	}
	if (!isOneOf(POSES, value.pose)) return `Appearance pose must be one of ${POSES.join(", ")}`;
	return null;
};

/** Why a stored look is invalid, or null. Every key is checked; unknown ones are ignored here and dropped by toAppearance. */
export const appearanceError = (value: unknown): string | null => lookError(value, ACCESSORIES, true);

/** Why a custom coach's or GM's look is invalid, or null. A jersey number is ignored, and toStaffAppearance drops it. */
export const staffAppearanceError = (value: unknown): string | null => {
	const shared = lookError(value, STAFF_ACCESSORIES, false);
	if (shared) return shared;
	const look = value as Record<string, unknown>;
	const build = look.build as Record<string, unknown>;
	if (!isWholeNumberIn(build.heightIn, STAFF_HEIGHT_INCHES.min, STAFF_HEIGHT_INCHES.max)) {
		return `Appearance height must be a whole number of inches from ${STAFF_HEIGHT_INCHES.min} to ${STAFF_HEIGHT_INCHES.max}`;
	}
	const outfit = look.outfit;
	if (!isRecord(outfit)) return "Appearance outfit must be {style, primary, secondary}";
	if (!isOneOf(OUTFIT_STYLES, outfit.style)) return `Appearance outfit style must be one of ${OUTFIT_STYLES.join(", ")}`;
	for (const field of ["primary", "secondary"] as const) {
		if (!isHex(outfit[field])) return `Appearance outfit ${field} must be a #rrggbb colour`;
	}
	if (!isOneOf(AGE_LOOKS, look.ageLook)) return `Appearance age look must be one of ${AGE_LOOKS.join(", ")}`;
	return null;
};

/** The known keys of a look that passed appearanceError, rebuilt so nothing else is stored. */
export const toAppearance = (value: Record<string, unknown>): PersonAppearance => {
	const look = value as unknown as PersonAppearance;
	return {
		version: 1,
		frame: look.frame,
		skin: look.skin,
		hair: { style: look.hair.style, color: look.hair.color },
		facialHair: { style: look.facialHair.style, color: look.facialHair.color },
		build: { girth: look.build.girth, shoulders: look.build.shoulders, wingspan: look.build.wingspan },
		accessories: look.accessories.map(({ id, color }) => ({ id, color })),
		...(typeof look.jerseyNumber === "string" && { jerseyNumber: look.jerseyNumber }),
		pose: look.pose,
	};
};

/** The known keys of a look that passed staffAppearanceError, rebuilt so nothing else is stored. */
export const toStaffAppearance = (value: Record<string, unknown>): StaffAppearance => {
	const look = value as unknown as StaffAppearance;
	return {
		version: 1,
		frame: look.frame,
		skin: look.skin,
		hair: { style: look.hair.style, color: look.hair.color },
		facialHair: { style: look.facialHair.style, color: look.facialHair.color },
		build: {
			girth: look.build.girth,
			shoulders: look.build.shoulders,
			wingspan: look.build.wingspan,
			heightIn: look.build.heightIn,
		},
		accessories: look.accessories.map(({ id, color }) => ({ id, color })),
		outfit: { style: look.outfit.style, primary: look.outfit.primary, secondary: look.outfit.secondary },
		ageLook: look.ageLook,
		pose: look.pose,
	};
};

const isWholeNumberIn = (value: unknown, min: number, max: number) =>
	Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

const courtError = (court: unknown): string | null => {
	if (!isRecord(court)) {
		return "Court must be an object or null";
	}
	if (court.version !== 1) return "Court version must be 1";
	if (!isOneOf(COURT_WOODS, court.wood)) {
		return `Court wood must be one of ${COURT_WOODS.join(", ")}`;
	}
	for (const field of ["paint", "apron"]) {
		const value = court[field];
		if (value !== null && (typeof value !== "string" || !HEX_COLOUR.test(value))) {
			return `Court ${field} must be a #rrggbb colour or null`;
		}
	}
	if (typeof court.lines !== "string" || !HEX_COLOUR.test(court.lines)) return "Court lines must be a #rrggbb colour";
	if (!isOneOf(COURT_CENTER_LOGOS, court.centerLogo)) {
		return `Court centre logo must be one of ${COURT_CENTER_LOGOS.join(", ")}`;
	}
	if (typeof court.baselineText !== "string" || court.baselineText.length > 20) {
		return "Baseline text must be at most 20 characters";
	}
	if (typeof court.sidelineText !== "string" || court.sidelineText.length > 24) {
		return "Sideline text must be at most 24 characters";
	}
	return null;
};

export const venueError = (value: unknown): string | null => {
	if (!isRecord(value)) return "Venue must be an object";
	if (value.version !== 1) return "Venue version must be 1";
	const { seats, scoreboard, ribbon, banners } = value;
	// A seat design is both keys: the editor can't show one without the other.
	if ((seats === undefined) !== (value.upperDeck === undefined)) {
		return "Venue seats and upper deck must be set together";
	}
	if (seats !== undefined) {
		if (!isRecord(seats)) return "Venue seats must be {primary, secondary, pattern}";
		for (const field of ["primary", "secondary"]) {
			if (!isHex(seats[field])) return `Venue seats ${field} must be a #rrggbb colour`;
		}
		if (!isOneOf(SEAT_PATTERNS, seats.pattern)) {
			return `Venue seats pattern must be one of ${SEAT_PATTERNS.join(", ")}`;
		}
	}
	if (value.upperDeck !== undefined && typeof value.upperDeck !== "boolean") {
		return "Venue upper deck must be true or false";
	}
	if (scoreboard !== undefined) {
		if (!isRecord(scoreboard)) return "Venue scoreboard must be {text, accent}";
		if (!isTextUpTo(scoreboard.text, SCOREBOARD_TEXT_MAX)) {
			return `Venue scoreboard text must be at most ${SCOREBOARD_TEXT_MAX} characters`;
		}
		if (!isHex(scoreboard.accent)) return "Venue scoreboard accent must be a #rrggbb colour";
	}
	if (ribbon !== undefined) {
		if (!isRecord(ribbon)) return "Venue ribbon must be {text, color}";
		if (!isTextUpTo(ribbon.text, RIBBON_TEXT_MAX)) {
			return `Venue ribbon text must be at most ${RIBBON_TEXT_MAX} characters`;
		}
		if (!isHex(ribbon.color)) return "Venue ribbon colour must be a #rrggbb colour";
	}
	if (banners !== undefined) return bannersError(banners);
	return null;
};

const bannersError = (banners: unknown): string | null => {
	if (!Array.isArray(banners) || banners.length > BANNERS_MAX) {
		return `Venue banners must be a list of at most ${BANNERS_MAX}`;
	}
	for (const [index, banner] of banners.entries()) {
		const label = `Venue banner ${index + 1}`;
		if (!isRecord(banner)) return `${label} must be {kind, title, subtitle, color}`;
		if (!isOneOf(BANNER_KINDS, banner.kind)) return `${label} kind must be one of ${BANNER_KINDS.join(", ")}`;
		if (!isTextUpTo(banner.title, BANNER_TITLE_MAX)) {
			return `${label} title must be at most ${BANNER_TITLE_MAX} characters`;
		}
		if (!isTextUpTo(banner.subtitle, BANNER_SUBTITLE_MAX)) {
			return `${label} subtitle must be at most ${BANNER_SUBTITLE_MAX} characters`;
		}
		if (!isHex(banner.color)) return `${label} colour must be a #rrggbb colour`;
	}
	return null;
};

const isTextUpTo = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;

/**
 * A venue that passed venueError, copied key by key so nothing else a client sends is stored.
 * An absent part gets no key at all: DocumentClient throws on undefined map values.
 */
export const toVenue = (value: Record<string, unknown>): VenueDesign => {
	const seats = value.seats as VenueDesign["seats"];
	const scoreboard = value.scoreboard as VenueDesign["scoreboard"];
	const ribbon = value.ribbon as VenueDesign["ribbon"];
	const banners = value.banners as VenueDesign["banners"];
	return {
		version: 1,
		...(seats && { seats: { primary: seats.primary, secondary: seats.secondary, pattern: seats.pattern } }),
		...(typeof value.upperDeck === "boolean" && { upperDeck: value.upperDeck }),
		...(scoreboard && { scoreboard: { text: scoreboard.text, accent: scoreboard.accent } }),
		...(ribbon && { ribbon: { text: ribbon.text, color: ribbon.color } }),
		...(banners &&
			banners.length > 0 && {
				banners: banners.map(({ kind, title, subtitle, color }) => ({ kind, title, subtitle, color })),
			}),
	};
};

export const validateArenaData = (data: unknown): { valid: boolean; error?: string } => {
	if (!isRecord(data)) {
		return { valid: false, error: "Invalid request body" };
	}

	if (typeof data.name !== "string") {
		return { valid: false, error: "Name is required and must be a string" };
	}
	const trimmedName = data.name.trim();
	if (trimmedName.length === 0 || trimmedName.length > 60) {
		return { valid: false, error: "Name must be between 1 and 60 characters" };
	}

	if (data.location !== undefined && typeof data.location !== "string") {
		return { valid: false, error: "City must be a string" };
	}
	if ((data.location ?? "").trim().length > 60) {
		return { valid: false, error: "City must be at most 60 characters" };
	}

	if (data.capacity != null && !isWholeNumberIn(data.capacity, 1, 200_000)) {
		return { valid: false, error: "Capacity must be a whole number from 1 to 200,000" };
	}

	if (data.openedYear != null && !isWholeNumberIn(data.openedYear, 1850, 2100)) {
		return { valid: false, error: "Opened year must be from 1850 to 2100" };
	}

	if (data.court != null) {
		const error = courtError(data.court);
		if (error) return { valid: false, error };
	}

	if (data.venue != null) {
		const error = venueError(data.venue);
		if (error) return { valid: false, error };
	}

	return { valid: true };
};

/**
 * The stored fields of a payload that passed validateArenaData. Only known
 * keys are copied, so nothing else a client sends lands on the item.
 */
export const toArenaFields = (data: Record<string, unknown>) => {
	const court = data.court as CourtDesign | null | undefined;
	return {
		name: (data.name as string).trim(),
		location: ((data.location as string | undefined) ?? "").trim(),
		capacity: (data.capacity as number | null | undefined) ?? null,
		openedYear: (data.openedYear as number | null | undefined) ?? null,
		court:
			court == null
				? null
				: ({
						version: 1,
						wood: court.wood,
						paint: court.paint,
						apron: court.apron,
						lines: court.lines,
						centerLogo: court.centerLogo,
						baselineText: court.baselineText,
						sidelineText: court.sidelineText,
					} satisfies CourtDesign),
	};
};
