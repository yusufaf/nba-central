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
