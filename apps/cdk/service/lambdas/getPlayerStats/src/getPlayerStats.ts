import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	GetCommand,
	PutCommand,
	PutCommandInput,
	DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const {
	BBREF_BASE_URL = "",
	MAIN_TABLE_NAME = "",
	staticDataBucket = "",
} = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client();

// An entry has two clocks. `freshUntil` is when we next refresh it; `ttl` is
// when DynamoDB may delete it. Entries with stats outlive their freshness so a
// failed refresh still has the last good career to serve.
// A career with at least one season.
export const STATS_FRESH_SECONDS = 7 * 24 * 60 * 60;
// A player page with no seasons yet (a rookie), or a 404.
export const EMPTY_FRESH_SECONDS = 6 * 60 * 60;
// After an upstream failure: how long a failure marker lasts, or how long a
// stale entry is served before we try again.
export const FAILURE_BACKOFF_SECONDS = 15 * 60;
// How long past `freshUntil` an entry with stats is kept as the stale fallback.
export const RETAIN_SECONDS = 90 * 24 * 60 * 60;
export const FETCH_TIMEOUT_MS = 8_000;

interface CacheItem {
	PK: string;
	SK: string;
	stats: any[];
	// Legacy items have no `freshUntil` and are fresh until their `ttl`.
	freshUntil?: number;
	ttl: number;
	failed?: boolean;
}

const freshUntilOf = (item: CacheItem) => item.freshUntil ?? item.ttl;

type WriteCondition = Pick<
	PutCommandInput,
	"ConditionExpression" | "ExpressionAttributeNames" | "ExpressionAttributeValues"
>;

// Only write if the item is still the one we read, so a failure never clobbers
// a refresh that another request completed in the meantime.
const unchangedSince = (seen: CacheItem | undefined): WriteCondition =>
	seen
		? {
				ConditionExpression: "#ttl = :seenTtl",
				ExpressionAttributeNames: { "#ttl": "ttl" },
				ExpressionAttributeValues: { ":seenTtl": seen.ttl },
			}
		: { ConditionExpression: "attribute_not_exists(PK)" };

// Best effort: a cache write failure must not turn good stats into an error,
// and a lost condition just means a concurrent request already wrote newer data.
const writeCache = async (item: CacheItem, condition: WriteCondition = {}) => {
	try {
		await docClient.send(
			new PutCommand({ TableName: MAIN_TABLE_NAME, Item: item, ...condition }),
		);
	} catch (err) {
		if ((err as Error).name === "ConditionalCheckFailedException") return;
		console.error("Failed to cache player stats", err);
	}
};

const upstreamFailure = () => ({
	statusCode: 502,
	body: JSON.stringify({ error: "Failed to fetch player stats" }),
});

// The ratings file is rewritten weekly; hold it in the warm container rather
// than re-reading it for every player the user opens.
const RATINGS_CACHE_TTL_MS = 15 * 60 * 1000;
let ratingsCache: { at: number; value: RatingsFile | null } | null = null;

interface RatingsFile {
	gameVersion?: string;
	data: Record<
		string,
		{
			rating: number;
			ratingSource: string;
			history?: { gameVersion: string; overall: number }[];
		}
	>;
}

/**
 * The 2K rating overlay for one player. This endpoint is the only place the
 * per-game-year history is served - the player list omits it, since it's ~12
 * entries per player across a whole page of results.
 */
const getRatings = async (): Promise<RatingsFile | null> => {
	if (ratingsCache && Date.now() - ratingsCache.at < RATINGS_CACHE_TTL_MS) {
		return ratingsCache.value;
	}

	let value: RatingsFile | null = null;
	try {
		const { Body } = await s3Client.send(
			new GetObjectCommand({
				Bucket: staticDataBucket,
				Key: "player-ratings.json",
			}),
		);
		value = JSON.parse(await Body!.transformToString()) as RatingsFile;
	} catch (err) {
		// Ratings are optional - a missing file means no rating, not a failure.
		console.error("Failed to read player-ratings.json", err);
	}

	ratingsCache = { at: Date.now(), value };
	return value;
};

const respond = async (playerId: string, stats: any[]) => {
	const ratings = await getRatings();
	const entry = ratings?.data?.[playerId];

	return {
		statusCode: 200,
		body: JSON.stringify({
			data: stats,
			rating: entry?.rating,
			ratingSource: entry?.ratingSource,
			ratingHistory: entry?.history,
			gameVersion: ratings?.gameVersion,
		}),
	};
};

const num = (v: string): number => {
	const n = parseFloat(v);
	return Number.isFinite(n) ? n : 0;
};

