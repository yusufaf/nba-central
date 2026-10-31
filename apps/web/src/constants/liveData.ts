// The production assets CDN: historicalLogos/historicalJerseys images, and the
// team-season files under team-seasons/.
export const ASSETS_CDN_BASE_URL = "https://d2s6ea2hcvgd9x.cloudfront.net";
// live/ on it, where setSeasonContextData writes the season files.
export const LIVE_DATA_BASE_URL = `${ASSETS_CDN_BASE_URL}/live`;

// injuries.json normally refreshes every 15 minutes. One older than this means
// the refresh is broken, and a stale "Out" is worse than no badge.
export const INJURIES_MAX_AGE_MS = 12 * 60 * 60 * 1000;
// An open tab refetches on the same cadence the Lambda rewrites the file.
export const INJURIES_REFRESH_MS = 15 * 60 * 1000;
