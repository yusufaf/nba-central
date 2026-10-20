// Thin wrapper over the Umami tracker loaded by index.html. Umami is
// cookieless and self-hosted; `window.umami` is absent under content
// blockers (or with `umami.disabled` set), and analytics must never break a
// feature. The tracker also loads on the dev server and posts to the real
// instance under hostname 127.0.0.1, so a local run is visible there.
declare global {
    interface Window {
        umami?: {
            track: (event: string, data?: Record<string, unknown>) => void;
        };
    }
}

// Events a person causes on purpose. The first of these in a tab session also
// sends `first_action`; passive events (page loads, restores) never count.
export const ACTION_EVENTS: ReadonlySet<string> = new Set([
    "player_added",
    "team_customized",
    "team_saved",
    "save_sign_in_prompted",
    "team_published",
    "share_clicked",
    "card_downloaded",
    "remix_clicked",
    "daily_era_guessed",
    "daily_era_builder_clicked",
    "daily_era_shared",
]);

const FIRST_ACTION_KEY = "nba-central:first-action";
let firstActionClaimed = false;

// Per tab session, so it survives the full-page Logto sign-in round trip.
// When storage is blocked the in-memory flag still limits it to once per load.
const claimFirstAction = (): boolean => {
    if (firstActionClaimed) return false;
    firstActionClaimed = true;
    try {
        if (sessionStorage.getItem(FIRST_ACTION_KEY)) return false;
        sessionStorage.setItem(FIRST_ACTION_KEY, "1");
    } catch {
        // storage blocked: the memo above already guards this page load
    }
    return true;
};

export const track = (event: string, data?: Record<string, unknown>): void => {
    try {
        const umami = window.umami;
        umami?.track(event, data);
        if (umami && ACTION_EVENTS.has(event) && claimFirstAction()) {
            umami.track("first_action", { action: event });
        }
    } catch (err) {
        console.error("analytics.track failed:", err);
    }
};
