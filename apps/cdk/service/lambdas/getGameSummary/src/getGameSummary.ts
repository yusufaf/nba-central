import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Handler } from "aws-lambda";
import { fetchEspnJson } from "resources/espn";
import { etDate } from "utilities/espn";
import { SCORES_NOT_FOUND_MAX_AGE_SECONDS, scoresCacheControl } from "utilities/scores-cache";
import {
	HEAD_RESPONSE,
	isHead,
	jsonResponse,
	parseGameIdParam,
	refuse,
	scoresMaxAge,
	summaryClock,
} from "utilities/scores";

const { ESPN_API_BASE_URL = "" } = process.env;

// One game's box score, ESPN's body as sent: plays and winprobability stay in.
export const handler: Handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
	const now = new Date();
	const gameId = parseGameIdParam(event.pathParameters?.gameId);
	if (gameId === null) return refuse(400, "Invalid game id");
	if (isHead(event)) return HEAD_RESPONSE;

	const res = await fetchEspnJson(`${ESPN_API_BASE_URL}/summary?event=${gameId}`);
	if (!res.ok && res.status === 404) {
		// 410, not 404 (see refuse), and briefly cached so a repeated unknown
		// id doesn't reach ESPN every time.
		return refuse(410, "Game not found", scoresCacheControl(SCORES_NOT_FOUND_MAX_AGE_SECONDS));
	}
	const clock = res.ok ? summaryClock(res.body) : null;
	if (!res.ok || clock === null) {
		console.error(`Box score ${gameId} unavailable:`, res.ok ? "unexpected shape" : res.reason);
		return refuse(502, "Box score unavailable");
	}
	const day = etDate(clock.start ?? now);
	return jsonResponse(200, res.text, scoresCacheControl(scoresMaxAge([clock], day, now)));
};
