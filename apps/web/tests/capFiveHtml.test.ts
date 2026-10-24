import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CAP_FIVE_HEAD, capFiveHtml } from '../build/capFiveHtml';
import { DAILY_ERA_HEAD } from '../build/dailyEraHtml';
import { CAP_FIVE_POOL_SIZE } from '@/constants/capFive';

// Built from the real index.html, as the build plugin does.
const shell = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const page = capFiveHtml(shell);
const head = page.slice(0, page.indexOf('</head>'));

const count = (html: string, pattern: RegExp) => html.match(new RegExp(pattern, 'g'))?.length ?? 0;

describe('capFiveHtml', () => {
    it("swaps the home page's share tags for Cap Five's", () => {
        for (const tag of ['og:title', 'og:description', 'og:image', 'og:type']) {
            expect(count(head, new RegExp(`property="${tag}"`))).toBe(1);
        }
        for (const tag of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'description']) {
            expect(count(head, new RegExp(`name="${tag}"`))).toBe(1);
        }
        expect(head).toContain('<meta property="og:title" content="Cap Five">');
        // No og:url: a link with a query string gets this page too, and some
        // unfurlers would send it to the og:url instead.
        expect(head).not.toContain('property="og:url"');
        expect(head).toContain(`${CAP_FIVE_POOL_SIZE} NBA players`);
        expect(head).toContain('<meta property="og:site_name" content="nba-central">');
        for (const tag of ['og:title', 'og:description']) {
            const home = new RegExp(`<meta property="${tag}" content="([^"]*)"`).exec(shell)![1];
            expect(head).not.toContain(`content="${home}"`);
        }
    });

    it('never ships a head tag twice', () => {
        const keys = [...head.matchAll(/<meta\s+(?:property|name)="([^"]+)"/g)].map((m) => m[1]);
        expect(keys.filter((key, i) => keys.indexOf(key) !== i)).toEqual([]);
    });

    it("previews with its own 1200x630 image, not the home page's or /daily's", () => {
        const homeImage = /<meta property="og:image" content="([^"]*)"/.exec(shell)![1];
        expect(CAP_FIVE_HEAD.image).not.toBe(homeImage);
        expect(CAP_FIVE_HEAD.image).not.toBe(DAILY_ERA_HEAD.image);
        expect(CAP_FIVE_HEAD.imageAlt).toContain('Cap Five');

        // Crawlers need an absolute URL, and the file has to ship from public/.
        const url = new URL(CAP_FIVE_HEAD.image);
        expect(url.origin).toBe('https://nba.yusufaf.dev');
        const png = readFileSync(resolve(__dirname, '../public', url.pathname.slice(1)));
        expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
        expect(png.equals(readFileSync(resolve(__dirname, '../public/og-image-daily.png')))).toBe(false);

        expect(head).toContain(`<meta property="og:image" content="${CAP_FIVE_HEAD.image}">`);
        expect(head).toContain(`<meta name="twitter:image" content="${CAP_FIVE_HEAD.image}">`);
        expect(head).toContain(`<meta property="og:image:alt" content="${CAP_FIVE_HEAD.imageAlt}">`);
    });

    it('is indexable, with /cap-five as the canonical, and keeps a preview build noindex', () => {
        expect(count(head, /rel="canonical"/)).toBe(1);
        expect(head).toContain('<link rel="canonical" href="https://nba.yusufaf.dev/cap-five">');
        expect(head).not.toContain('name="robots"');
        const preview = shell.replace('</head>', '<meta name="robots" content="noindex">\n</head>');
        const previewHead = capFiveHtml(preview);
        expect(count(previewHead, /name="robots"/)).toBe(1);
        expect(previewHead).toContain('<meta name="robots" content="noindex">');
    });

    it('keeps the rest of the shell as it is', () => {
        expect(page).toContain(/<title>[^<]*<\/title>/.exec(shell)![0]);
        expect(page.slice(page.indexOf('</head>'))).toBe(shell.slice(shell.indexOf('</head>')));
    });
});
