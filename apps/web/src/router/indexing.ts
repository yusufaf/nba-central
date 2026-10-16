import { IS_PREVIEW } from '@/utils/preview';

export const SITE_ORIGIN = 'https://nba.yusufaf.dev';

const headTag = (doc: Document, tag: 'link' | 'meta', key: string, value: string): Element => {
    const existing = doc.head.querySelector(`${tag}[${key}="${value}"]`);
    if (existing) return existing;
    const created = doc.createElement(tag);
    created.setAttribute(key, value);
    return doc.head.appendChild(created);
};

// index.html ships one canonical and og:url, the home page, for every route:
// that's all a crawler that doesn't run JS sees. Crawlers that render the app
// get the route they're on instead. A public page (route meta `indexable`)
// points both at itself on the production origin; anything else (sign-in,
// settings, unmatched paths) drops them and asks not to be indexed.
// Concatenated, not resolved with new URL(path, origin): a path like
// //evil.example would resolve off-site.
export const syncIndexing = (
    path: string,
    indexable: boolean,
    doc: Document = document,
    preview: boolean = IS_PREVIEW,
): void => {
    if (!indexable || preview) {
        doc.head.querySelector('link[rel="canonical"]')?.remove();
        doc.head.querySelector('meta[property="og:url"]')?.remove();
        headTag(doc, 'meta', 'name', 'robots').setAttribute('content', 'noindex');
        return;
    }

    const url = `${SITE_ORIGIN}${path}`;
    doc.head.querySelector('meta[name="robots"]')?.remove();
    headTag(doc, 'link', 'rel', 'canonical').setAttribute('href', url);
    headTag(doc, 'meta', 'property', 'og:url').setAttribute('content', url);
};
