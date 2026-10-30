// Keys and cache settings for the live/ files in the assets bucket, shared by
// setSeasonContextData (which writes them), the assets CDN behavior and the
// bucket's lifecycle rule. No imports, so the constructs can load it under
// ts-node with a relative path.

export const LIVE_PREFIX = "live/";
export const STANDINGS_KEY = `${LIVE_PREFIX}standings.json`;
export const SCHEDULE_KEY = `${LIVE_PREFIX}schedule.json`;
export const HEADSHOTS_KEY = `${LIVE_PREFIX}headshots.json`;
export const INJURIES_KEY = `${LIVE_PREFIX}injuries.json`;

// Relative to live/, as headshots.json stores it.
export const headshotPath = (espnId: string): string => `headshots/${espnId}.png`;
export const headshotKey = (espnId: string): string =>
	`${LIVE_PREFIX}${headshotPath(espnId)}`;

export const LIVE_JSON_MAX_AGE_SECONDS = 300;
export const LIVE_STALE_IF_ERROR_SECONDS = 86_400;
export const LIVE_JSON_CACHE_CONTROL = `public, max-age=${LIVE_JSON_MAX_AGE_SECONDS}, stale-while-revalidate=60, stale-if-error=${LIVE_STALE_IF_ERROR_SECONDS}`;
export const HEADSHOT_CACHE_CONTROL = "public, max-age=86400";

// CloudFront serves stale content only up to the smaller of stale-if-error
// and the cache policy's max TTL, so this has to cover stale-if-error.
export const LIVE_CACHE_MAX_TTL_SECONDS = 86_400;

// The bucket is versioned and the JSON files are rewritten hourly (injuries
// every 15 minutes).
export const LIVE_NONCURRENT_VERSION_DAYS = 7;
