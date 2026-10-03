import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// WCAG AA for the colour tokens, in both themes. The light palette was
// reviewed against these pairs on #125; this keeps a later token edit from
// quietly dropping one below the line.
const css = readFileSync(resolve(__dirname, '../src/assets/main.css'), 'utf8');

const tokensIn = (selector: string) => {
    const start = css.indexOf(`\n${selector} {`);
    const body = css.slice(start, css.indexOf('\n}', start));
    return Object.fromEntries(
        [...body.matchAll(/(--[\w-]+):\s*(\d[\d.]*) (\d[\d.]*)% (\d[\d.]*)%;/g)].map((m) => [
            m[1],
            [Number(m[2]), Number(m[3]), Number(m[4])] as const,
        ]),
    );
};

const light = tokensIn(':root');
const dark = { ...light, ...tokensIn('.dark') };

const luminance = ([h, s, l]: readonly [number, number, number]) => {
    const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
    const channel = (n: number) => {
        const k = (n + h / 30) % 12;
        const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(0) + 0.7152 * channel(8) + 0.0722 * channel(4);
};
const contrast = (a: readonly [number, number, number], b: readonly [number, number, number]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, minimum]: 4.5 for text, 3 for focus rings and
// the conference accent bars (non-text UI).
const PAIRS: [string, string, number][] = [
    ['--foreground', '--background', 4.5],
    ['--card-foreground', '--card', 4.5],
    ['--popover-foreground', '--popover', 4.5],
    ['--muted-foreground', '--background', 4.5],
    ['--muted-foreground', '--card', 4.5],
    ['--muted-foreground', '--muted', 4.5],
    ['--primary-strong', '--background', 4.5],
    ['--primary-strong', '--card', 4.5],
    ['--primary-foreground', '--primary', 4.5],
    ['--destructive-strong', '--background', 4.5],
    ['--destructive-strong', '--card', 4.5],
    ['--destructive-foreground', '--destructive', 4.5],
    ['--success', '--card', 4.5],
    ['--warning-foreground', '--warning', 4.5],
    ['--rating-elite', '--card', 4.5],
    ['--rating-great', '--card', 4.5],
    ['--rating-good', '--card', 4.5],
    ['--ring', '--background', 3],
    ['--conference-east', '--card', 3],
    ['--conference-west', '--card', 3],
    ['--conference-cross', '--card', 3],
];

describe.each([
    ['light', light],
    ['dark', dark],
])('%s theme tokens', (_, tokens) => {
    it('found the token blocks', () => {
        expect(Object.keys(tokens).length).toBeGreaterThan(20);
    });

    it.each(PAIRS)('%s on %s meets %s:1', (fg, bg, min) => {
        expect(tokens[fg], `${fg} is defined`).toBeDefined();
        expect(tokens[bg], `${bg} is defined`).toBeDefined();
        expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(min);
    });
});
