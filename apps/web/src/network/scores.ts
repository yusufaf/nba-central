import { API_BASE_URL } from "@/network/api";
import type { ESPNEvent, ESPNGameSummary, ESPNScoreboardResponse } from "@/models/types";
import { espnMonth } from "@/utils/calendarGameCounts";
import { formatDateForEspn } from "@/utils/date";

// With the edge's 10 s max-age for live games (apps/cdk utilities/scores-cache.ts),
// a viewer is at most ~25 s behind ESPN. Change the two together.
export const LIVE_SCORES_POLL_MS = 15_000;

export class GameNotFoundError extends Error {}

export type MonthGamesResponse = { events: Pick<ESPNEvent, "date">[] };

// Plain fetch, not the axios `api`: CloudFront shares these responses between
// viewers, so they carry no auth header. The Lambdas behind them call ESPN;
// the browser never does.
const getScores = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${API_BASE_URL}/api/scores/${path}`);
    if (res.status === 410) throw new GameNotFoundError(`${path} not found`);
    if (!res.ok) throw new Error(`${path} returned ${res.status}`);
    return res.json();
};

export const getScoreboard = (date: Date) =>
    getScores<ESPNScoreboardResponse>(`day/${formatDateForEspn(date)}`);

export const getMonthGames = (year: number, month: number) =>
    getScores<MonthGamesResponse>(`month/${espnMonth(year, month)}`);

export const getGameSummary = (gameId: string) =>
    getScores<ESPNGameSummary>(`game/${encodeURIComponent(gameId)}`);
