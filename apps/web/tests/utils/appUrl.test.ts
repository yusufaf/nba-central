import { describe, it, expect } from 'vitest';
import { appUrl } from '@/utils/appUrl';

const PROD = { origin: 'https://nba.yusufaf.dev', base: '/', hash: false };
const PREVIEW = {
    origin: 'https://yusufaf.dev',
    base: '/nba-central/pr-preview/pr-7/',
    hash: true,
};

describe('appUrl', () => {
    it('builds a production route URL', () => {
        expect(appUrl('/t/abc', PROD)).toBe('https://nba.yusufaf.dev/t/abc');
    });

    it('builds the production root', () => {
        expect(appUrl('/', PROD)).toBe('https://nba.yusufaf.dev/');
    });

    it('puts the route after the base and a hash in a preview', () => {
        expect(appUrl('/t/abc', PREVIEW)).toBe(
            'https://yusufaf.dev/nba-central/pr-preview/pr-7/#/t/abc',
        );
    });

    it('builds the preview root', () => {
        expect(appUrl('/', PREVIEW)).toBe('https://yusufaf.dev/nba-central/pr-preview/pr-7/#/');
    });

    it('keeps the base in history mode under a subpath', () => {
        expect(appUrl('/scores', { ...PROD, base: '/sub/' })).toBe(
            'https://nba.yusufaf.dev/sub/scores',
        );
    });

    it('accepts a route without a leading slash', () => {
        expect(appUrl('t/abc', PROD)).toBe('https://nba.yusufaf.dev/t/abc');
        expect(appUrl('t/abc', PREVIEW)).toBe(
            'https://yusufaf.dev/nba-central/pr-preview/pr-7/#/t/abc',
        );
    });

    it('accepts a base without a trailing slash', () => {
        expect(appUrl('/t/abc', { ...PREVIEW, base: '/nba-central/pr-preview/pr-7' })).toBe(
            'https://yusufaf.dev/nba-central/pr-preview/pr-7/#/t/abc',
        );
    });

    it('never produces a protocol-relative path from a route starting with //', () => {
        expect(appUrl('//evil.example/x', PROD)).toBe('https://nba.yusufaf.dev/evil.example/x');
    });
});
