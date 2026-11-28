import { describe, it, expect } from "vitest";
import { resolveLegacyCurrentLogoUrl } from "@/utils/currentLogoUrl";
import { ASSETS_CDN_BASE_URL as CDN } from "@/constants/liveData";
import currentTeamLogosData from "@/assets/data/currentTeamLogos.json";
import type { CurrentTeamLogo } from "@/models/types";

const data = currentTeamLogosData as CurrentTeamLogo[];
const espn = (slug: string) => `https://a.espncdn.com/i/teamlogos/nba/500/${slug}.png`;

const logos: CurrentTeamLogo[] = [
    { name: "Atlanta Hawks", slug: "atl", logo: `${CDN}/logos/current/atl.0123456789ab.png` },
    { name: "Utah Jazz", slug: "utah", logo: `${CDN}/logos/current/utah.0123456789ab.png` },
];

describe("resolveLegacyCurrentLogoUrl", () => {
    it("maps a saved ESPN logo URL onto the team's CDN URL", () => {
        expect(resolveLegacyCurrentLogoUrl(espn("atl"), logos)).toBe(logos[0].logo);
        expect(resolveLegacyCurrentLogoUrl(espn("utah"), logos)).toBe(logos[1].logo);
    });

    it("passes anything else through untouched", () => {
        for (const url of [
            "",
            logos[0].logo,
            "/logos/historical/TRI-1950.png",
            espn("xyz"),
            "https://a.espncdn.com/i/teamlogos/nba/500-dark/atl.png",
            "http://a.espncdn.com/i/teamlogos/nba/500/atl.png",
        ]) {
            expect(resolveLegacyCurrentLogoUrl(url, logos), url).toBe(url);
        }
    });

    it("resolves against the real dataset by default", () => {
        const bos = data.find((row) => row.slug === "bos");
        expect(resolveLegacyCurrentLogoUrl(espn("bos"))).toBe(bos?.logo);
    });
});

describe("currentTeamLogos.json", () => {
    it("holds all 30 teams, every logo on the assets CDN", () => {
        expect(data).toHaveLength(30);
        const cdn = CDN.replace(/[.]/g, "\\.");
        for (const row of data) {
            expect(row.logo, row.name).toMatch(new RegExp(`^${cdn}/logos/current/${row.slug}\\.[0-9a-f]{12}\\.png$`));
        }
        expect(new Set(data.map((row) => row.slug)).size).toBe(30);
        expect(JSON.stringify(data)).not.toContain("espn");
    });
});
