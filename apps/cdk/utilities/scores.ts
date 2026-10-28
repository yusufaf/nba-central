import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { etDate } from "utilities/espn";
import { isRecord } from "utilities/type-guards";
import {
	SCORES_CURRENT_MONTH_MAX_AGE_SECONDS,
	SCORES_LIVE_MAX_AGE_SECONDS,
	SCORES_SETTLED_MAX_AGE_SECONDS,
	SCORES_UPCOMING_MAX_AGE_SECONDS,
} from "utilities/scores-cache";

// Rules for the /api/scores/* proxy Lambdas. Every request names its day,
// month or game in the path, and anything that isn't a plausible one is
// refused before ESPN is called, so junk can't bust the cache through to ESPN.

// The web's date picker starts at 2000 and ends at most next June 30.
export const SCORES_FIRST_DAY = "20000101";
export const SCORES_FIRST_MONTH = "200001";
export const SCORES_MAX_DAYS_AHEAD = 400;
// A game counts as live from shortly before tip-off, and a "pre" game that
// should have started a while ago (a delayed tip) still does, but not one
// stuck in "pre" for hours, or a postponed game would keep its day hot forever.
export const TIPOFF_LEAD_MS = 15 * 60_000;
export const STUCK_PRE_MS = 6 * 3_600_000;

const DAY_MS = 86_400_000;

const lastAllowedDay = (now: Date): string => etDate(now.getTime() + SCORES_MAX_DAYS_AHEAD * DAY_MS);

// YYYYMMDD, a real calendar date, from 2000 to 400 days past today in ET.
export const parseDayParam = (raw: string | undefined, now: Date): string | null => {
	if (!raw || !/^\d{8}$/.test(raw)) return null;
	const [y, m, d] = [raw.slice(0, 4), raw.slice(4, 6), raw.slice(6, 8)].map(Number);
	const date = new Date(Date.UTC(y, m - 1, d));
	if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
		return null;
	}
	if (raw < SCORES_FIRST_DAY || raw > lastAllowedDay(now)) return null;
	return raw;
};

export const parseMonthParam = (raw: string | undefined, now: Date): string | null => {
	if (!raw || !/^\d{6}$/.test(raw)) return null;
	const month = Number(raw.slice(4, 6));
	if (month < 1 || month > 12) return null;
	if (raw < SCORES_FIRST_MONTH || raw > lastAllowedDay(now).slice(0, 6)) return null;
	return raw;
};

// ESPN event ids are 9 digits today; leave room either side.
export const parseGameIdParam = (raw: string | undefined): string | null =>
	raw && /^\d{6,12}$/.test(raw) ? raw : null;

export type GameClock = { state: string | null; start: number | null };

const clockOf = (competition: unknown, date: unknown): GameClock => {
	const status = isRecord(competition) && isRecord(competition.status) ? competition.status : null;
	const type = status && isRecord(status.type) ? status.type : null;
	const start = typeof date === "string" ? Date.parse(date) : NaN;
	return {
		state: type && typeof type.state === "string" ? type.state : null,
		start: Number.isFinite(start) ? start : null,
	};
};

export const scoreboardClocks = (body: unknown): GameClock[] | null => {
	if (!isRecord(body) || !Array.isArray(body.events)) return null;
	return body.events.map((event) => {
		const competitions = isRecord(event) && Array.isArray(event.competitions) ? event.competitions : [];
		return clockOf(competitions[0], isRecord(event) ? event.date : undefined);
	});
};

export const summaryClock = (body: unknown): GameClock | null => {
	if (!isRecord(body) || !isRecord(body.header) || !Array.isArray(body.header.competitions)) {
		return null;
	}
	const competition = body.header.competitions[0];
	if (!isRecord(competition)) return null;
	return clockOf(competition, competition.date);
};

export const monthGameDates = (body: unknown): string[] | null => {
	if (!isRecord(body) || !Array.isArray(body.events)) return null;
	return body.events
		.map((event) => (isRecord(event) ? event.date : undefined))
		.filter((date): date is string => typeof date === "string" && Number.isFinite(Date.parse(date)));
};

// An unknown state counts as live: a short cache is the safe guess.
export const isLiveGame = ({ state, start }: GameClock, now: Date): boolean => {
	if (state === "in") return true;
	if (state === "post") return false;
	if (state !== "pre") return true;
	if (start === null) return true;
	const t = now.getTime();
	return start - t <= TIPOFF_LEAD_MS && t - start <= STUCK_PRE_MS;
};

// Only a past day with games, all final, is settled. An empty answer may be
// an ESPN glitch, so it gets the short TTL: wrong "no games" heals within a
// minute, and the cost is still one ESPN request per minute per day viewed.
export const scoresMaxAge = (games: GameClock[], etDay: string, now: Date): number => {
	if (games.some((game) => isLiveGame(game, now))) return SCORES_LIVE_MAX_AGE_SECONDS;
	if (etDay < etDate(now) && games.length > 0 && games.every((game) => game.state === "post")) {
		return SCORES_SETTLED_MAX_AGE_SECONDS;
	}
	return SCORES_UPCOMING_MAX_AGE_SECONDS;
};

// Like scoresMaxAge, an empty past month (the off-season, or a glitch) isn't settled.
export const monthMaxAge = (month: string, gameCount: number, now: Date): number => {
	if (month >= etDate(now).slice(0, 6)) return SCORES_CURRENT_MONTH_MAX_AGE_SECONDS;
	return gameCount > 0 ? SCORES_SETTLED_MAX_AGE_SECONDS : SCORES_CURRENT_MONTH_MAX_AGE_SECONDS;
};

export const jsonResponse = (
	statusCode: number,
	body: string,
	cacheControl: string,
): APIGatewayProxyStructuredResultV2 => ({
	statusCode,
	headers: { "content-type": "application/json", "cache-control": cacheControl },
	body,
});

// CloudFront caches these routes, so a refusal says no-store unless the
// caller means it to be cached. Never 403/404: the distribution swaps those
// for the SPA's index.html.
export const refuse = (
	statusCode: number,
	error: string,
	cacheControl = "no-store",
): APIGatewayProxyStructuredResultV2 =>
	jsonResponse(statusCode, JSON.stringify({ success: false, error }), cacheControl);

// HEAD has its own route so API Gateway never 404s it, but CloudFront must
// not cache its empty body for the GET.
export const isHead = (event: APIGatewayProxyEventV2): boolean =>
	event.requestContext?.http?.method === "HEAD";

export const HEAD_RESPONSE: APIGatewayProxyStructuredResultV2 = {
	statusCode: 200,
	headers: { "cache-control": "no-store" },
};
