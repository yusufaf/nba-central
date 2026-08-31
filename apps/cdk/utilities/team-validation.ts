const isEntityRef = (value: any): boolean => {
	if (value === null) return true;
	if (typeof value !== "object") return false;
	if (typeof value.name !== "string" || value.name.trim().length === 0) return false;
	if (typeof value.isCustom !== "boolean") return false;
	if (value.uuid !== undefined && typeof value.uuid !== "string") return false;
	return true;
};

// API and custom players carry different field sets (see PlayerSnapshot),
// so `fullName` - always set on a player before it reaches the roster - is
// the only field checked here.
const isPlayerSnapshot = (value: any): boolean => {
	if (typeof value !== "object" || value === null) return false;
	return typeof value.fullName === "string" && value.fullName.trim().length > 0;
};

export const validateTeamData = (data: any): { valid: boolean; error?: string } => {
	if (!data.title || typeof data.title !== "string") {
		return { valid: false, error: "Title is required and must be a string" };
	}

	const trimmedTitle = data.title.trim();
	if (trimmedTitle.length === 0 || trimmedTitle.length > 100) {
		return { valid: false, error: "Title must be between 1 and 100 characters" };
	}

	if (data.description !== undefined && typeof data.description !== "string") {
		return { valid: false, error: "Description must be a string" };
	}

	if (data.city !== undefined && typeof data.city !== "string") {
		return { valid: false, error: "City must be a string" };
	}

	if (data.country !== undefined && typeof data.country !== "string") {
		return { valid: false, error: "Country must be a string" };
	}

	if (data.logoUrl !== undefined && typeof data.logoUrl !== "string") {
		return { valid: false, error: "logoUrl must be a string" };
	}

	if (!Array.isArray(data.roster)) {
		return { valid: false, error: "Roster must be an array" };
	}

	for (const entry of data.roster) {
		if (typeof entry !== "object" || entry === null || !Number.isFinite(entry.slot)) {
			return { valid: false, error: "Each roster entry must have a numeric slot" };
		}
		if (!isPlayerSnapshot(entry.player)) {
			return { valid: false, error: "Each roster entry must have a valid player" };
		}
	}

	if (data.coach !== undefined && !isEntityRef(data.coach)) {
		return { valid: false, error: "coach must be null or {name, isCustom, uuid?}" };
	}

	if (data.gm !== undefined && !isEntityRef(data.gm)) {
		return { valid: false, error: "gm must be null or {name, isCustom, uuid?}" };
	}

	if (
		data.arena !== undefined &&
		data.arena !== null &&
		(typeof data.arena !== "object" || typeof data.arena.name !== "string")
	) {
		return { valid: false, error: "arena must be null or {name}" };
	}

	return { valid: true };
};
