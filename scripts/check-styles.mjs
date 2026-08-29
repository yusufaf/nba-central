#!/usr/bin/env node
/**
 * Style guard for the design system.
 *
 * Each rule here corresponds to a real defect this codebase shipped, not a
 * stylistic preference. Run with `pnpm check:styles`.
 *
 *  1. Bare-rem Tailwind classes (`px-1rem`, `text-1.125rem`)
 *     Tailwind cannot generate these, so they emit no CSS at all. A px-to-rem
 *     sweep produced 132 of them across the box score, which is why that page
 *     rendered with no horizontal padding.
 *
 *  2. `hsla(var(--token), alpha)`
 *     Tokens hold space-separated HSL channels, so this mixes space syntax with
 *     a legacy comma alpha. The browser drops the whole declaration. 21 of these
 *     meant every orange hover border in the team builder never rendered.
 *
 *  3. `!important`
 *     main.css grew to 235 of them fighting the component layer. Style the
 *     component instead.
 *
 *  4. Global styling by ARIA role or library data attribute
 *     `[role="dialog"]` also matches reka's Popover, so modal sizing leaked
 *     onto popovers and needed ~200 lines to claw back.
 *
 *  5. Raw hex / rgb() colours outside the token block
 *     Use a token so a rebrand is one edit.
 *
 *  6. px units
 *     Project rule: rem, so type scales with the user's font size.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const TOKEN_FILE = 'src/assets/main.css';
const VENDOR_FILE = 'src/assets/vendor-overrides.css';

const files = globSync('src/**/*.{vue,css}', { cwd: ROOT })
    .map((f) => f.replaceAll('\\', '/'))
    .sort();

/** Rules that scan raw file text, line by line. */
const RULES = [
    {
        id: 'dead-tailwind-class',
        // A utility ending in a bare rem value. Bracketed values are fine.
        test: /(?<=class="(?:[^"]*[\s"])?)(?:[a-z]+-)+[0-9]*\.?[0-9]+rem(?=[\s"])/,
        message:
            'Tailwind cannot generate this class, so it emits no CSS. Use a scale step (px-4) or bracket the value (px-[1.5rem]).',
        appliesTo: (f) => f.endsWith('.vue'),
    },
    {
        id: 'invalid-hsla-token',
        test: /hsla\(\s*var\(--/,
        message:
            'Tokens are space-separated HSL channels; a comma alpha here is invalid and the declaration is dropped. Use hsl(var(--token) / 0.5).',
        appliesTo: () => true,
    },
    {
        id: 'important',
        test: /!important/,
        message:
            'Style the component (a CVA variant or its class prop) instead of overriding it globally.',
        appliesTo: (f) => f !== TOKEN_FILE,
    },
    {
        id: 'global-role-selector',
        // Not preceded by a class/id/tag: `.foo[data-state="on"]` is scoped by
        // .foo and fine, bare `[role="dialog"]` hits every element with it.
        test: /(?<![\w.#-])\[(?:role|data-state|data-reka|data-radix)[^\]]*\]\s*[,{]/,
        message:
            'Styling by ARIA role or library attribute hits every primitive that emits it. Put the style on the component.',
        appliesTo: (f) => f !== VENDOR_FILE,
    },
    {
        id: 'raw-colour',
        test: /(?::|\s)(?:#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))/,
        message: 'Use a design token rather than a literal colour.',
        appliesTo: (f) => f !== TOKEN_FILE && f !== VENDOR_FILE,
    },
    {
        id: 'px-unit',
        // Media queries are conventionally px, and 9999px is the pill idiom.
        test: /(?<![\w-])-?\d*\.?\d+px(?![\w-])/,
        skip: (line) => /@media|9999px|1px solid|hairline/.test(line),
        message: 'Project rule: use rem so sizing scales with the user font size.',
        appliesTo: () => true,
    },
];

/** Lines exempt from a given rule, by trailing comment. */
const ALLOW = /style-guard-allow(?::\s*([\w-]+))?/;

/**
 * Blank out comments so prose describing a bad pattern is not flagged as one,
 * replacing them with spaces so line and column numbers still line up.
 */
function stripComments(text) {
    return text
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
        // [^\S\n] not \s: \s matches newlines, which would collapse lines and
        // throw off every reported line number.
        .replace(/^[^\S\n]*\/\/[^\n]*$/gm, (m) => ' '.repeat(m.length));
}

const problems = [];

for (const file of files) {
    const raw = readFileSync(join(ROOT, file), 'utf8');
    const lines = stripComments(raw).split(/\r?\n/);
    const rawLines = raw.split(/\r?\n/);

    for (const [i, line] of lines.entries()) {
        const allow = line.match(ALLOW);
        for (const rule of RULES) {
            if (!rule.appliesTo(file)) continue;
            if (rule.skip?.(line)) continue;
            if (allow && (!allow[1] || allow[1] === rule.id)) continue;
            if (!rule.test.test(line)) continue;
            problems.push({
                file,
                line: i + 1,
                id: rule.id,
                message: rule.message,
                text: (rawLines[i] ?? line).trim().slice(0, 110),
            });
        }
    }
}

if (!problems.length) {
    console.log(`check-styles: ${files.length} files, no problems`);
    process.exit(0);
}

const byRule = new Map();
for (const p of problems) byRule.set(p.id, (byRule.get(p.id) ?? 0) + 1);

for (const p of problems) {
    console.log(`${p.file}:${p.line}  [${p.id}]`);
    console.log(`    ${p.text}`);
    console.log(`    ${p.message}`);
}
console.log(`\ncheck-styles: ${problems.length} problem(s)`);
for (const [id, n] of [...byRule].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${id}`);
}
console.log('\nAdd a trailing `/* style-guard-allow: <rule-id> */` to exempt a deliberate line.');
process.exit(1);
