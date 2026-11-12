import {
	ACCESSORIES,
	APPEARANCE_FRAMES,
	COURT_CENTER_LOGOS,
	COURT_WOODS,
	CourtDesign,
	FACIAL_HAIR_STYLES,
	HAIR_STYLES,
	MAX_ACCESSORIES,
	PersonAppearance,
	POSES,
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

/** Why a stored look is invalid, or null. Every key is checked; unknown ones are ignored here and dropped by toAppearance. */
export const appearanceError = (value: unknown): string | null => {
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
		if (!isRecord(accessory) || !isOneOf(ACCESSORIES, accessory.id)) {
			return `Appearance accessories must be one of ${ACCESSORIES.join(", ")}`;
		}
		if (!isHex(accessory.color)) return "Appearance accessory color must be a #rrggbb colour";
		if (seen.has(accessory.id)) return "Appearance accessories must not repeat";
		seen.add(accessory.id);
	}
	const number = value.jerseyNumber;
	if (number != null && (typeof number !== "string" || !JERSEY_NUMBER.test(number))) {
		return "Appearance jersey number must be 0-99 or 00";
	}
	if (!isOneOf(POSES, value.pose)) return `Appearance pose must be one of ${POSES.join(", ")}`;
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
