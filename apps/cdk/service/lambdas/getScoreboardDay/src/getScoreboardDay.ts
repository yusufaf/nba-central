import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Handler } from "aws-lambda";
import { fetchEspnJson } from "resources/espn";
import { scoresCacheControl } from "utilities/scores-cache";
import {
	HEAD_RESPONSE,
	isHead,
	jsonResponse,
	parseDayParam,
	refuse,
	scoreboardClocks,
	scoresMaxAge,
} from "utilities/scores";

const { ESPN_API_BASE_URL = "" } = process.env;

// One ET day's scoreboard, ESPN's body as sent. CloudFront caches it for as
// long as its games allow (10 s while one is on, a day once a past day is
// final), so every viewer shares one ESPN request per window.
export const handler: Handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
	const now = new Date();
	const date = parseDayParam(event.pathParameters?.date, now);
	if (date === null) return refuse(400, "Invalid date");
	if (isHead(event)) return HEAD_RESPONSE;

	const res = await fetchEspnJson(`${ESPN_API_BASE_URL}/scoreboard?dates=${date}`);
	const clocks = res.ok ? scoreboardClocks(res.body) : null;
	if (!res.ok || clocks === null) {
		console.error(`Scoreboard ${date} unavailable:`, res.ok ? "unexpected shape" : res.reason);
		return refuse(502, "Scoreboard unavailable");
	}
	return jsonResponse(200, res.text, scoresCacheControl(scoresMaxAge(clocks, date, now)));
};
