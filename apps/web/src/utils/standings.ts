import { AWAY_C, HOME, HOME_C } from "@/constants/constants";
import type { ConferenceName, ScheduleFile, StandingsFile, StandingsTeam } from "@/models/liveData";

export interface NextGame {
    opponent: string;
    home: boolean;
    date: string;
}

/**
 * Each team's next game, by ESPN team id: the earliest scheduled game that
 * hasn't tipped off. Finals, live and postponed games are skipped.
 */
export const nextGames = (schedule: ScheduleFile | null, now: Date): Map<string, NextGame> => {
    const next = new Map<string, NextGame>();
    if (!schedule) return next;
    const upcoming = schedule.games
        .filter((game) => game.status === "scheduled" && Date.parse(game.date) >= now.getTime())
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    for (const game of upcoming) {
        if (!next.has(game.home.espnId)) {
            next.set(game.home.espnId, { opponent: game.away.abbreviation, home: true, date: game.date });
        }
        if (!next.has(game.away.espnId)) {
            next.set(game.away.espnId, { opponent: game.home.abbreviation, home: false, date: game.date });
        }
    }
    return next;
};

export const formatGamesBehind = (gamesBehind: number): string =>
    gamesBehind === 0 ? "-" : String(gamesBehind);

// ".667", the way standings print it; a perfect record is "1.000".
export const formatWinPercent = (winPercent: number): string => {
    const fixed = winPercent.toFixed(3);
    return fixed.startsWith("0") ? fixed.slice(1) : fixed;
};

export interface TeamStanding {
    conference: ConferenceName;
    team: StandingsTeam;
}

/** Every team's standing, keyed by ESPN team id (the score card's competitor id). */
export const standingsByTeam = (file: StandingsFile): Map<string, TeamStanding> =>
    new Map(
        file.conferences.flatMap((conference) =>
            conference.teams.map((team) => [team.espnId, { conference: conference.name, team }] as const),
        ),
    );

export const ordinal = (n: number): string => {
    const lastTwo = n % 100;
    if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
    return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
};

/** "23-18" -> 23/41. No games yet, or not a record -> null. */
export const recordWinPercent = (record: string): number | null => {
    const match = /^(\d+)-(\d+)$/.exec(record);
    if (!match) return null;
    const wins = Number(match[1]);
    const games = wins + Number(match[2]);
    return games ? wins / games : null;
};

export interface TooltipLine {
    text: string;
    tone?: "positive" | "negative";
}

const percent = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;

/**
 * The score card tooltip's lines, in the order the ESPN-backed tooltip had
 * them, less point differential: standings.json doesn't carry it.
 */
export const teamDetailsLines = ({ conference, team }: TeamStanding, homeAway: string): TooltipLine[] => {
    const lines: TooltipLine[] = [
        { text: `${ordinal(team.seed)} in ${conference === "East" ? "Eastern" : "Western"} Conference` },
    ];
    if (team.streak) {
        lines.push({ text: `Streak: ${team.streak}`, tone: team.streak.startsWith("W") ? "positive" : "negative" });
    }
    lines.push(
        { text: `Seed: ${team.seed}`, tone: team.seed <= 10 ? "positive" : "negative" },
        { text: `Overall Win Pct: ${percent(team.winPercent)}` },
    );
    const isHome = homeAway === HOME;
    const venuePct = recordWinPercent(isHome ? team.home : team.road);
    if (venuePct !== null) lines.push({ text: `${isHome ? HOME_C : AWAY_C} Win Pct: ${percent(venuePct)}` });
    lines.push({ text: `Games Behind 1st: ${team.gamesBehind}` });
    return lines;
};
