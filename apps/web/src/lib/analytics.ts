// Thin wrapper over the Umami tracker loaded by index.html. Umami is
// cookieless and self-hosted; `window.umami` is absent on the dev server
// and under content blockers, and analytics must never break a feature.
declare global {
    interface Window {
        umami?: {
            track: (event: string, data?: Record<string, unknown>) => void;
        };
    }
}

export const track = (event: string, data?: Record<string, unknown>): void => {
    try {
        window.umami?.track(event, data);
    } catch (err) {
        console.error("analytics.track failed:", err);
    }
};
