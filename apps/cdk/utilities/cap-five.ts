/**
 * Cap Five puzzle building, validation and scoring, shared by publishCapFive,
 * getCapFive and submitCapFive. Pure: no AWS, no network.
 * Spec: docs/superpowers/specs/2026-10-22-cap-five-design.md
 */
import {
	CAP_FIVE_FIRST_DATE,
	CAP_FIVE_LINEUP_SIZE,
	CAP_FIVE_MIN_RATING,
	CAP_FIVE_POOL_BANDS,
	CAP_FIVE_POOL_SIZE,
	CAP_FIVE_PUBLISH_AHEAD_DAYS,
	type CapFiveCandidate,
	type CapFiveOptimal,
	type CapFivePuzzle,
	type CapFiveRatingSource,
} from "../models/cap-five";
import type { CapFivePuzzleView, CapFiveResult } from "../models/api/cap-five-api";
import { formatIsoDate, parseIsoDate, playableDays } from "./daily-era";
import { mulberry32, seedFromString } from "./seeded-random";
import { isOneOf, isRecord } from "./type-guards";

const RATING_SOURCES: readonly CapFiveRatingSource[] = ["current", "all-time", "classic-peak"];
const MAX_RATING = 99;

type Eligible = CapFiveCandidate & { sortKey: string };

const fold = (s: string) =>
	s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

// Plain code-unit order, so the result is the same whatever ICU Node ships.
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Every player a pool may draw from, sorted by id so the output never depends
 * on the input's order. A display name shared by two players drops both:
 * the player couldn't tell them apart.
 */
export const eligiblePlayers = (
	players: { id: string; first_name: string; last_name: string }[],
	ratings: Record<string, { rating: unknown; ratingSource: unknown; positions?: unknown }>,
): Eligible[] => {
	const rated: Eligible[] = [];
	for (const player of players) {
		const entry = ratings[player.id];
		if (!entry) continue;
		const { rating, ratingSource, positions } = entry;
		if (!Number.isInteger(rating) || (rating as number) < CAP_FIVE_MIN_RATING || (rating as number) > MAX_RATING) continue;
		if (!isOneOf(RATING_SOURCES, ratingSource)) continue;
		if (!Array.isArray(positions) || positions.length === 0 || !positions.every((p) => typeof p === "string")) continue;
		const first = (player.first_name ?? "").trim();
		const last = (player.last_name ?? "").trim();
		const name = `${first} ${last}`.trim();
		if (!name) continue;
		rated.push({
			id: player.id,
			name,
			positions: [...positions],
			rating: rating as number,
			ratingSource,
			sortKey: fold(`${last} ${first}`),
		});
	}

	const seen = new Map<string, number>();
	for (const p of rated) seen.set(fold(p.name), (seen.get(fold(p.name)) ?? 0) + 1);
	return rated.filter((p) => seen.get(fold(p.name)) === 1).sort((a, b) => compare(a.id, b.id));
};

/** Twelve players, stratified across the rating bands, in last-name order. */
export const selectPool = (eligible: Eligible[], random: () => number): CapFiveCandidate[] => {
	const picked: Eligible[] = [];
	let max = MAX_RATING;
	for (const { min, count } of CAP_FIVE_POOL_BANDS) {
		// A fresh copy: the publisher reuses one `eligible` for every date.
		const band = eligible
			.filter((p) => p.rating >= min && p.rating <= max)
			.sort((a, b) => compare(a.id, b.id));
		if (band.length < count) {
			throw new Error(`Cap Five: only ${band.length} players rated ${min}-${max}, need ${count}`);
		}
		for (let i = 0; i < count; i++) {
			const j = i + Math.floor(random() * (band.length - i));
			[band[i], band[j]] = [band[j], band[i]];
		}
		picked.push(...band.slice(0, count));
		max = min - 1;
	}
	return picked
		.sort((a, b) => compare(a.sortKey, b.sortKey) || compare(a.id, b.id))
		.map(({ id, name, positions, rating, ratingSource }) => ({ id, name, positions, rating, ratingSource }));
};

