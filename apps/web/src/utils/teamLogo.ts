import type { ESPNCompetitor, ESPNTeamPlayers } from "@/models/types";

/**
 * A competitor's logo URL, with a fallback to the boxscore's per-team
 * roster entry. ESPN's summary endpoint sends `team.logo: null` on the
 * header's competitors (they carry a `logos[]` array instead), but
 * `boxscore.players` has a real, non-null logo for the same team - fall
 * back to that instead of rendering nothing. The scoreboard endpoint's
 * competitors always have a real `team.logo`, so this is a no-op there.
 */
export const getTeamLogo = (
    competitor: ESPNCompetitor,
    homeAway: "home" | "away",
    boxscorePlayers?: ESPNTeamPlayers[],
): string => {
    if (competitor.team?.logo) return competitor.team.logo;
    if (boxscorePlayers) {
        const idx = homeAway === "away" ? 0 : 1;
        const fallback = boxscorePlayers[idx]?.team?.logo;
        if (fallback) return fallback;
    }
    return "";
};
