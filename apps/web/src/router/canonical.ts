export const SITE_ORIGIN = 'https://nba.yusufaf.dev';

// index.html ships one canonical, the home page, for every route: that's all
// a crawler that doesn't run JS sees. Crawlers that render the app get the
// route they're on, so /scores isn't folded into /. Always the production
// origin, whichever host served the page. Concatenated, not resolved with
// new URL(path, origin): a path like //evil.example would resolve off-site.
export const syncCanonical = (path: string, doc: Document = document): void => {
    doc.querySelector('link[rel="canonical"]')?.setAttribute('href', `${SITE_ORIGIN}${path}`);
};