// Calls `visit` with the indices of every five-player lineup, in
// lexicographic order.
const forEachLineup = (size: number, visit: (indices: number[]) => void) => {
	for (let a = 0; a < size; a++)
		for (let b = a + 1; b < size; b++)
			for (let c = b + 1; c < size; c++)
				for (let d = c + 1; d < size; d++)
					for (let e = d + 1; e < size; e++) visit([a, b, c, d, e]);
};

/** The total of every five-player lineup. */
export const lineupSums = (ratings: number[]): number[] => {
	const sums: number[] = [];
	forEachLineup(ratings.length, (ix) => sums.push(ix.reduce((sum, i) => sum + ratings[i], 0)));
	return sums;
};

/**
 * A cap between the 35th and 80th percentile of the pool's real lineup
 * totals, so it is always reachable exactly. Never the top five's total, or
 * the answer would be "the five best".
 */
export const chooseCap = (pool: CapFiveCandidate[], random: () => number): number => {
	const sums = lineupSums(pool.map((p) => p.rating)).sort((a, b) => a - b);
	const top = sums[sums.length - 1];
	const cap = sums[Math.floor((0.35 + 0.45 * random()) * (sums.length - 1))];
	if (cap < top) return cap;
	const below = sums.filter((s) => s < top);
	if (below.length === 0) throw new Error("Cap Five: every lineup has the same total");
	return below[below.length - 1];
};

/** The best total at or under the cap, the first lineup reaching it, and how many do. */
export const solveOptimal = (pool: CapFiveCandidate[], cap: number): CapFiveOptimal => {
	let best = -1;
	let lineup: number[] = [];
	let count = 0;
	forEachLineup(pool.length, (ix) => {
		const total = ix.reduce((sum, i) => sum + pool[i].rating, 0);
		if (total > cap) return;
		if (total > best) {
			best = total;
			lineup = ix;
			count = 1;
		} else if (total === best) {
			count++;
		}
	});
	if (best < 0) throw new Error(`Cap Five: no lineup fits under ${cap}`);
	return { total: best, lineup: lineup.map((i) => pool[i].id), count };
};

export const capFivePuzzleNumber = (date: string, firstDate = CAP_FIVE_FIRST_DATE) =>
	parseIsoDate(date)! - parseIsoDate(firstDate)! + 1;

/** One date's puzzle. The same date and players always give the same puzzle. */
export const buildCapFivePuzzle = (
	date: string,
	eligible: Eligible[],
	meta: { gameVersion: string; ratingsGenerated: string },
): CapFivePuzzle => {
	const random = mulberry32(seedFromString(`cap-five:${date}`));
	const candidates = selectPool(eligible, random);
	const cap = chooseCap(candidates, random);
	return {
		version: 1,
		date,
		puzzleNumber: capFivePuzzleNumber(date),
		gameVersion: meta.gameVersion,
		ratingsGenerated: meta.ratingsGenerated,
		cap,
		candidates,
		optimal: solveOptimal(candidates, cap),
	};
};

const fail = (message: string): never => {
	throw new Error(`Invalid Cap Five puzzle: ${message}`);
};

const isRating = (value: unknown): value is number =>
	Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_RATING;

