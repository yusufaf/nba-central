// The only settings keys the API stores. apps/web/src/constants/settings.ts
// carries an identical copy (test/utilities/user-settings.test.ts fails if
// they drift) — add a key to both, or the server rejects it with a 400.
//
// Keys are flat "<section>.<field>" names inside one `settings` map on the
// user's item, so a new section is just new keys: no schema migration.
export type SettingRule =
	| { type: "boolean" }
	| { type: "enum"; values: readonly string[] };

export const SETTINGS_SCHEMA = {
	"playerStats.seasonFormat": {
		type: "enum",
		values: ["YYYY-YY", "YYYY-YYYY", "YYYY", "YYYY+1"],
	},
	"playerStats.statMode": { type: "enum", values: ["per_game", "totals"] },
	"playerStats.showCareerSummary": { type: "boolean" },
	"playerStats.highlightCareerHighs": { type: "boolean" },
	"scores.conferenceFilter": {
		type: "enum",
		values: ["ALL", "EAST", "WEST", "CROSS"],
	},
	"scores.selectedView": { type: "enum", values: ["Default", "List"] },
	"scores.useShortNames": { type: "boolean" },
	"scores.hideScores": { type: "boolean" },
	"scores.hideFinishedGames": { type: "boolean" },
	"teamBuilder.confirmDestructive": { type: "boolean" },
	// Seconds, as strings: an enum keeps the allowed durations a closed set
	// without a numeric rule type.
	"teamBuilder.undoToastSeconds": {
		type: "enum",
		values: ["5", "8", "15", "30"],
	},
	"teamBuilder.flipNewCards": { type: "boolean" },
	"teamBuilder.drawerSide": { type: "enum", values: ["left", "right"] },
	// "auto" keeps each date and time as the app showed it before these
	// settings existed (some follow the browser locale, some are en-US).
	"display.dateFormat": {
		type: "enum",
		values: ["auto", "YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"],
	},
	"display.timeFormat": { type: "enum", values: ["auto", "12h", "24h"] },
	"display.reducedMotion": {
		type: "enum",
		values: ["system", "reduce", "allow"],
	},
	// Root font size as a percentage of the browser default, as strings for
	// the same reason as undoToastSeconds.
	"display.fontScale": {
		type: "enum",
		values: ["87.5", "100", "112.5", "125", "137.5"],
	},
} as const satisfies Record<string, SettingRule>;

export type SettingKey = keyof typeof SETTINGS_SCHEMA;
export type SettingValue = string | boolean;
export type SettingsMap = Partial<Record<SettingKey, SettingValue>>;

const isSettingKey = (key: string): key is SettingKey =>
	Object.prototype.hasOwnProperty.call(SETTINGS_SCHEMA, key);

export const isValidSetting = (key: string, value: unknown): boolean => {
	if (!isSettingKey(key)) return false;
	const rule: SettingRule = SETTINGS_SCHEMA[key];
	if (rule.type === "boolean") return typeof value === "boolean";
	return typeof value === "string" && rule.values.includes(value);
};

export type SettingsPatchResult =
	| { valid: true; patch: SettingsMap }
	| { valid: false; error: string };

export const validateSettingsPatch = (input: unknown): SettingsPatchResult => {
	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		return { valid: false, error: "settings must be an object" };
	}

	for (const [key, value] of Object.entries(input)) {
		if (!isSettingKey(key)) {
			return { valid: false, error: `Unknown setting: ${key}` };
		}
		if (!isValidSetting(key, value)) {
			return { valid: false, error: `Invalid value for ${key}` };
		}
	}

	return { valid: true, patch: input as SettingsMap };
};

// What's stored can outlive the allowlist (a key removed, an enum value
// retired); clients only ever see what they could also write back.
export const pickValidSettings = (stored: unknown): SettingsMap => {
	if (typeof stored !== "object" || stored === null) return {};
	return Object.fromEntries(
		Object.entries(stored).filter(([key, value]) => isValidSetting(key, value)),
	) as SettingsMap;
};

export const settingsItemKey = (userUUID: string) => ({
	PK: `userUUID#${userUUID}`,
	SK: "metadata#",
});
