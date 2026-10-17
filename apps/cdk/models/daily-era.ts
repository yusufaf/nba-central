// One jersey as the Daily Era puzzle list records it. `mediaId` is the
// identity: the Wix media id stem of the jersey's image URL (`31d308_…`),
// unique across historicalJerseys.json and stable across refresh runs.
// franchise + name + startYear are kept for people reading the list - that
// triple alone collides on today's data.
export interface JerseyIdentity {
	franchise: string;
	name: string;
	startYear: number;
	mediaId: string;
}

// One day's puzzle. The list is a bare array in day order, private to the
// static-data bucket and append-only: entries are never reordered or removed.
// `imageKey` is a random key in the assets bucket, so the image URL carries no
// team name, abbreviation or year.
export interface DailyEraPuzzle {
	puzzleId: string;
	imageKey: string;
	// Season ending years (1999-00 is 2000), ascending. A guess in any of them
	// is a hit.
	answerSeasons: number[];
	runLabel: string;
	franchise: string;
	teamName: string;
	identities: JerseyIdentity[];
	shownIdentity: JerseyIdentity;
}

export const DAILY_ERA_PUZZLES_KEY = "daily-era-puzzles.json";
export const DAILY_ERA_IMAGE_PREFIX = "daily-era/";

// Puzzle #1's date (UTC), 32 days before go-live on 2026-11-06, so every time
// zone has a full 30-day archive on launch day. Never change it once live:
// every date maps to a list position through it.
export const DAILY_ERA_FIRST_DATE = "2026-10-05";
export const DAILY_ERA_MAX_ATTEMPTS = 4;
