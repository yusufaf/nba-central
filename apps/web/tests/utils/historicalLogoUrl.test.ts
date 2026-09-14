import { describe, it, expect } from "vitest";
import { resolveLegacyLogoUrl } from "@/utils/historicalLogoUrl";
import historicalLogosData from "@/assets/data/historicalLogos.json";
import type { HistoricalLogo } from "@/models/types";

const CDN = "https://d2s6ea2hcvgd9x.cloudfront.net/logos/historical";

const logos: HistoricalLogo[] = [
    {
        franchise: "ATL",
        franchiseName: "Atlanta Hawks",
        team: "TRI",
        name: "Tri-Cities Blackhawks",
        league: "NBA",
        startYear: 1950,
        endYear: 1951,
        years: "1949-50 – 1950-51",
        logo: `${CDN}/TRI-1950.0123456789ab.png`,
    },
    {
        franchise: "ATL",
        franchiseName: "Atlanta Hawks",
        team: "MLH",
        name: "Milwaukee Hawks",
        league: "NBA",
        startYear: 1952,
        endYear: 1955,
        years: "1951-52 – 1954-55",
        logo: `${CDN}/MLH-1952.ba9876543210.png`,
    },
];

describe("resolveLegacyLogoUrl", () => {
    it("maps a pre-CDN public/ path onto the era's CDN URL", () => {
        expect(resolveLegacyLogoUrl("/logos/historical/TRI-1950.png", logos)).toBe(
            `${CDN}/TRI-1950.0123456789ab.png`,
        );
        expect(resolveLegacyLogoUrl("/logos/historical/MLH-1952.png", logos)).toBe(
            `${CDN}/MLH-1952.ba9876543210.png`,
        );
    });

    it("matches on team code AND start year, not just the code", () => {
        expect(resolveLegacyLogoUrl("/logos/historical/TRI-1951.png", logos)).toBe(
            "/logos/historical/TRI-1951.png",
        );
    });

    it("passes anything that is not a legacy path through untouched", () => {
        for (const url of [
            "",
            `${CDN}/TRI-1950.0123456789ab.png`,
            "https://a.espncdn.com/i/teamlogos/nba/500/atl.png",
            "/logos/historical/TRI-1950.svg",
            "logos/historical/TRI-1950.png",
        ]) {
            expect(resolveLegacyLogoUrl(url, logos)).toBe(url);
        }
    });

    it("resolves against the real dataset by default", () => {
        const [first] = historicalLogosData as HistoricalLogo[];
        expect(
            resolveLegacyLogoUrl(`/logos/historical/${first.team}-${first.startYear}.png`),
        ).toBe(first.logo);
    });
});
