import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import {
	PLAYER_STATS_PK,
	PlayerStatsItem,
	SeasonStats,
	servableStats,
} from "utilities/player-stats";

// Careers come from the snapshot setPlayerStatsData keeps in the main table.
// This Lambda never calls Basketball-Reference, so a traffic spike costs
// DynamoDB reads only. A player the snapshot hasn't reached yet gets
// `available: false` - a 200, since CloudFront swaps an /api/* 404 for
// index.html.

const { MAIN_TABLE_NAME = "", staticDataBucket = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client();

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

const respond = async (playerId: string, stats: SeasonStats[] | null) => {
	const ratings = await getRatings();
	const entry = ratings?.data?.[playerId];

	return {
		statusCode: 200,
		body: JSON.stringify({
			data: stats ?? [],
			available: stats !== null,
			rating: entry?.rating,
			ratingSource: entry?.ratingSource,
			ratingHistory: entry?.history,
			gameVersion: ratings?.gameVersion,
		}),
	};
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

		const { Item } = await docClient.send(
			new GetCommand({
				TableName: MAIN_TABLE_NAME,
				Key: { PK: PLAYER_STATS_PK, SK: playerId },
			}),
		);
		return respond(playerId, servableStats(Item as PlayerStatsItem | undefined));
	} catch (err) {
		console.error(err);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Failed to fetch player stats" }),
		};
	}
};
