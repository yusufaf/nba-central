/**
 * The NBA season rolls over on Oct 1: from then until next Sep 30 the
 * "current" season is the one starting this October. Keep in step with
 * apps/cdk/utilities/season.ts (a cdk test checks they agree).
 */
const SEASON_ROLLOVER_MONTH = 9; // October, 0-based like Date#getMonth

export const currentSeasonStartYear = (now: Date = new Date()): number =>
    now.getMonth() >= SEASON_ROLLOVER_MONTH ? now.getFullYear() : now.getFullYear() - 1;

/** coaches.json's `to` (BBRef season_max) uses this end-year convention: 2026-27 is 2027. */
export const currentSeasonEndYear = (now: Date = new Date()): number =>
    currentSeasonStartYear(now) + 1;
