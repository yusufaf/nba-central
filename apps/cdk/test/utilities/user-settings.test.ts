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
			"teamBuilder.confirmDestructive": false,
			"teamBuilder.undoToastSeconds": "30",
			"teamBuilder.flipNewCards": true,
			"teamBuilder.drawerSide": "left",
			"display.dateFormat": "DD/MM/YYYY",
			"display.timeFormat": "24h",
			"display.reducedMotion": "reduce",
			"display.fontScale": "137.5",
			"profile.avatar": "generated-3",
		};
		expect(validateSettingsPatch(patch)).toEqual({ valid: true, patch });
	});

	it("rejects team builder values outside their rules", () => {
		for (const patch of [
			{ "teamBuilder.confirmDestructive": "false" },
			{ "teamBuilder.undoToastSeconds": 8 },
			{ "teamBuilder.undoToastSeconds": "0" },
			{ "teamBuilder.undoToastSeconds": "9999" },
			{ "teamBuilder.flipNewCards": 1 },
			{ "teamBuilder.drawerSide": "top" },
		]) {
			const [key] = Object.keys(patch);
			expect(validateSettingsPatch(patch)).toEqual({
				valid: false,
				error: `Invalid value for ${key}`,
			});
		}
	});

	it("rejects an unknown team builder key", () => {
		expect(validateSettingsPatch({ "teamBuilder.cardsFlipped": true })).toEqual({
			valid: false,
			error: "Unknown setting: teamBuilder.cardsFlipped",
		});
	});

	it("accepts every display value, Automatic and the defaults included", () => {
		for (const [key, values] of [
			["display.dateFormat", ["auto", "YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"]],
			["display.timeFormat", ["auto", "12h", "24h"]],
			["display.reducedMotion", ["system", "reduce", "allow"]],
			["display.fontScale", ["87.5", "100", "112.5", "125", "137.5"]],
		] as const) {
			for (const value of values) {
				expect(validateSettingsPatch({ [key]: value }).valid).toBe(true);
			}
		}
	});

	it("rejects display values outside their rules", () => {
		for (const patch of [
			{ "display.dateFormat": "DD.MM.YYYY" },
			{ "display.dateFormat": "" },
			{ "display.timeFormat": "12" },
			{ "display.timeFormat": true },
			{ "display.reducedMotion": true },
			{ "display.reducedMotion": "on" },
			{ "display.fontScale": 125 },
			{ "display.fontScale": "150" },
			{ "display.fontScale": "1.25" },
		]) {
			const [key] = Object.keys(patch);
			expect(validateSettingsPatch(patch)).toEqual({
				valid: false,
				error: `Invalid value for ${key}`,
			});
		}
	});

	it("rejects an unknown display key", () => {
		expect(validateSettingsPatch({ "display.theme": "light" })).toEqual({
			valid: false,
			error: "Unknown setting: display.theme",
		});
	});

	it("accepts every avatar choice", () => {
		for (const value of [
			"none",
			"generated-0",
			"generated-1",
			"generated-2",
			"generated-3",
			"generated-4",
			"generated-5",
			"generated-6",
			"generated-7",
			"upload",
		]) {
			expect(validateSettingsPatch({ "profile.avatar": value }).valid).toBe(true);
		}
	});

	// The choice is an enum, never a URL: the uploaded image's URL is written
	// by uploadAvatar onto the user's item, so a client can't point its
	// avatar at an arbitrary host through the settings map.
	it("rejects avatar values outside the enum, URLs included", () => {
		for (const value of [
			"generated-8",
			"generated--1",
			"generated",
			"",
			"https://example.com/me.png",
			"data:image/svg+xml,<svg/>",
			true,
			3,
		]) {
			expect(validateSettingsPatch({ "profile.avatar": value })).toEqual({
				valid: false,
				error: "Invalid value for profile.avatar",
			});
		}
	});

	it("rejects an unknown profile key", () => {
		expect(validateSettingsPatch({ "profile.avatarUrl": "x" })).toEqual({
			valid: false,
			error: "Unknown setting: profile.avatarUrl",
		});
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
