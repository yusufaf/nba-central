// Logto endpoint and per-project API resource identifier, by deploymentType.
// Mirrors resources/cognito/index.ts's shape, which this replaces for auth.
//
// endpoint starts pointed at the Fly-provided hostname (logto-flyio isn't
// cut over to auth.yusufaf.dev yet — see that repo's README). Update both
// entries to "https://auth.yusufaf.dev" once the DNS cutover lands; nothing
// else in the authorizer needs to change, since it derives issuer/JWKS URI
// from this value.
export const LOGTO_ENDPOINT: { [key: string]: string } = {
    development: "https://logto-af.fly.dev",
    production: "https://logto-af.fly.dev",
};

// The API resource identifier created in the Logto console (Authorization >
// API resources). This is what the authorizer checks the access token's
// `aud` claim against — the whole point being that a token issued for a
// different project's API resource (e.g. Quizaroni's) is rejected here.
export const LOGTO_API_RESOURCE: { [key: string]: string } = {
    development: "https://api.nba.yusufaf.dev",
    production: "https://api.nba.yusufaf.dev",
};
