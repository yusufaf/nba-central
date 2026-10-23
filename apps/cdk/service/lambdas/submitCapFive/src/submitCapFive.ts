import {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { CapFiveSubmitPayload, SubmitCapFiveResponse } from "models/api/cap-five-api";
import { CAP_FIVE_FIRST_DATE } from "models/cap-five";
import { createCapFivePuzzleReader } from "resources/s3/cap-five-puzzles";
import { scoreLineup } from "utilities/cap-five";
import { isPlayableDay, parseIsoDate } from "utilities/daily-era";
import { parseRequestBody } from "utilities/request-body";

const { staticDataBucket = "" } = process.env;

const readPuzzle = createCapFivePuzzleReader(new S3Client(), staticDataBucket);

const respond = (statusCode: number, response: SubmitCapFiveResponse): APIGatewayProxyResultV2 => ({
	statusCode,
	headers: { "content-type": "application/json", "cache-control": "no-store" },
	body: JSON.stringify(response),
});

const refuse = (statusCode: number, error: string) => respond(statusCode, { success: false, error });

// Anonymous and stateless: "one submission a day" is kept by the client.
// Submitting again only reveals the answer to someone who has already seen it.
export const handler: Handler = async (
	event: APIGatewayProxyEventV2,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const parsed = parseRequestBody<CapFiveSubmitPayload>(event.body, {
		date: "string",
		picks: "array",
	});
	if (!parsed.valid) return refuse(400, parsed.error);

	const { date, picks } = parsed.body;
	const day = parseIsoDate(date);
	if (day === null) return refuse(400, "Invalid date");
	if (!isPlayableDay(day, Date.now()) || date < CAP_FIVE_FIRST_DATE) {
		return refuse(410, "This puzzle is no longer playable");
	}

	let puzzle;
	try {
		puzzle = await readPuzzle(date);
	} catch (err) {
		console.error(`Failed to load the Cap Five puzzle for ${date}`, err);
		return refuse(500, "Failed to load puzzle");
	}
	if (!puzzle) return refuse(410, "This puzzle is no longer playable");

	const result = scoreLineup(puzzle, picks);
	if (!result) return refuse(400, "Pick five players from today's pool");
	return respond(200, { success: true, data: result });
};
