// One Cap Five puzzle as publishCapFive freezes it: cap-five/<date>.json in
// the static-data bucket, written once and never overwritten. The ratings are
// the ones player-ratings.json held at publish time, so the weekly refresh
// never changes a published day.
export type CapFiveRatingSource = "current" | "all-time" | "classic-peak";

export interface CapFiveCandidate {
	id: string;
	name: string;
	positions: string[];
	rating: number;
	ratingSource: CapFiveRatingSource;
}

// `lineup` is one lineup reaching `total` (5 ids); `count` is how many do.
export interface CapFiveOptimal {
	total: number;
	lineup: string[];
	count: number;
}

export interface CapFivePuzzle {
	version: 1;
	date: string;
	puzzleNumber: number;
	gameVersion: string;
	ratingsGenerated: string;
	cap: number;
	candidates: CapFiveCandidate[];
	optimal: CapFiveOptimal;
}

// Puzzle #1's date. Never change it once live: puzzle numbers count from it.
// Any past date is safe, because publishCapFive backfills the window.
export const CAP_FIVE_FIRST_DATE = "2026-10-22";
export const CAP_FIVE_POOL_SIZE = 12;
export const CAP_FIVE_LINEUP_SIZE = 5;
// Westbrook is rated 42 upstream; nothing that low belongs in a pool.
export const CAP_FIVE_MIN_RATING = 65;
// Fewer eligible players than this means the ratings file is broken.
export const CAP_FIVE_MIN_ELIGIBLE = 300;
export const CAP_FIVE_PUBLISH_AHEAD_DAYS = 7;
// Each band runs from `min` up to the previous band's min - 1 (99 for the
// first). The counts add up to CAP_FIVE_POOL_SIZE.
export const CAP_FIVE_POOL_BANDS = [
	{ min: 90, count: 2 },
	{ min: 80, count: 4 },
	{ min: 70, count: 4 },
	{ min: 65, count: 2 },
] as const;
export const CAP_FIVE_KEY_PREFIX = "cap-five/";
export const capFiveKey = (date: string) => `${CAP_FIVE_KEY_PREFIX}${date}.json`;
