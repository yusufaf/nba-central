import { Handler } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const { staticDataBucket = "" } = process.env;

const s3Client = new S3Client();

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

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
	team: { full_name: string; abbreviation: string };
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

// Both files are rewritten weekly by their scheduled Lambdas, so a warm
// container can serve searches without re-reading ~1 MB from S3 every time.
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();

const readJson = async <T>(key: string): Promise<T | null> => {
	const cached = cache.get(key);
	if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
		return cached.value as T;
	}

	try {
		const { Body } = await s3Client.send(
			new GetObjectCommand({ Bucket: staticDataBucket, Key: key }),
		);
		const value = JSON.parse(await Body!.transformToString()) as T;
		cache.set(key, { at: Date.now(), value });
		return value;
	} catch (err) {
		// Ratings are an optional overlay - a missing or unreadable file means
		// no ratings, not a failed player search.
		console.error(`Failed to read ${key}`, err);
		return null;
	}
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

		const [playersFile, ratingsFile] = await Promise.all([
			readJson<{ data: NormalizedPlayer[] }>("players.json"),
			readJson<RatingsFile>("player-ratings.json"),
		]);

		if (!playersFile) {
			return {
				statusCode: 500,
				body: JSON.stringify({ error: "Failed to fetch players" }),
			};
		}

		const ratings = ratingsFile?.data || {};

		let players: MergedPlayer[] = (playersFile.data || []).map((player) => {
			const rating = ratings[player.id];
			if (!rating) return player;
			return {
				...player,
				rating: rating.rating,
				ratingSource: rating.ratingSource,
				positions: rating.positions,
			};
		});

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
			players.sort(
				(a, b) =>
					modifier *
					(a.team?.full_name || "").localeCompare(
						b.team?.full_name || "",
					),
			);
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
