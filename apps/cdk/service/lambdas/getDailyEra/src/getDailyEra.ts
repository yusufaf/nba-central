import {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { GetDailyEraResponse } from "models/api/daily-era-api";
import { createPuzzleListReader } from "resources/s3/daily-era-puzzles";
import {
	isPlayableDay,
	parseIsoDate,
	puzzleForDate,
	puzzleMaxAge,
} from "utilities/daily-era";

const { staticDataBucket = "", assetsCdnDomain = "" } = process.env;

const readPuzzleList = createPuzzleListReader(new S3Client(), staticDataBucket);

// CloudFront caches this route (the /api/daily/era/* behavior honours
// Cache-Control), so every refusal must say no-store. Refusals are 400/410:
// the distribution swaps a 403/404 for the SPA's index.html.
const refuse = (statusCode: number, error: string): APIGatewayProxyResultV2 => {
	const response: GetDailyEraResponse = { success: false, error };
	return {
		statusCode,
		headers: { "content-type": "application/json", "cache-control": "no-store" },
		body: JSON.stringify(response),
	};
};

// Anonymous: `date` is the player's local date. The answer never leaves here;
// only guessDailyEra reveals it.
export const handler: Handler = async (
	event: APIGatewayProxyEventV2,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const date = event.pathParameters?.date ?? "";
	// HEAD has its own route so API Gateway never 404s it, but CloudFront
	// must not cache its empty body for the GET.
	const isHead = event.requestContext?.http?.method === "HEAD";
	const now = Date.now();

	// Junk and out-of-window dates are refused before any S3 read.
	const day = parseIsoDate(date);
	if (day === null) return refuse(400, "Invalid date");
	if (!isPlayableDay(day, now)) return refuse(410, "No playable puzzle for this date");

	let list;
	try {
		list = await readPuzzleList();
	} catch (err) {
		console.error("Failed to load the Daily Era puzzle list", err);
		return refuse(500, "Failed to load puzzle");
	}

	const lookup = puzzleForDate(list, date, now);
	if (!lookup.ok) return refuse(410, "No playable puzzle for this date");

	const response: GetDailyEraResponse = {
		success: true,
		data: {
			puzzleNumber: lookup.puzzleNumber,
			puzzleId: lookup.puzzle.puzzleId,
			imageUrl: `https://${assetsCdnDomain}/${lookup.puzzle.imageKey}`,
		},
	};
	return {
		statusCode: 200,
		headers: {
			"content-type": "application/json",
			"cache-control": isHead ? "no-store" : `public, max-age=${puzzleMaxAge(lookup.day, now)}`,
		},
		body: JSON.stringify(response),
	};
};
