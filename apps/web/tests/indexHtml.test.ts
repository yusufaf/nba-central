import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PREFERENCE_SECTIONS } from '@/constants/preferences';

// The inline script in index.html sets the theme before the stylesheet and
// the app load, so the first paint is already the right theme. It can't
// import anything, so this runs the shipped script itself against stand-ins
// for localStorage and matchMedia.
const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const head = html.slice(0, html.indexOf('</head>'));
const inlineScript = /<script>([\s\S]*?)<\/script>/.exec(head)?.[1] ?? '';

const STORAGE_KEY = PREFERENCE_SECTIONS.display.storageKey;

type Storage = { getItem: (key: string) => string | null };

const firstPaint = ({ stored, osDark, storage }: { stored?: unknown; osDark: boolean; storage?: Storage }) => {
    const root = document.createElement('html');
    const localStorage: Storage = storage ?? {
        getItem: (key) =>
            key === STORAGE_KEY && stored !== undefined
                ? typeof stored === 'string' ? stored : JSON.stringify(stored)
                : null,
    };
    const matchMedia = (media: string) => ({ matches: media === '(prefers-color-scheme: dark)' && osDark });
    new Function('document', 'localStorage', 'matchMedia', inlineScript)(
        { documentElement: root },
        localStorage,
        matchMedia,
    );
    return root.classList.contains('dark') ? 'dark' : 'light';
};

describe('index.html first-paint theme', () => {
    it('runs in <head>, before the app is loaded', () => {
        expect(inlineScript).toContain(STORAGE_KEY);
        expect(html.indexOf(inlineScript)).toBeLessThan(html.indexOf('src="/src/main.ts"'));
    });

    it('follows the OS with nothing stored, as System does', () => {
        expect(firstPaint({ osDark: true })).toBe('dark');
        expect(firstPaint({ osDark: false })).toBe('light');
    });

    it('follows the OS for a stored "system"', () => {
        expect(firstPaint({ stored: { theme: 'system' }, osDark: true })).toBe('dark');
        expect(firstPaint({ stored: { theme: 'system' }, osDark: false })).toBe('light');
    });

    it('uses a stored "light" or "dark" over the OS', () => {
        expect(firstPaint({ stored: { theme: 'light', fontScale: '125' }, osDark: true })).toBe('light');
        expect(firstPaint({ stored: { theme: 'dark' }, osDark: false })).toBe('dark');
    });

    it('falls back to the OS for anything it cannot read', () => {
        for (const stored of ['not json', 'null', '"light"', { theme: 'sepia' }, { theme: 1 }, {}]) {
            expect(firstPaint({ stored, osDark: true })).toBe('dark');
            expect(firstPaint({ stored, osDark: false })).toBe('light');
        }
    });

    it('falls back to the OS when storage is blocked', () => {
        const storage = {
            getItem: () => {
                throw new DOMException('denied', 'SecurityError');
            },
        };
        expect(firstPaint({ storage, osDark: true })).toBe('dark');
        expect(firstPaint({ storage, osDark: false })).toBe('light');
    });
});
