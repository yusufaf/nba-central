import { describe, it, expect } from "vitest";
import { SETTINGS_SCHEMA, validateSettingsPatch } from "models/user-settings";
// apps/web keeps its own copy of the allowlist (the two packages share no
// code), so this is the check that they haven't drifted apart.
import { SETTINGS_SCHEMA as WEB_SETTINGS_SCHEMA } from "../../../web/src/constants/settings";

describe("SETTINGS_SCHEMA", () => {
	it("matches the copy apps/web validates and renders against", () => {
		expect(WEB_SETTINGS_SCHEMA).toEqual(SETTINGS_SCHEMA);
	});
});

describe("validateSettingsPatch", () => {
	it("accepts every key with a valid value", () => {
		const patch = {
			"playerStats.seasonFormat": "YYYY+1",
			"playerStats.statMode": "totals",
			"playerStats.showCareerSummary": false,
			"playerStats.highlightCareerHighs": false,
			"scores.conferenceFilter": "CROSS",
			"scores.selectedView": "List",
			"scores.useShortNames": false,
			"scores.hideScores": true,
			"scores.hideFinishedGames": true,
		};
		expect(validateSettingsPatch(patch)).toEqual({ valid: true, patch });
	});

	it("rejects non-objects", () => {
		for (const input of [null, undefined, "x", 1, [], true]) {
			expect(validateSettingsPatch(input).valid).toBe(false);
		}
	});

	it("rejects inherited Object.prototype names as unknown keys", () => {
		expect(validateSettingsPatch(JSON.parse('{"constructor":true}'))).toEqual({
			valid: false,
			error: "Unknown setting: constructor",
		});
	});
});
