// Mirrored from apps/cdk/models/daily-era.ts and apps/cdk/utilities/daily-era.ts.
// apps/cdk's test/utilities/daily-era.test.ts fails if the copies drift.
// Keep this file free of imports: that test loads it outside Vite, and so
// does vite.config.ts, through build/dailyEraHtml.ts.

/** Puzzle #1's date. */
export const DAILY_ERA_FIRST_DATE = '2026-10-05';
export const DAILY_ERA_MAX_ATTEMPTS = 4;
/** How many days before today the API still serves. */
export const DAILY_ERA_ARCHIVE_DAYS = 30;
