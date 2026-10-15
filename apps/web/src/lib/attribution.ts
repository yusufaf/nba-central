// Where a visit came from, for the `source` property on `remix_loaded`.
// Resolved once at landing and kept for the tab session: the Remix button on
// /t/<uuid> navigates without the shared link's query string, and a sign-in
// round trip changes document.referrer, so reading either later loses it.
const STORAGE_KEY = "nba-central:landing-source";
const TOKEN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

let captured: string | null = null;

const cleanToken = (raw: string | null): string | null => {
    const value = raw?.trim().toLowerCase();
    if (!value) return null;
    return TOKEN.test(value) ? value : "other";
};

export const resolveSource = (input: {
    search: string;
    referrer: string;
    origin: string;
}): string => {
    const params = new URLSearchParams(input.search);
    const tagged = cleanToken(params.get("utm_source")) ?? cleanToken(params.get("ref"));
    if (tagged) return tagged;

    try {
        const referrer = new URL(input.referrer);
        if (referrer.origin !== input.origin) return referrer.hostname.replace(/^www\./, "");
    } catch {
        // empty or unparseable referrer: treated as direct
    }
    return "direct";
};

export const captureLandingSource = (
    location: Pick<Location, "search" | "origin"> = window.location,
    referrer: string = document.referrer,
): string => {
    if (captured) return captured;
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) return (captured = stored);
    } catch {
        // storage blocked: fall through and keep the value in memory only
    }
    captured = resolveSource({ search: location.search, referrer, origin: location.origin });
    try {
        sessionStorage.setItem(STORAGE_KEY, captured);
    } catch {
        // see above
    }
    return captured;
};

export const landingSource = (): string => captured ?? captureLandingSource();
