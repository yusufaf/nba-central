import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DAILY_ERA_HEAD, dailyEraHtml } from '../build/dailyEraHtml';
import { DAILY_ERA_MAX_ATTEMPTS } from '@/constants/dailyEra';

// Built from the real index.html, as the build plugin does.
const shell = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const page = dailyEraHtml(shell);
const head = page.slice(0, page.indexOf('</head>'));

const count = (html: string, pattern: RegExp) => html.match(new RegExp(pattern, 'g'))?.length ?? 0;

describe('dailyEraHtml', () => {
    it("swaps the home page's share tags for Which Era's", () => {
        for (const tag of ['og:title', 'og:description', 'og:image', 'og:type']) {
            expect(count(head, new RegExp(`property="${tag}"`))).toBe(1);
        }
        for (const tag of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'description']) {
            expect(count(head, new RegExp(`name="${tag}"`))).toBe(1);
        }
        expect(head).toContain(`<meta property="og:title" content="${DAILY_ERA_HEAD.title}">`);
        // No og:url: an archive link (/daily?date=...) gets this page too, and
        // some unfurlers would send it to the og:url instead.
        expect(head).not.toContain('property="og:url"');
        expect(head).toContain(`in ${DAILY_ERA_MAX_ATTEMPTS} tries`);
        expect(head).toContain('<meta property="og:site_name" content="nba-central">');
        for (const tag of ['og:title', 'og:description']) {
            const home = new RegExp(`<meta property="${tag}" content="([^"]*)"`).exec(shell)![1];
            expect(head).not.toContain(`content="${home}"`);
        }
    });

    it('never ships a head tag twice, whatever index.html adds', () => {
        const keys = [...head.matchAll(/<meta\s+(?:property|name)="([^"]+)"/g)].map((m) => m[1]);
        expect(keys.filter((key, i) => keys.indexOf(key) !== i)).toEqual([]);
        // A new site-wide default is stripped, not shipped next to nothing.
        const added = shell.replace('</head>', '<meta property="og:locale" content="en_US">\n</head>');
        expect(count(dailyEraHtml(added), /property="og:locale"/)).toBe(0);
    });

    it("previews with its own 1200x630 image, not the home page's", () => {
        const homeImage = /<meta property="og:image" content="([^"]*)"/.exec(shell)![1];
        const homeAlt = /<meta property="og:image:alt" content="([^"]*)"/.exec(shell)![1];
        expect(DAILY_ERA_HEAD.image).not.toBe(homeImage);
        expect(DAILY_ERA_HEAD.imageAlt).not.toBe(homeAlt);
        expect(DAILY_ERA_HEAD.imageAlt).toContain('Which Era?');

        // Crawlers need an absolute URL, and the file has to ship from public/.
        const url = new URL(DAILY_ERA_HEAD.image);
        expect(url.origin).toBe('https://nba.yusufaf.dev');
        const png = readFileSync(resolve(__dirname, '../public', url.pathname.slice(1)));
        expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        // IHDR width and height, which the head promises as og:image:width/height.
        expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);

        expect(head).toContain(`<meta property="og:image" content="${DAILY_ERA_HEAD.image}">`);
        expect(head).toContain(`<meta name="twitter:image" content="${DAILY_ERA_HEAD.image}">`);
        expect(head).toContain(`<meta property="og:image:alt" content="${DAILY_ERA_HEAD.imageAlt}">`);
    });

    it('stays noindex, with no canonical, until launch', () => {
        expect(head).not.toContain('rel="canonical"');
        expect(count(head, /name="robots"/)).toBe(1);
        expect(head).toContain('<meta name="robots" content="noindex">');
        // A preview build's shell already carries one.
        const preview = shell.replace('</head>', '<meta name="robots" content="noindex">\n</head>');
        expect(count(dailyEraHtml(preview), /name="robots"/)).toBe(1);
    });

    it('keeps the rest of the shell as it is', () => {
        expect(page).toContain(/<title>[^<]*<\/title>/.exec(shell)![0]);
        expect(page).toContain("localStorage.getItem('nba-display-preferences')");
        expect(page).toContain('analytics.yusufaf.dev/s.js');
        expect(page).toContain(/<script type="module"[^>]*>/.exec(shell)![0]);
        expect(page.slice(page.indexOf('</head>'))).toBe(shell.slice(shell.indexOf('</head>')));
    });

    it('fails on a shell it cannot rewrite', () => {
        expect(() => dailyEraHtml('<html><head><title>x</title></head></html>')).toThrow();
        expect(() => dailyEraHtml(shell.replace('</head>', ''))).toThrow();
    });
});