/** Checks a stored puzzle field by field; throws on anything malformed. */
export const parseCapFivePuzzle = (json: unknown): CapFivePuzzle => {
	if (!isRecord(json)) return fail("not an object");
	const { version, date, puzzleNumber, gameVersion, ratingsGenerated, cap, candidates, optimal } = json;
	if (version !== 1) fail(`version ${String(version)}`);
	if (typeof date !== "string" || parseIsoDate(date) === null) fail("bad date");
	if (!Number.isInteger(puzzleNumber)) fail("bad puzzleNumber");
	if (typeof gameVersion !== "string" || typeof ratingsGenerated !== "string") fail("bad ratings metadata");
	if (!Number.isInteger(cap)) fail("bad cap");
	if (!Array.isArray(candidates) || candidates.length !== CAP_FIVE_POOL_SIZE) fail("wrong candidate count");

	const ratingById = new Map<string, number>();
	for (const c of candidates as unknown[]) {
		if (!isRecord(c)) return fail("candidate is not an object");
		if (typeof c.id !== "string" || ratingById.has(c.id)) fail("missing or duplicate candidate id");
		if (typeof c.name !== "string" || !c.name) fail(`candidate ${String(c.id)} has no name`);
		if (!Array.isArray(c.positions) || !c.positions.every((p) => typeof p === "string")) {
			fail(`candidate ${String(c.id)} has bad positions`);
		}
		if (!isRating(c.rating)) fail(`candidate ${String(c.id)} has a bad rating`);
		if (!isOneOf(RATING_SOURCES, c.ratingSource)) fail(`candidate ${String(c.id)} has a bad rating source`);
		ratingById.set(c.id as string, c.rating as number);
	}

	if (!isRecord(optimal)) return fail("no optimal");
	const { total, lineup, count } = optimal;
	if (!Number.isInteger(total) || (total as number) > (cap as number)) fail("optimal total over the cap");
	if (
		!Array.isArray(lineup) ||
		lineup.length !== CAP_FIVE_LINEUP_SIZE ||
		new Set(lineup).size !== CAP_FIVE_LINEUP_SIZE ||
		!lineup.every((id) => ratingById.has(id))
	) {
		fail("optimal lineup is not five pool players");
	}
	const sum = (lineup as string[]).reduce((s, id) => s + ratingById.get(id)!, 0);
	if (sum !== total) fail("optimal lineup doesn't add up to its total");
	if (!Number.isInteger(count) || (count as number) < 1) fail("bad optimal count");

	return json as unknown as CapFivePuzzle;
};

/** What the player sees before locking in. Built field by field: never a rating. */
export const toPuzzleView = (puzzle: CapFivePuzzle): CapFivePuzzleView => ({
	puzzleNumber: puzzle.puzzleNumber,
	date: puzzle.date,
	cap: puzzle.cap,
	gameVersion: puzzle.gameVersion,
	candidates: puzzle.candidates.map((c) => ({
		id: c.id,
		name: c.name,
		positions: [...c.positions],
		era: c.ratingSource === "current" ? "current" : "legend",
	})),
});

/** The reveal for five distinct pool players, or null for anything else. */
export const scoreLineup = (puzzle: CapFivePuzzle, picks: unknown): CapFiveResult | null => {
	if (!Array.isArray(picks) || picks.length !== CAP_FIVE_LINEUP_SIZE) return null;
	if (!picks.every((id) => typeof id === "string") || new Set(picks).size !== picks.length) return null;
	const byId = new Map(puzzle.candidates.map((c) => [c.id, c]));
	if (!picks.every((id) => byId.has(id))) return null;
	const total = (picks as string[]).reduce((sum, id) => sum + byId.get(id)!.rating, 0);
	return {
		puzzleNumber: puzzle.puzzleNumber,
		date: puzzle.date,
		cap: puzzle.cap,
		gameVersion: puzzle.gameVersion,
		picks: [...(picks as string[])],
		total,
		busted: total > puzzle.cap,
		optimal: puzzle.optimal,
		candidates: puzzle.candidates,
	};
};

/**
 * The dates publishCapFive makes sure exist: every playable day from puzzle
 * #1 on, plus a week past the newest, so a failed run has days to be noticed.
 */
export const publishDates = (nowMs: number, firstDate = CAP_FIVE_FIRST_DATE): string[] => {
	const { first, last } = playableDays(nowMs);
	const start = Math.max(parseIsoDate(firstDate)!, first);
	const end = last + CAP_FIVE_PUBLISH_AHEAD_DAYS;
	const dates: string[] = [];
	for (let day = start; day <= end; day++) dates.push(formatIsoDate(day));
	return dates;
};
