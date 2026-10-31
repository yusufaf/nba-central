import { Handler } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { HEADSHOTS_KEY, MAX_ROSTERS_AGE_MS } from "utilities/live-data";
import { NO_TEAM, teamFor, type PlayerTeam } from "utilities/nba-teams";
import { isRecord } from "utilities/type-guards";

const { staticDataBucket = "", assetsBucket = "" } = process.env;

const s3Client = new S3Client();

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
// A Team Builder roster is 15; a real team-season adds up to 3 alternates.
export const MAX_IDS = 20;

/** `ids=a,b,c` -> ["a", "b", "c"], deduped, in order, at most MAX_IDS. */
export const parseIds = (value: unknown): string[] | null => {
	if (typeof value !== "string" || !value.trim()) return null;
	const ids = [...new Set(value.split(",").map((id) => id.trim()).filter(Boolean))];
	return ids.length ? ids.slice(0, MAX_IDS) : null;
};

// Unicode combining marks, as escapes so this file stays ASCII.
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

// Names in players.json keep their diacritics ("Nikola Jokic" with an acute c,
// "Luka Doncic" with a caron), but nobody types those into a search box. Fold
// both sides to plain ASCII before comparing.
const foldName = (value: string): string =>
	(value || "")
		.normalize("NFD")
		.replace(COMBINING_MARKS, "")
		.toLowerCase();

interface NormalizedPlayer {
	id: string;
	first_name: string;
	last_name: string;
	position: string;
	height_feet: number | null;
	height_inches: number | null;
	weight_pounds: number | null;
	active: boolean;
}

interface PlayerRating {
	rating: number;
	ratingSource: string;
	slug: string;
	positions?: string[];
}

interface RatingsFile {
	gameVersion?: string;
	data: Record<string, PlayerRating>;
}

type MergedPlayer = NormalizedPlayer & {
	team: PlayerTeam;
	rating?: number;
	ratingSource?: string;
	positions?: string[];
};

// Basketball-Reference files players under coarse positions ("G", "F", "F-C"),
// which is why filtering the pool by PG/SG/SF/PF/C never matched anything.
// 2K's `positions` are already specific, so they win when we have them; this
// is the fallback for the ~80% of the pool 2K doesn't rate.
const BBREF_POSITION_EXPANSION: Record<string, string[]> = {
	G: ["PG", "SG"],
	F: ["SF", "PF"],
	C: ["C"],
};

const expandBBRefPosition = (position: string): string[] => {
	const parts = (position || "").toUpperCase().split("-");
	const expanded = new Set<string>();
	for (const part of parts) {
		for (const p of BBREF_POSITION_EXPANSION[part] || []) expanded.add(p);
	}
	return [...expanded];
};

const playsPosition = (player: MergedPlayer, position: string): boolean => {
	const positions = player.positions?.length
		? player.positions
		: expandBBRefPosition(player.position);
	return positions.includes(position);
};

// Both files are rewritten weekly by their scheduled Lambdas, and the rosters
// daily, so a warm container can serve searches without re-reading ~1 MB from
// S3 every time.
export const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();

const readJson = async <T>(bucket: string, key: string): Promise<T | null> => {
	const cacheKey = `${bucket}/${key}`;
	const cached = cache.get(cacheKey);
	if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
		return cached.value as T;
	}

	try {
		const { Body } = await s3Client.send(
			new GetObjectCommand({ Bucket: bucket, Key: key }),
		);
		const value = JSON.parse(await Body!.transformToString()) as T;
		cache.set(cacheKey, { at: Date.now(), value });
		return value;
	} catch (err) {
		// Ratings and rosters are optional overlays - a missing or unreadable
		// file means no ratings or teams, not a failed player search.
		console.error(`Failed to read ${key}`, err);
		return null;
	}
};

// headshots.json's `players` is keyed by BBRef id, each with the ESPN code of
// the roster setSeasonContextData last found them on. A player on no roster
// has no entry.
export const currentTeams = (headshots: unknown, now: number): Map<string, PlayerTeam> => {
	const teams = new Map<string, PlayerTeam>();
	if (!isRecord(headshots) || !isRecord(headshots.players)) return teams;

	for (const [id, entry] of Object.entries(headshots.players)) {
		if (isRecord(entry) && typeof entry.team === "string" && entry.team) {
			teams.set(id, teamFor(entry.team));
		}
	}

	const { rostersAt } = headshots;
	if (typeof rostersAt !== "string" || !(now - Date.parse(rostersAt) < MAX_ROSTERS_AGE_MS)) {
		// Stale teams beat wiping every player's team.
		console.warn(
			`headshots.json rosters are from ${rostersAt ?? "never"}; serving ${teams.size} teams anyway`,
		);
	}
	return teams;
};

