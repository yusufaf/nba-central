// The NBA season rolls over on Oct 1. Keep in step with apps/web/src/utils/season.ts
// (test/utilities/season.test.ts checks they agree).
const SEASON_ROLLOVER_MONTH = 9; // October, 0-based like Date#getMonth

export const currentSeasonStartYear = (now: Date = new Date()): number =>
	now.getMonth() >= SEASON_ROLLOVER_MONTH ? now.getFullYear() : now.getFullYear() - 1;

/** BBRef's year_max / season_max and coaches.json's `to` use this end-year convention. */
export const currentSeasonEndYear = (now: Date = new Date()): number =>
	currentSeasonStartYear(now) + 1;
