import type { ESPNCompetitor } from "@/models/types";

export interface TeamLeader {
    id: string;
    teamId: string;
    name: string;
    position: string;
    statline: string;
    headshot: string;
}

/**
 * Each team's overall leader for a score card ("Top Performers", or "Players
 * to Watch" before tip-off), one slot per team, away team first. ESPN's last
 * leader category is the overall one ("rating").
 *
 * A team with nothing to show gets null instead of breaking the card: ESPN
 * sends scheduled games with no `leaders` at all until it has stats to rank
 * (preseason, and the start of a season). The slot stays, because the card
 * tells the teams apart only by side.
 */
export const gameLeaders = (competitors: ESPNCompetitor[]): (TeamLeader | null)[] =>
    competitors
        .map((competitor) => {
            const leader = competitor.leaders?.at(-1)?.leaders[0];
            if (!leader) return null;
            const { athlete, displayValue } = leader;
            // The scoreboard sends the headshot as a URL; the summary
            // endpoint (which ESPNAthlete is typed from) as { href }.
            const headshot = athlete.headshot as string | { href?: string } | undefined;
            return {
                id: athlete.id,
                teamId: competitor.team.id,
                name: athlete.shortName,
                position: athlete.position?.abbreviation ?? "",
                statline: displayValue,
                headshot: (typeof headshot === "string" ? headshot : headshot?.href) ?? "",
            };
        })
        // ESPN lists home first.
        .reverse();
