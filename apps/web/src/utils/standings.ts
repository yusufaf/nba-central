import type { ScheduleFile } from "@/models/liveData";

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