// Parse the per_game_stats table into the BALLDONTLIE season_averages shape the
// frontend already consumes. BBRef percentages are already fractions (0.515).
// null means the page isn't a player page at all (a rate-limit or interstitial
// served as a 200), which is a failure rather than an empty career.
export const parseCareer = (html: string): any[] | null => {
	const $ = cheerio.load(html);
	if ($("#meta").length === 0) return null;
	const seenSeasons = new Set<number>();
	const out: any[] = [];

	$("#per_game_stats tbody tr").each((_, tr) => {
		const $tr = $(tr);
		if (($tr.attr("class") || "").includes("thead")) return;

		const yearText = $tr.find('[data-stat="year_id"]').text().trim();
		const season = parseInt(yearText.split("-")[0], 10); // "2003-04" -> 2003
		if (!Number.isFinite(season)) return; // Career/summary rows
		if (seenSeasons.has(season)) return; // first row = combined multi-team
		seenSeasons.add(season);

		const td = (stat: string) =>
			$tr.find(`td[data-stat="${stat}"]`).text().trim();

		out.push({
			season,
			games_played: num(td("games")),
			min: num(td("mp_per_g")),
			fgm: num(td("fg_per_g")),
			fga: num(td("fga_per_g")),
			fg_pct: num(td("fg_pct")),
			fg3m: num(td("fg3_per_g")),
			fg3a: num(td("fg3a_per_g")),
			fg3_pct: num(td("fg3_pct")),
			ftm: num(td("ft_per_g")),
			fta: num(td("fta_per_g")),
			ft_pct: num(td("ft_pct")),
			oreb: num(td("orb_per_g")),
			dreb: num(td("drb_per_g")),
			reb: num(td("trb_per_g")),
			ast: num(td("ast_per_g")),
			stl: num(td("stl_per_g")),
			blk: num(td("blk_per_g")),
			turnover: num(td("tov_per_g")),
			pf: num(td("pf_per_g")),
			pts: num(td("pts_per_g")),
		});
	});

	// Most recent season first (frontend reads playerStats[0] as latest).
	return out.sort((a, b) => b.season - a.season);
};

export const scrapeCareer = async (playerId: string): Promise<any[]> => {
	const url = `${BBREF_BASE_URL}/players/${playerId[0]}/${playerId}.html`;
	const response = await fetch(url, {
		headers: {
			"User-Agent": "Mozilla/5.0 (compatible; TeamBuilder/1.0)",
		},
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	});
	if (response.status === 404) return []; // no such page: a miss, not a failure
	if (!response.ok) {
		throw new Error(`BBRef returned ${response.status} ${response.statusText}`);
	}

	const stats = parseCareer(await response.text());
	if (stats === null) throw new Error("BBRef returned a page without player info");
	return stats;
};

export const handler: Handler = async (event, context): Promise<any> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	try {
		const playerId = (event?.queryStringParameters?.playerId || "").trim();
		if (!playerId || !/^[a-z0-9.'-]+$/i.test(playerId)) {
			return {
				statusCode: 400,
				body: JSON.stringify({ error: "valid playerId is required" }),
			};
		}

		const PK = "PLAYERSTATS";
		const SK = playerId;

		const now = Math.floor(Date.now() / 1000);

		// 1. Cache lookup: a fresh entry (or a fresh failure marker) answers.
		const cached = (
			await docClient.send(
				new GetCommand({ TableName: MAIN_TABLE_NAME, Key: { PK, SK } }),
			)
		).Item as CacheItem | undefined;
		if (cached && freshUntilOf(cached) > now) {
			return cached.failed
				? upstreamFailure()
				: respond(playerId, cached.stats ?? []);
		}

		// 2. Missing or due for a refresh: one BBRef page scrape for the full career.
		let stats: any[];
		try {
			stats = await scrapeCareer(playerId);
			// Careers never shrink: no seasons for a player we have seasons for
			// means BBRef moved or hid the table (or the page 404s), so keep the
			// old copy.
			if (stats.length === 0 && cached && !cached.failed && cached.stats?.length) {
				throw new Error("BBRef returned no seasons for a player with cached stats");
			}
		} catch (err) {
			console.error(`Refreshing ${playerId} failed`, err);
			const retryAt = now + FAILURE_BACKOFF_SECONDS;
			const stale =
				cached && !cached.failed && Array.isArray(cached.stats) ? cached : undefined;
			if (stale) {
				await writeCache(
					{ ...stale, freshUntil: retryAt, ttl: retryAt + RETAIN_SECONDS },
					unchangedSince(cached),
				);
				return respond(playerId, stale.stats);
			}
			await writeCache(
				{ PK, SK, stats: [], failed: true, freshUntil: retryAt, ttl: retryAt },
				unchangedSince(cached),
			);
			return upstreamFailure();
		}

		// 3. Write-through cache. Unconditional: fresh data always wins.
		const freshUntil =
			now + (stats.length ? STATS_FRESH_SECONDS : EMPTY_FRESH_SECONDS);
		await writeCache({ PK, SK, stats, freshUntil, ttl: freshUntil + RETAIN_SECONDS });

		return respond(playerId, stats);
	} catch (err) {
		console.error(err);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Failed to fetch player stats" }),
		};
	}
};
