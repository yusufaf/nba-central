import type { ESPNCompetitor, ESPNTeamPlayers } from "@/models/types";

/**
 * A competitor's logo URL. ESPN's summary endpoint sends `team.logo: null`
 * on the header's competitors, with a `logos[]` array instead. Before tip-off
 * `boxscore.players` is empty too, so `logos[]` is the only source for a
 * scheduled game; the boxscore entry stays as the next fallback. The
 * scoreboard endpoint's competitors always have a real `team.logo`, so this
 * is a no-op there.
 */
export const getTeamLogo = (
    competitor: ESPNCompetitor,
    homeAway: "home" | "away",
    boxscorePlayers?: ESPNTeamPlayers[],
): string => {
    if (competitor.team?.logo) return competitor.team.logo;
    const logos = competitor.team?.logos;
    const preferred = logos?.find((l) => l.rel?.includes("default")) ?? logos?.[0];
    if (preferred?.href) return preferred.href;
    if (boxscorePlayers) {
        const idx = homeAway === "away" ? 0 : 1;
        const fallback = boxscorePlayers[idx]?.team?.logo;
        if (fallback) return fallback;
    }
    return "";
};
