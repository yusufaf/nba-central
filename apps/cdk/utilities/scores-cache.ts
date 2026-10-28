// Cache lifetimes for the /api/scores/* Lambdas, shared with the CloudFront
// behavior that honours them. No imports, so the constructs can load it under
// ts-node with a relative path.

// apps/web polls live games every 15 s (LIVE_SCORES_POLL_MS), so a viewer is
// at most about 25 s behind ESPN. Change the two together.
export const SCORES_LIVE_MAX_AGE_SECONDS = 10;
export const SCORES_UPCOMING_MAX_AGE_SECONDS = 60;
// A past ET day whose games are all final won't change again.
export const SCORES_SETTLED_MAX_AGE_SECONDS = 86_400;
// Also an empty past month: the off-season, or possibly an ESPN glitch.
export const SCORES_CURRENT_MONTH_MAX_AGE_SECONDS = 3_600;
export const SCORES_NOT_FOUND_MAX_AGE_SECONDS = 60;
export const SCORES_STALE_IF_ERROR_SECONDS = 3_600;

// CloudFront serves stale content only up to the smaller of stale-if-error
// and the cache policy's max TTL, and caps every max-age at it, so this has to
// cover all of the above.
export const SCORES_CACHE_MAX_TTL_SECONDS = 86_400;

export const scoresCacheControl = (maxAge: number): string =>
	`public, max-age=${maxAge}, stale-if-error=${SCORES_STALE_IF_ERROR_SECONDS}`;
