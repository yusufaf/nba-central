import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SITE_ORIGIN, syncIndexing } from '@/router/indexing';
import router from '@/router';

// Only the route table matters here. Home's stylesheet references a public/
// asset by URL, which the test transform can't resolve.
vi.mock('@/views/Home.vue', () => ({ default: {} }));

const shell = () => {
    const doc = document.implementation.createHTMLDocument();
    doc.head.innerHTML = `<link rel="canonical" href="${SITE_ORIGIN}/"><meta property="og:url" content="${SITE_ORIGIN}/">`;
    return doc;
};

const canonicalOf = (doc: Document) => doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
const ogUrlOf = (doc: Document) => doc.querySelector('meta[property="og:url"]')?.getAttribute('content');
const robotsOf = (doc: Document) => doc.querySelector('meta[name="robots"]')?.getAttribute('content');

describe('syncIndexing', () => {
    it('points the canonical and og:url of an indexable page at itself on the production origin', () => {
        const doc = shell();
        syncIndexing('/scores', true, doc);
        expect(canonicalOf(doc)).toBe('https://nba.yusufaf.dev/scores');
        expect(ogUrlOf(doc)).toBe('https://nba.yusufaf.dev/scores');
        expect(robotsOf(doc)).toBeUndefined();
    });

    it('keeps the home page at the bare origin', () => {
        const doc = shell();
        syncIndexing('/scores', true, doc);
        syncIndexing('/', true, doc);
        expect(canonicalOf(doc)).toBe('https://nba.yusufaf.dev/');
        expect(ogUrlOf(doc)).toBe('https://nba.yusufaf.dev/');
    });

    it('drops the canonical and og:url of any other page and marks it noindex', () => {
        const doc = shell();
        syncIndexing('/callback', false, doc);
        expect(canonicalOf(doc)).toBeUndefined();
        expect(ogUrlOf(doc)).toBeUndefined();
        expect(robotsOf(doc)).toBe('noindex');
        expect(doc.querySelectorAll('meta[name="robots"]')).toHaveLength(1);
    });

    it('restores the tags and lifts noindex when navigating back to an indexable page', () => {
        const doc = shell();
        syncIndexing('/login', false, doc);
        syncIndexing('/news', true, doc);
        expect(canonicalOf(doc)).toBe('https://nba.yusufaf.dev/news');
        expect(ogUrlOf(doc)).toBe('https://nba.yusufaf.dev/news');
        expect(robotsOf(doc)).toBeUndefined();
        expect(doc.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    });

    it('keeps a protocol-relative-looking path on the site origin', () => {
        const doc = shell();
        syncIndexing('//evil.example/', true, doc);
        expect(canonicalOf(doc)).toBe('https://nba.yusufaf.dev//evil.example/');
    });

    it('starts from the same origin index.html ships', () => {
        const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
        expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/">`);
        expect(html).toContain(`<meta property="og:url" content="${SITE_ORIGIN}/">`);
    });
});

describe('indexable routes', () => {
    const sitemapPaths = [
        ...readFileSync(resolve(__dirname, '../../public/sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g),
    ].map(([, loc]) => new URL(loc).pathname);

    it('are exactly the sitemap pages plus published teams', () => {
        const indexable = router
            .getRoutes()
            .filter((route) => route.meta.indexable === true)
            .map((route) => route.path)
            .sort();
        expect(indexable).toEqual([...sitemapPaths, '/t/:teamUUID'].sort());
    });

    it("leave a first-loaded team page's server-written tags alone, then sync later navigations", async () => {
        document.head.innerHTML = '<meta name="robots" content="noindex">';
        await router.push('/t/unknown-team');
        expect(robotsOf(document)).toBe('noindex');
        expect(canonicalOf(document)).toBeUndefined();

        await router.push('/scores');
        expect(robotsOf(document)).toBeUndefined();
        expect(canonicalOf(document)).toBe('https://nba.yusufaf.dev/scores');
    });

    it('leave sign-in, account, and unmatched paths out', () => {
        for (const path of ['/login', '/sign-up', '/callback', '/settings', '/data-deleted', '/teams', '/game/1', '/no-such-page']) {
            expect(router.resolve(path).meta.indexable, path).not.toBe(true);
        }
    });
});

describe('unmatched paths', () => {
    it('render the not-found view at the URL that was asked for', () => {
        for (const path of ['/no-such-page', '/a/b/c', '/t', '/t/abc/extra', '/game']) {
            const resolved = router.resolve(path);
            expect(resolved.name, path).toBe('not-found');
            expect(resolved.fullPath, path).toBe(path);
        }
    });

    it('leave every defined route to its own view', () => {
        for (const path of ['/', '/scores', '/t/abc', '/game/1', '/settings', '/data-deleted']) {
            expect(router.resolve(path).name, path).not.toBe('not-found');
        }
    });

    it('are marked noindex after an in-app navigation', async () => {
        document.head.innerHTML = `<link rel="canonical" href="${SITE_ORIGIN}/">`;
        await router.push('/scores');
        await router.push('/no-such-page');
        expect(router.currentRoute.value.name).toBe('not-found');
        expect(robotsOf(document)).toBe('noindex');
        expect(canonicalOf(document)).toBeUndefined();
    });
});
