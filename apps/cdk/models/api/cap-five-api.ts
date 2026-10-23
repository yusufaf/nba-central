import type { ApiResponse } from "./custom-entities-api";
import type { CapFiveCandidate, CapFiveOptimal } from "../cap-five";

// "legend" is an all-time or classic-peak rating.
export type CapFiveEra = "current" | "legend";

// Everything the player may see before locking in: no rating, ever.
export interface CapFiveCandidateView {
	id: string;
	name: string;
	positions: string[];
	era: CapFiveEra;
}

export interface CapFivePuzzleView {
	puzzleNumber: number;
	date: string;
	cap: number;
	gameVersion: string;
	candidates: CapFiveCandidateView[];
}

export type GetCapFiveResponse = ApiResponse<CapFivePuzzleView>;

export interface CapFiveSubmitPayload {
	date: string;
	picks: string[];
}

// The reveal: every candidate's rating and the optimal lineup.
export interface CapFiveResult {
	puzzleNumber: number;
	date: string;
	cap: number;
	gameVersion: string;
	picks: string[];
	total: number;
	busted: boolean;
	optimal: CapFiveOptimal;
	candidates: CapFiveCandidate[];
}

export type SubmitCapFiveResponse = ApiResponse<CapFiveResult>;
