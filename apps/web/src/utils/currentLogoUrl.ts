import currentTeamLogosData from "@/assets/data/currentTeamLogos.json";
import type { CurrentTeamLogo } from "@/models/types";

const currentTeamLogos = currentTeamLogosData as CurrentTeamLogo[];

// Before the current logos moved to the assets CDN (#217) the dialog's
// Current tab stored ESPN's hotlink. Its file name is the team's slug, the
// same key the CDN object is now named after.
const ESPN_LOGO = /^https:\/\/a\.espncdn\.com\/i\/teamlogos\/nba\/500\/([a-z]+)\.png$/;

/**
 * Maps a saved team's ESPN logo URL onto the team's CDN URL, so the dialog
 * still shows it as selected, the browser never loads it from ESPN, and a
 * re-save writes the new URL. Anything else passes through untouched, as
 * does an unknown slug, which only costs the selection highlight.
 */
export const resolveLegacyCurrentLogoUrl = (
    url: string,
    logos: readonly CurrentTeamLogo[] = currentTeamLogos,
): string => {
    const slug = ESPN_LOGO.exec(url)?.[1];
    if (!slug) {
        return url;
    }
    return logos.find((logo) => logo.slug === slug)?.logo ?? url;
};
