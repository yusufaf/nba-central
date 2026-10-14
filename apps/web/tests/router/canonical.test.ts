import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SITE_ORIGIN, syncCanonical } from '@/router/canonical';

const shell = () => {
    const doc = document.implementation.createHTMLDocument();
    doc.head.innerHTML = `<link rel="canonical" href="${SITE_ORIGIN}/">`;
    return doc;
};

const canonicalOf = (doc: Document) => doc.querySelector('link[rel="canonical"]')?.getAttribute('href');

describe('syncCanonical', () => {
    it('points the canonical at the current route on the production origin', () => {
        const doc = shell();
        syncCanonical('/scores', doc);
        expect(canonicalOf(doc)).toBe('https://nba.yusufaf.dev/scores');
    });

    it('keeps the home page at the bare origin', () => {
        const doc = shell();
        syncCanonical('/scores', doc);
        syncCanonical('/', doc);
        expect(canonicalOf(doc)).toBe('https://nba.yusufaf.dev/');
    });

    it('does nothing when the page has no canonical', () => {
        const doc = document.implementation.createHTMLDocument();
        syncCanonical('/scores', doc);
        expect(doc.querySelector('link[rel="canonical"]')).toBeNull();
    });

    it('starts from the same origin index.html ships', () => {
        const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
        expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/">`);
    });
});
