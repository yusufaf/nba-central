import historicalLogosData from "@/assets/data/historicalLogos.json";
import type { HistoricalLogo } from "@/models/types";

const historicalLogos = historicalLogosData as HistoricalLogo[];

// Before the logos moved to the assets CDN (issue #66) the picker stored the
// site-relative path of the checked-in PNG, "/logos/historical/TEAM-YEAR.png",
// where TEAM-YEAR is the era's team code and start year - the same key the
// CDN object is now named after.
const LEGACY_LOGO_PATH = /^\/logos\/historical\/([A-Z0-9]+)-(\d{4})\.png$/;

/**
 * Maps a saved team's pre-CDN logo path onto the era's current CDN URL, so
 * the picker still shows it as selected and a re-save writes the new URL.
 * Anything else (already a CDN URL, an ESPN logo, "") passes through
 * untouched - as does a legacy path whose era no longer exists, which only
 * costs the selection highlight.
 */
export const resolveLegacyLogoUrl = (
    url: string,
    logos: readonly HistoricalLogo[] = historicalLogos,
): string => {
    const match = LEGACY_LOGO_PATH.exec(url);
    if (!match) {
        return url;
    }
    const [, team, startYear] = match;
    const era = logos.find(
        (logo) => logo.team === team && logo.startYear === Number(startYear),
    );
    return era?.logo ?? url;
};
