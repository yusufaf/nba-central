import { COURT_CENTER_LOGOS, COURT_WOODS, CourtDesign } from "../models/custom-entities";

export const validateGMData = (data: any): { valid: boolean; error?: string } => {
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
		for (const team of data.teams) {
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

export const validateCoachData = (data: any): { valid: boolean; error?: string } => {
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

export const validatePlayerData = (data: any): { valid: boolean; error?: string } => {
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

	return { valid: true };
};

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

const isWholeNumberIn = (value: unknown, min: number, max: number) =>
	Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

const courtError = (court: any): string | null => {
	if (typeof court !== "object" || court === null || Array.isArray(court)) {
		return "Court must be an object or null";
	}
	if (court.version !== 1) return "Court version must be 1";
	if (!COURT_WOODS.includes(court.wood)) {
		return `Court wood must be one of ${COURT_WOODS.join(", ")}`;
	}
	for (const field of ["paint", "apron"]) {
		if (court[field] !== null && !HEX_COLOUR.test(court[field])) {
			return `Court ${field} must be a #rrggbb colour or null`;
		}
	}
	if (!HEX_COLOUR.test(court.lines)) return "Court lines must be a #rrggbb colour";
	if (!COURT_CENTER_LOGOS.includes(court.centerLogo)) {
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

export const validateArenaData = (data: any): { valid: boolean; error?: string } => {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
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
export const toArenaFields = (data: any) => ({
	name: (data.name as string).trim(),
	location: ((data.location as string | undefined) ?? "").trim(),
	capacity: (data.capacity as number | null | undefined) ?? null,
	openedYear: (data.openedYear as number | null | undefined) ?? null,
	court:
		data.court == null
			? null
			: ({
					version: 1,
					wood: data.court.wood,
					paint: data.court.paint,
					apron: data.court.apron,
					lines: data.court.lines,
					centerLogo: data.court.centerLogo,
					baselineText: data.court.baselineText,
					sidelineText: data.court.sidelineText,
				} satisfies CourtDesign),
});
