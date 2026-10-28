import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Handler } from "aws-lambda";
import { fetchEspnJson } from "resources/espn";
import { scoresCacheControl } from "utilities/scores-cache";
import {
	HEAD_RESPONSE,
	isHead,
	jsonResponse,
	monthGameDates,
	monthMaxAge,
	parseMonthParam,
	refuse,
} from "utilities/scores";

const { ESPN_API_BASE_URL = "" } = process.env;

// Every game date in one month, for the calendar's per-day counts. ESPN's
// month is ~3 MB, close to Lambda's 6 MB response limit, and the calendar
// needs only the dates, so only they go out.
export const handler: Handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
	const now = new Date();
	const month = parseMonthParam(event.pathParameters?.month, now);
	if (month === null) return refuse(400, "Invalid month");
	if (isHead(event)) return HEAD_RESPONSE;

	// One request for the whole month. ESPN rejects YYYYMMDD-YYYYMMDD ranges
	// with a 400, defaults to 100 events without a limit, and silently returns
	// far fewer above 1000 - the busiest month has ~240.
	const res = await fetchEspnJson(`${ESPN_API_BASE_URL}/scoreboard?dates=${month}&limit=1000`);
	const dates = res.ok ? monthGameDates(res.body) : null;
	if (!res.ok || dates === null) {
		console.error(`Month ${month} unavailable:`, res.ok ? "unexpected shape" : res.reason);
		return refuse(502, "Month unavailable");
	}
	return jsonResponse(
		200,
		JSON.stringify({ events: dates.map((date) => ({ date })) }),
		scoresCacheControl(monthMaxAge(month, dates.length, now)),
	);
};
