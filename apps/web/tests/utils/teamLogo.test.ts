import { describe, it, expect } from "vitest";
import { getTeamLogo } from "@/utils/teamLogo";
import type { ESPNCompetitor, ESPNTeamPlayers } from "@/models/types";

const competitor = (team: Record<string, unknown>) => ({ team }) as unknown as ESPNCompetitor;

const logos = [
    { href: "https://cdn/500-dark/tor.png", rel: ["full", "dark"] },
    { href: "https://cdn/500/tor.png", rel: ["full", "default"] },
];

describe("getTeamLogo", () => {
    it("uses team.logo when ESPN sends one", () => {
        expect(getTeamLogo(competitor({ logo: "https://cdn/a.png", logos }), "home")).toBe("https://cdn/a.png");
    });

    // A scheduled game's summary has logo: null and an empty boxscore, so
    // logos[] is the only source - the game header rendered a broken <img>.
    it("falls back to the default entry of logos[] when logo is null and there is no boxscore", () => {
        expect(getTeamLogo(competitor({ logo: null, logos }), "home", [])).toBe("https://cdn/500/tor.png");
    });

    it("takes the first logos[] entry when none is tagged default", () => {
        const untagged = [{ href: "https://cdn/x.png", rel: ["full"] }];
        expect(getTeamLogo(competitor({ logo: null, logos: untagged }), "away")).toBe("https://cdn/x.png");
    });

    it("falls back to the boxscore roster logo when logos[] is missing", () => {
        const players = [{ team: { logo: "https://cdn/away.png" } }, { team: { logo: "https://cdn/home.png" } }] as unknown as ESPNTeamPlayers[];
        expect(getTeamLogo(competitor({ logo: null }), "home", players)).toBe("https://cdn/home.png");
    });

    it("returns an empty string when nothing has a logo", () => {
        expect(getTeamLogo(competitor({ logo: null }), "home")).toBe("");
    });
});
