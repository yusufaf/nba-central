import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	GetCommand,
	PutCommand,
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

// Cache career stats for 7 days (refreshes in-season without going stale forever).
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

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
const parseCareer = (html: string) => {
	const $ = cheerio.load(html);
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

		// 1. Cache lookup.
		const cached = await docClient.send(
			new GetCommand({ TableName: MAIN_TABLE_NAME, Key: { PK, SK } }),
		);
		if (cached.Item?.stats) {
			return respond(playerId, cached.Item.stats);
		}

		// 2. Cache miss — one BBRef page scrape for the full career.
		const url = `${BBREF_BASE_URL}/players/${playerId[0]}/${playerId}.html`;
		const response = await fetch(url, {
			headers: {
				"User-Agent": "Mozilla/5.0 (compatible; TeamBuilder/1.0)",
			},
		});
		if (!response.ok) {
			throw new Error(
				`BBRef returned ${response.status} ${response.statusText}`,
			);
		}

		const html = await response.text();
		const stats = parseCareer(html);

		// 3. Write-through cache.
		await docClient.send(
			new PutCommand({
				TableName: MAIN_TABLE_NAME,
				Item: {
					PK,
					SK,
					stats,
					ttl: Math.floor(Date.now() / 1000) + CACHE_TTL_SECONDS,
				},
			}),
		);

		return respond(playerId, stats);
	} catch (err) {
		console.error(err);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Failed to fetch player stats" }),
		};
	}
};
