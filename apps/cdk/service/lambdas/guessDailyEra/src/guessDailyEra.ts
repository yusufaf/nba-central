import {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { DAILY_ERA_MAX_ATTEMPTS } from "models/daily-era";
import {
	DailyEraGuessPayload,
	GuessDailyEraResponse,
} from "models/api/daily-era-api";
import { createPuzzleListReader } from "resources/s3/daily-era-puzzles";
import {
	dayOfPuzzle,
	isPlayableDay,
	lastPlayableSeason,
	revealFor,
	scoreGuess,
} from "utilities/daily-era";
import { parseRequestBody } from "utilities/request-body";

const { staticDataBucket = "" } = process.env;

const readPuzzleList = createPuzzleListReader(new S3Client(), staticDataBucket);

const FIRST_SEASON = 1947;

const respond = (statusCode: number, response: GuessDailyEraResponse): APIGatewayProxyResultV2 => ({
	statusCode,
	headers: { "content-type": "application/json", "cache-control": "no-store" },
	body: JSON.stringify(response),
});

const refuse = (statusCode: number, error: string) => respond(statusCode, { success: false, error });

// Anonymous, and stateless: the client says which attempt this is. Lying
// about it only reveals the answer early to the liar, which is the same as
// looking it up.
export const handler: Handler = async (
	event: APIGatewayProxyEventV2,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const parsed = parseRequestBody<DailyEraGuessPayload>(event.body, {
		puzzleId: "string",
		season: "number",
		attempt: "number",
	});
	if (!parsed.valid) return refuse(400, parsed.error);

	const { puzzleId, season, attempt } = parsed.body;
	const now = Date.now();
	if (!Number.isInteger(attempt) || attempt < 1 || attempt > DAILY_ERA_MAX_ATTEMPTS) {
		return refuse(400, "Invalid attempt");
	}
	if (!Number.isInteger(season) || season < FIRST_SEASON || season > lastPlayableSeason(now)) {
		return refuse(400, "Invalid season");
	}

	let list;
	try {
		list = await readPuzzleList();
	} catch (err) {
		console.error("Failed to load the Daily Era puzzle list", err);
		return refuse(500, "Failed to load puzzle");
	}

	const found = dayOfPuzzle(list, puzzleId);
	if (!found || !isPlayableDay(found.day, now)) {
		return refuse(410, "This puzzle is no longer playable");
	}

	const score = scoreGuess(found.puzzle.answerSeasons, season);
	const data =
		score.hit || attempt === DAILY_ERA_MAX_ATTEMPTS
			? { ...score, answer: revealFor(found.puzzle) }
			: score;
	return respond(200, { success: true, data });
};
