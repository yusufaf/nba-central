import { resolveLegacyCurrentLogoUrl } from "@/utils/currentLogoUrl";
import { resolveLegacyLogoUrl } from "@/utils/historicalLogoUrl";

/** A saved team's logoUrl with any pre-CDN historical path or ESPN hotlink mapped to its CDN URL. */
export const resolveSavedLogoUrl = (url: string): string =>
    resolveLegacyCurrentLogoUrl(resolveLegacyLogoUrl(url));
