import type { ESPNLineScore, ESPNCompetitor } from "@/models/types";

/**
 * Per-period score text. ESPN's scoreboard endpoint (used by the Scores
 * page) sends a numeric `value`; its summary endpoint (used by the box
 * score page) sends only `displayValue` - normalizing here lets one
 * component render either shape instead of the summary one silently
 * rendering blank cells for a `value` that endpoint never sends.
 */
export const periodScore = (ls: ESPNLineScore): string => {
    if (ls.displayValue != null) return ls.displayValue;
    if (ls.value != null) return String(ls.value);
    return "";
};

/**
 * `winner` is present on scoreboard competitors but absent from summary
 * competitors - derive it from the score strings when it's missing rather
 * than never highlighting either team.
 */
export const isWinningTeam = (
    team: ESPNCompetitor,
    opponent: ESPNCompetitor | undefined,
): boolean => {
    if (typeof team.winner === "boolean") return team.winner;
    if (!opponent) return false;

    const teamScore = Number(team.score);
    const opponentScore = Number(opponent.score);
    if (Number.isNaN(teamScore) || Number.isNaN(opponentScore)) return false;

    return teamScore > opponentScore;
};
