import { EventBridgeEvent, Handler } from "aws-lambda";
import {
	S3Client,
	GetObjectCommand,
	PutObjectCommand,
} from "@aws-sdk/client-s3";

const { NBA2K_API_BASE_URL = "", staticDataBucket = "" } = process.env;

const s3Client = new S3Client();

// The public endpoint allows 60 req/min per IP and caps `limit` at 100. ~19
// pages for the whole roster, so this whole run is well under a minute of
// requests even with the pacing.
const PAGE_SIZE = 100;
const REQUEST_DELAY_MS = 1100;

// Ratings are pulled in this order and the first hit wins: an active player's
// current-game rating beats their All-Time entry, which beats the best of
// their Classic-team (season-specific) versions.
const TEAM_TYPES = ["curr", "allt", "class"] as const;
type TeamType = (typeof TEAM_TYPES)[number];

const RATING_SOURCE: Record<TeamType, string> = {
	curr: "current",
	allt: "all-time",
	class: "classic-peak",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface BBRefPlayer {
	id: string;
	first_name: string;
	last_name: string;
	height_feet: number | null;
	height_inches: number | null;
	active: boolean;
}

interface TwoKRatingHistoryEntry {
	gameVersion: string;
	overall: number;
}

interface TwoKPlayer {
	name: string;
	slug: string;
	team: string;
	teamType: TeamType;
	overall: number;
	positions?: string[];
	height?: string;
	gameVersion?: string;
	ratingHistory?: TwoKRatingHistoryEntry[];
}

interface PlayerRating {
	rating: number;
	ratingSource: string;
	slug: string;
	positions?: string[];
	history?: TwoKRatingHistoryEntry[];
}

// Unicode combining diacritical marks, built from escapes so this file stays
// ASCII and can't be mangled in transit.
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

// Punctuation that splits a name differently on each side and must be deleted
// rather than spaced out, so "P.J." / "PJ" and "O'Neal" / "O<curly>Neal"
// collapse identically. Includes the curly quotes 2K uses and BBRef does not.
const INTRA_NAME_PUNCTUATION = new RegExp(
	"['\"\\u2018\\u2019\\u201c\\u201d\\u02bc\\u2032.`\\-]",
	"g",
);

/**
 * Players the two sources file under genuinely different names - nicknames,
 * legal name changes, and a couple of 2K misspellings. Normalization can't
 * bridge these, and they're nearly all franchise legends, so they're worth
 * naming explicitly. Keyed 2K name -> Basketball-Reference name.
 */
const NAME_ALIASES: Record<string, string> = {
	"nate archibald": "tiny archibald",
	"penny hardaway": "anfernee hardaway",
	"ron artest": "metta world peace",
	"micheal ray richardson": "michael ray richardson",
	"darrel griffith": "darrell griffith",
	"ronald holland": "ron holland",
};

/**
 * Collapse a name to something comparable across the two sources. BBRef keeps
 * diacritics (e.g. Jokic with an acute accent) and 2K does not; the two also
 * disagree on generational suffixes and on whether initials carry periods
 * ("PJ Dozier" vs "P.J. Dozier", "A.J. Green" vs "AJ Green").
 *
 * Suffixes are dropped so a name always finds its family; telling the members
 * apart is resolveMatch's job.
 */
const baseName = (name: string): string =>
	(name || "")
		.normalize("NFD")
		.replace(COMBINING_MARKS, "")
		.toLowerCase()
		.replace(INTRA_NAME_PUNCTUATION, "")
		.replace(/[^a-z\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

const stripSuffix = (name: string): string =>
	name
		.replace(/\b(jr|sr|ii|iii|iv)\b/g, " ")
		.replace(/\s+/g, " ")
		.trim();

// Family-level key: "Tim Hardaway" and "Tim Hardaway Jr." share one.
export const normalizeName = (name: string): string => {
	const base = stripSuffix(baseName(name));
	return NAME_ALIASES[base] ?? base;
};

// Individual-level key, suffix intact - used to break family ties.
export const exactName = (name: string): string => {
	const base = baseName(name);
	const aliased = NAME_ALIASES[stripSuffix(base)];
	return aliased ?? base;
};

// 2K reports height as `6'11"`; players.json splits it into feet and inches.
const parse2KHeight = (height: string): [number | null, number | null] => {
	const match = /(\d+)\s*'\s*(\d+)/.exec(height || "");
	if (!match) return [null, null];
	return [parseInt(match[1], 10), parseInt(match[2], 10)];
};

const toTotalInches = (
	feet: number | null,
	inches: number | null,
): number | null =>
	feet === null || inches === null ? null : feet * 12 + inches;

/**
 * Pick the one BBRef player a 2K entry refers to, or null if it can't be
 * decided. A wrong join is worse than a miss - it would put Michael Jordan's
 * 99 on a different player - so anything still ambiguous after the height
 * check is dropped rather than guessed at.
 */
export const resolveMatch = (
	candidates: BBRefPlayer[],
	twoKPlayer: TwoKPlayer,
): BBRefPlayer | null => {
	if (candidates.length === 0) return null;
	if (candidates.length === 1) return candidates[0];

	// Both sources carry the suffix, so it settles father/son pairs outright
	// (Glen Rice vs Glen Rice Jr., Ron Harper vs Ron Harper Jr.) - and it has
	// to run before the height check, which can't separate a 6'8" father from
	// his 6'6" son within tolerance.
	const wanted = exactName(twoKPlayer.name);
	const byExactName = candidates.filter(
		(p) => exactName(`${p.first_name} ${p.last_name}`) === wanted,
	);
	if (byExactName.length === 1) return byExactName[0];

	// Current-game players must be active, which settles the rest of the
	// same-name collisions (Gary Payton, Larry Nance, Jaren Jackson...).
	let pool = byExactName.length > 1 ? byExactName : candidates;
	if (twoKPlayer.teamType === "curr") {
		const active = pool.filter((p) => p.active);
		if (active.length === 1) return active[0];
		if (active.length > 1) pool = active;
	}

	const twoKInches = toTotalInches(...parse2KHeight(twoKPlayer.height || ""));
	if (twoKInches === null) return null;

	const byHeight = pool.filter((p) => {
		const inches = toTotalInches(p.height_feet, p.height_inches);
		return inches !== null && Math.abs(inches - twoKInches) <= 1;
	});

	return byHeight.length === 1 ? byHeight[0] : null;
};

const fetchTeamType = async (teamType: TeamType): Promise<TwoKPlayer[]> => {
	const players: TwoKPlayer[] = [];
	let cursor: string | null = null;

	do {
		const url = new URL(`${NBA2K_API_BASE_URL}/public/players`);
		url.searchParams.set("teamType", teamType);
		url.searchParams.set("limit", String(PAGE_SIZE));
		if (cursor) url.searchParams.set("cursor", cursor);

		const response = await fetch(url, {
			headers: { "User-Agent": "TeamBuilder/1.0" },
		});
		if (!response.ok) {
			throw new Error(
				`nba2kapi ${teamType} returned ${response.status} ${response.statusText}`,
			);
		}

		const body: any = await response.json();
		players.push(...(body?.data || []));
		const pagination = body?.meta?.pagination;
		cursor = pagination?.hasMore ? pagination.nextCursor : null;

		await sleep(REQUEST_DELAY_MS);
	} while (cursor);

	console.log(`Fetched ${players.length} ${teamType} players`);
	return players;
};

const loadBBRefPlayers = async (): Promise<BBRefPlayer[]> => {
	const { Body } = await s3Client.send(
		new GetObjectCommand({
			Bucket: staticDataBucket,
			Key: "players.json",
		}),
	);
	const raw = await Body!.transformToString();
	const { data } = JSON.parse(raw) as { data: BBRefPlayer[] };
	return data || [];
};

export const handler: Handler = async (
	event: EventBridgeEvent<any, any>,
	context,
): Promise<any> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	try {
		const bbrefPlayers = await loadBBRefPlayers();

		const byName = new Map<string, BBRefPlayer[]>();
		for (const player of bbrefPlayers) {
			const key = normalizeName(
				`${player.first_name} ${player.last_name}`,
			);
			if (!key) continue;
			const bucket = byName.get(key);
			if (bucket) bucket.push(player);
			else byName.set(key, [player]);
		}

		const ratings: Record<string, PlayerRating> = {};
		const unmatchedCurrent: string[] = [];
		let gameVersion = "";
		let sourcePlayerCount = 0;

		for (const teamType of TEAM_TYPES) {
			const twoKPlayers = await fetchTeamType(teamType);
			sourcePlayerCount += twoKPlayers.length;

			for (const twoKPlayer of twoKPlayers) {
				if (!gameVersion && twoKPlayer.gameVersion) {
					gameVersion = twoKPlayer.gameVersion;
				}

				const candidates =
					byName.get(normalizeName(twoKPlayer.name)) || [];
				const match = resolveMatch(candidates, twoKPlayer);

				if (!match) {
					// Every active NBA player is in players.json, so an
					// unmatched `curr` entry is a bug worth surfacing rather
					// than a gap in coverage.
					if (teamType === "curr") {
						unmatchedCurrent.push(twoKPlayer.name);
					}
					continue;
				}

				const existing = ratings[match.id];

				// A higher-precedence source already claimed this player.
				if (existing && existing.ratingSource !== RATING_SOURCE.class) {
					continue;
				}

				// Within Classic, a player has one entry per season version -
				// keep their peak.
				if (existing && existing.rating >= twoKPlayer.overall) continue;

				const history = twoKPlayer.ratingHistory?.length
					? twoKPlayer.ratingHistory.map(
							({ gameVersion: version, overall }) => ({
								gameVersion: version,
								overall,
							}),
						)
					: undefined;

				ratings[match.id] = {
					rating: twoKPlayer.overall,
					ratingSource: RATING_SOURCE[teamType],
					slug: twoKPlayer.slug,
					positions: twoKPlayer.positions,
					history,
				};
			}
		}

		const matchedCount = Object.keys(ratings).length;

		await s3Client.send(
			new PutObjectCommand({
				Bucket: staticDataBucket,
				Key: "player-ratings.json",
				Body: JSON.stringify({
					gameVersion,
					generated: new Date().toISOString(),
					sourcePlayerCount,
					matchedCount,
					unmatchedCurrent,
					data: ratings,
				}),
				ContentType: "application/json",
			}),
		);

		console.log(
			`Saved ${matchedCount} ratings (${gameVersion}) to ${staticDataBucket}/player-ratings.json; ${unmatchedCurrent.length} unmatched current players`,
		);
		if (unmatchedCurrent.length) {
			console.warn(
				`Unmatched current players: ${unmatchedCurrent.join(", ")}`,
			);
		}

		return {
			statusCode: 200,
			body: JSON.stringify({
				message: "Player ratings saved",
				gameVersion,
				matchedCount,
				unmatchedCurrent: unmatchedCurrent.length,
			}),
		};
	} catch (err) {
		console.error(err);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Failed to fetch player ratings" }),
		};
	}
};