// readJson hands back the same object until its cache entry expires, so the
// map (and any staleness warning) is built once per read, not per request.
let lastTeams: { source: unknown; teams: Map<string, PlayerTeam> } | undefined;

const teamsFrom = (headshots: unknown): Map<string, PlayerTeam> => {
	if (!lastTeams || lastTeams.source !== headshots) {
		lastTeams = { source: headshots, teams: currentTeams(headshots, Date.now()) };
	}
	return lastTeams.teams;
};

export const handler: Handler = async (event, context): Promise<any> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	try {
		const params = event?.queryStringParameters || {};
		const search = foldName((params.search || "").trim());
		const position = (params.position || "").trim().toUpperCase();
		const sort = (params.sort || "").trim().toLowerCase();
		const direction = params.direction === "desc" ? "desc" : "asc";
		const minRating = parseInt(params.minRating, 10);
		const limit = Math.min(
			Math.max(parseInt(params.limit, 10) || DEFAULT_LIMIT, 1),
			MAX_LIMIT,
		);
		const cursor = Math.max(parseInt(params.cursor, 10) || 0, 0);
		const ids = parseIds(params.ids);

		const [playersFile, ratingsFile, headshotsFile] = await Promise.all([
			readJson<{ data: NormalizedPlayer[] }>(staticDataBucket, "players.json"),
			readJson<RatingsFile>(staticDataBucket, "player-ratings.json"),
			assetsBucket ? readJson<unknown>(assetsBucket, HEADSHOTS_KEY) : Promise.resolve(null),
		]);

		if (!playersFile) {
			return {
				statusCode: 500,
				body: JSON.stringify({ error: "Failed to fetch players" }),
			};
		}

		const ratings = ratingsFile?.data || {};
		const teams = teamsFrom(headshotsFile);

		let players: MergedPlayer[] = (playersFile.data || []).map((row) => {
			const player = { ...row, team: teams.get(row.id) ?? NO_TEAM };
			const rating = ratings[player.id];
			if (!rating) return player;
			return {
				...player,
				rating: rating.rating,
				ratingSource: rating.ratingSource,
				positions: rating.positions,
			};
		});

		// A lookup by id answers those players, in the order asked, and ignores
		// every other filter. Unknown ids are left out.
		if (ids) {
			const byId = new Map(players.map((p) => [String(p.id), p]));
			const data = ids.flatMap((id) => byId.get(id) ?? []);
			return {
				statusCode: 200,
				body: JSON.stringify({
					data,
					nextCursor: null,
					total: data.length,
					gameVersion: ratingsFile?.gameVersion,
				}),
			};
		}

		if (search) {
			players = players.filter((p) =>
				foldName(`${p.first_name} ${p.last_name}`).includes(search),
			);
		}

		if (position && position !== "ALL") {
			players = players.filter((p) => playsPosition(p, position));
		}

		if (Number.isFinite(minRating)) {
			players = players.filter(
				(p) => p.rating !== undefined && p.rating >= minRating,
			);
		}

		const modifier = direction === "asc" ? 1 : -1;
		if (sort === "rating") {
			// Unrated players always sink, in both directions - "no rating" is
			// an absence, not a zero, and shouldn't top a descending sort.
			players.sort((a, b) => {
				if (a.rating === undefined && b.rating === undefined) return 0;
				if (a.rating === undefined) return 1;
				if (b.rating === undefined) return -1;
				return modifier * (a.rating - b.rating);
			});
		} else if (sort === "team") {
			// Same rule for players on no roster, most of the all-time pool.
			players.sort((a, b) => {
				if (!a.team.full_name && !b.team.full_name) return 0;
				if (!a.team.full_name) return 1;
				if (!b.team.full_name) return -1;
				return modifier * a.team.full_name.localeCompare(b.team.full_name);
			});
		} else if (sort === "name") {
			players.sort(
				(a, b) =>
					modifier *
					`${a.first_name} ${a.last_name}`.localeCompare(
						`${b.first_name} ${b.last_name}`,
					),
			);
		}

		const total = players.length;
		const page = players.slice(cursor, cursor + limit);
		const nextCursor = cursor + limit < total ? String(cursor + limit) : null;

		return {
			statusCode: 200,
			body: JSON.stringify({
				data: page,
				nextCursor,
				total,
				gameVersion: ratingsFile?.gameVersion,
			}),
		};
	} catch (err) {
		console.error(err);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Failed to fetch players" }),
		};
	}
};
