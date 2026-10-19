/**
 * Daily Era day arithmetic, scoring and list validation, shared by the two
 * Daily Era Lambdas and refresh-daily-era. Nothing here imports the scraping
 * libraries, so a Lambda bundle stays small.
 */
import {
	DAILY_ERA_FIRST_DATE,
	type DailyEraPuzzle,
	type JerseyIdentity,
} from "../models/daily-era";
import type { DailyEraReveal, DailyEraScore } from "../models/api/daily-era-api";
import { currentSeasonEndYear } from "./season";

export const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
export const ARCHIVE_DAYS = 30;
const MAX_AGE_SECONDS = 3600;

/** A `YYYY-MM-DD` calendar date as a UTC day number, or null if it isn't one. */
export const parseIsoDate = (date: string): number | null => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
	const ms = Date.parse(`${date}T00:00:00Z`);
	if (Number.isNaN(ms) || formatIsoDate(ms / DAY_MS) !== date) return null;
	return ms / DAY_MS;
};

export const formatIsoDate = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

/**
 * Days some player can be on: today in every time zone (UTC-12 to UTC+14),
 * plus the 30 days before the earliest of them.
 */
export const playableDays = (nowMs: number) => ({
	first: Math.floor((nowMs - 12 * HOUR_MS) / DAY_MS) - ARCHIVE_DAYS,
	last: Math.floor((nowMs + 14 * HOUR_MS) / DAY_MS),
});

export const isPlayableDay = (day: number, nowMs: number) => {
	const { first, last } = playableDays(nowMs);
	return day >= first && day <= last;
};

/**
 * The season (end year) of the newest playable day, so a guess of the
 * picker's latest season is never refused in any time zone.
 */
export const lastPlayableSeason = (nowMs: number) => {
	// currentSeasonEndYear reads local time, so hand it local midnight of that
	// calendar date rather than a UTC instant that may fall on another day.
	const [year, month, date] = formatIsoDate(playableDays(nowMs).last).split("-").map(Number);
	return currentSeasonEndYear(new Date(year, month - 1, date));
};

// `first <= day` holds while now < (day + 31) days + 12h.
const secondsLeftPlayable = (day: number, nowMs: number) =>
	Math.floor(((day + ARCHIVE_DAYS + 1) * DAY_MS + 12 * HOUR_MS - nowMs) / 1000);

/** A cached puzzle must expire before its day stops being playable. */
export const puzzleMaxAge = (day: number, nowMs: number) =>
	Math.max(0, Math.min(MAX_AGE_SECONDS, secondsLeftPlayable(day, nowMs)));

export type PuzzleLookup =
	| { ok: true; puzzle: DailyEraPuzzle; puzzleNumber: number; day: number }
	| { ok: false; reason: "invalid-date" | "not-playable" };

export const puzzleForDate = (
	list: DailyEraPuzzle[],
	date: string,
	nowMs: number,
	firstDate = DAILY_ERA_FIRST_DATE,
): PuzzleLookup => {
	const day = parseIsoDate(date);
	if (day === null) return { ok: false, reason: "invalid-date" };
	if (!isPlayableDay(day, nowMs)) return { ok: false, reason: "not-playable" };
	const index = day - parseIsoDate(firstDate)!;
	if (index < 0 || index >= list.length) return { ok: false, reason: "not-playable" };
	return { ok: true, puzzle: list[index], puzzleNumber: index + 1, day };
};

/** The puzzle with this id and the day it is shown on, or null. */
export const dayOfPuzzle = (
	list: DailyEraPuzzle[],
	puzzleId: string,
	firstDate = DAILY_ERA_FIRST_DATE,
): { puzzle: DailyEraPuzzle; day: number } | null => {
	const index = list.findIndex((p) => p.puzzleId === puzzleId);
	if (index === -1) return null;
	return { puzzle: list[index], day: parseIsoDate(firstDate)! + index };
};

/**
 * A hit if `season` is any answer season. Otherwise direction and band point
 * from the guess to the nearest answer; a tie goes to the earlier answer.
 */
export const scoreGuess = (answerSeasons: number[], season: number): DailyEraScore => {
	if (answerSeasons.includes(season)) return { hit: true, direction: null, band: null };
	let nearest = answerSeasons[0];
	for (const answer of answerSeasons) {
		const closer = Math.abs(answer - season) - Math.abs(nearest - season);
		if (closer < 0 || (closer === 0 && answer < nearest)) nearest = answer;
	}
	const distance = Math.abs(nearest - season);
	return {
		hit: false,
		direction: nearest > season ? "later" : "earlier",
		band: distance <= 3 ? "close" : distance <= 10 ? "near" : "far",
	};
};

export const revealFor = (puzzle: DailyEraPuzzle): DailyEraReveal => ({
	runLabel: puzzle.runLabel,
	teamName: puzzle.teamName,
	franchise: puzzle.franchise,
	shownIdentity: puzzle.shownIdentity,
});

const fail = (message: string): never => {
	throw new Error(`Invalid daily era puzzle list: ${message}`);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const checkIdentity = (value: unknown, where: string): JerseyIdentity => {
	if (!isRecord(value)) return fail(`${where} is not an object`);
	for (const field of ["franchise", "name", "mediaId"]) {
		if (typeof value[field] !== "string") fail(`${where}.${field} is not a string`);
	}
	if (!Number.isInteger(value.startYear)) fail(`${where}.startYear is not an integer`);
	return value as unknown as JerseyIdentity;
};

/** Validates the published list read back from S3; throws on anything malformed. */
export const parsePuzzleList = (json: unknown): DailyEraPuzzle[] => {
	if (!Array.isArray(json)) return fail("not an array");
	const ids = new Set<string>();
	return json.map((entry, i) => {
		const where = `entry ${i}`;
		if (!isRecord(entry)) return fail(`${where} is not an object`);
		for (const field of ["puzzleId", "imageKey", "runLabel", "franchise", "teamName"]) {
			if (typeof entry[field] !== "string") fail(`${where}.${field} is not a string`);
		}
		// scoreGuess needs at least one answer; ascending keeps the list readable.
		const seasons = entry.answerSeasons;
		if (
			!Array.isArray(seasons) ||
			seasons.length === 0 ||
			!seasons.every((year, j) => Number.isInteger(year) && (j === 0 || year > seasons[j - 1]))
		) {
			fail(`${where}.answerSeasons is not a non-empty, ascending list of years`);
		}
		// An id maps to exactly one day; a guess resolves to the first match.
		if (ids.has(entry.puzzleId as string)) fail(`${where} reuses puzzleId ${entry.puzzleId}`);
		ids.add(entry.puzzleId as string);
		if (!Array.isArray(entry.identities)) fail(`${where}.identities is not an array`);
		(entry.identities as unknown[]).forEach((identity, j) => checkIdentity(identity, `${where}.identities[${j}]`));
		checkIdentity(entry.shownIdentity, `${where}.shownIdentity`);
		return entry as unknown as DailyEraPuzzle;
	});
};
