import {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { GetCapFiveResponse } from "models/api/cap-five-api";
import { CAP_FIVE_FIRST_DATE } from "models/cap-five";
import { createCapFivePuzzleReader } from "resources/s3/cap-five-puzzles";
import { toPuzzleView } from "utilities/cap-five";
import { isPlayableDay, parseIsoDate, puzzleMaxAge } from "utilities/daily-era";

const { staticDataBucket = "" } = process.env;

const readPuzzle = createCapFivePuzzleReader(new S3Client(), staticDataBucket);

// CloudFront caches this route (the /api/daily/cap-five/* behavior honours
// Cache-Control), so every refusal must say no-store. Refusals are 400/410:
// the distribution swaps a 403/404 for the SPA's index.html.
const refuse = (statusCode: number, error: string): APIGatewayProxyResultV2 => {
	const response: GetCapFiveResponse = { success: false, error };
	return {
		statusCode,
		headers: { "content-type": "application/json", "cache-control": "no-store" },
		body: JSON.stringify(response),
	};
};

// Anonymous: `date` is the player's local date. No rating leaves here; only
// submitCapFive reveals them.
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

	const day = parseIsoDate(date);
	if (day === null) return refuse(400, "Invalid date");
	if (!isPlayableDay(day, now) || date < CAP_FIVE_FIRST_DATE) {
		return refuse(410, "No playable puzzle for this date");
	}

	let puzzle;
	try {
		puzzle = await readPuzzle(date);
	} catch (err) {
		console.error(`Failed to load the Cap Five puzzle for ${date}`, err);
		return refuse(500, "Failed to load puzzle");
	}
	if (!puzzle) return refuse(410, "No playable puzzle for this date");

	const response: GetCapFiveResponse = { success: true, data: toPuzzleView(puzzle) };
	return {
		statusCode: 200,
		headers: {
			"content-type": "application/json",
			"cache-control": isHead ? "no-store" : `public, max-age=${puzzleMaxAge(day, now)}`,
		},
		body: JSON.stringify(response),
	};
};
