import type { ApiResponse } from "./custom-entities-api";
import type { JerseyIdentity } from "../daily-era";

// Everything the player may see before guessing: no answer field, ever.
export interface DailyEraPuzzleView {
	puzzleNumber: number;
	puzzleId: string;
	imageUrl: string;
}

export type GetDailyEraResponse = ApiResponse<DailyEraPuzzleView>;

export interface DailyEraGuessPayload {
	puzzleId: string;
	season: number;
	attempt: number;
}

export type DailyEraDirection = "earlier" | "later";
export type DailyEraBand = "close" | "near" | "far";

export interface DailyEraReveal {
	runLabel: string;
	teamName: string;
	franchise: string;
	shownIdentity: JerseyIdentity;
}

export type DailyEraScore =
	| { hit: true; direction: null; band: null }
	| { hit: false; direction: DailyEraDirection; band: DailyEraBand };

// `answer` only on a hit or the last attempt.
export type DailyEraGuessResult = DailyEraScore & { answer?: DailyEraReveal };

export type GuessDailyEraResponse = ApiResponse<DailyEraGuessResult>;
