# nba-central design system

The contract for anyone — person or agent — changing the UI.

## Direction

Clean and balanced. Good density with breathing room, and moderate orange
warmth throughout. The reference points are ESPN, NBA.com and The Athletic:
information-dense sports surfaces that stay readable. The orange is an accent
that marks what matters — a live score, a career high, the active tab — not a
background wash.

This started as the direction for one screen, in
`docs/superpowers/specs/2026-03-28-boxscore-ux-redesign.md`. It now applies
everywhere.

The app is dark-only. `main.ts` puts `.dark` on `<html>` and there is no toggle.
The mechanism is wired correctly (`@custom-variant dark (&:is(.dark *))`), so a
light theme would be an additive change: define the light values in `:root` and
move the dark ones into `.dark`.

## Tokens

Defined once in `src/assets/main.css`. Colours are **bare HSL channels**, so
they can take an alpha at the point of use.

```css
color: hsl(var(--primary));            /* solid            */
color: hsl(var(--primary) / 0.3);      /* with alpha       */
color: hsla(var(--primary), 0.3);      /* INVALID — dropped */
```

`@theme inline` derives Tailwind's utilities from those channels, so `bg-card`,
`text-muted-foreground` and `--card` are the same value. **Never restate a value
in `@theme inline`** — that is how the theme ended up defined three times over.

| Group | Tokens |
| --- | --- |
| Surface | `--background` `--card` `--popover` `--surface-raised` and their `-foreground` pairs |
| Brand | `--primary` (NBA orange, `35 100% 50%`) `--secondary` `--muted` `--accent` |
| Status | `--destructive` `--success` `--warning` |
| Conference | `--conference-east` `--conference-west` `--conference-cross` |
| Line | `--border` `--input` `--ring` |
| Shape | `--radius` and the derived `--radius-sm/md/lg/xl` |
| Layout | `--container-page` (90rem) `--container-narrow` (75rem) `--gutter` |
| Stacking | `--z-sticky` `--z-header` `--z-overlay` `--z-modal` `--z-popover` `--z-toast` |

`--surface-raised` is for menus and dropdowns that must read as fully opaque
above a dialog. Reach for it instead of inventing a near-black literal.

## Type

Inter, self-hosted via `@fontsource-variable/inter`. Body is `0.9375rem/1.6`.

| Role | Size | Weight | Notes |
| --- | --- | --- | --- |
| Display | 2.5rem | 800 | Scores, the number that is the point of the screen |
| Page title | 2rem | 700 | |
| Section | 1.5rem | 700 | |
| Card title | 1.125rem | 600 | |
| Body | 0.9375rem | 400 | |
| Small | 0.8125rem | 400 | Secondary detail |
| Label | 0.6875rem | 700 | Uppercase, `tracking-[0.06em]` |
| Micro | 0.55–0.7rem | 700 | Uppercase, `tracking-[0.08em]`, stat column headers |

Stat figures use `tabular-nums` so columns align. `table` gets it automatically.

The foreground opacity ladder carries hierarchy within a block:
`text-foreground` → `/80` → `/60` → `/50` → `/40`. Prefer it over inventing greys.

## Spacing and layout

Tailwind's default scale is the only rhythm — `p-4` not `p-[1rem]`. Arbitrary
spacing needs a reason in a comment.

Every route renders inside `PageShell` (`src/layouts/PageShell.vue`), which owns
max-width and gutters. Do not set a page max-width or horizontal padding in a
view; that is how the app ended up with five different widths.

```vue
<PageShell>...</PageShell>                    <!-- 90rem, default -->
<PageShell width="narrow">...</PageShell>     <!-- 75rem, reading views -->
<PageShell as="main" flush>...</PageShell>    <!-- be the <main>, no vertical padding -->
```

`SectionHeading` (`src/components/layout/SectionHeading.vue`) is the orange left
rule plus uppercase label. Use it rather than re-inlining a border.

## Components

`src/components/ui/` is vendored shadcn-vue over reka-ui primitives. Treat it as
a library: it is not Prettier-formatted with the rest of the app.

**Style the component, not the DOM.** Variants live in each module's `index.ts`
as CVA definitions — `buttonVariants`, `dialogVariants`, `sheetVariants`,
`toggleVariants`. Add a variant there; do not add a global rule.

Because `cn()` runs tailwind-merge, passing utilities through `class` correctly
overrides a component's defaults. `<ToggleGroup class="grid grid-cols-2">` beats
its built-in `flex gap-1`. A custom class name cannot be merged that way, which
is what previously forced `!important`.

Dialog width is a prop, not a class: `<DialogContent size="sm | default | wide">`.

`reka-ui` is imported only inside `src/components/ui/`. Keep it that way — views
should not reach past the wrapper layer.

## Rules

Enforced by `pnpm check:styles`, in CI and in the pre-commit hook. Every one of
these corresponds to a defect this app actually shipped.

1. **No Tailwind class ending in a bare rem value.** `px-1rem` and
   `text-1.125rem` compile to nothing. Use `px-4`, or bracket it: `px-[1.5rem]`.
   132 of these meant the box score rendered with no horizontal padding.
2. **No `hsla(var(--token), alpha)`.** Invalid, and the browser drops the whole
   declaration. 21 of these meant every orange hover border never rendered.
3. **No `!important`.** Scoped component styles are unlayered and already
   outrank Tailwind's utilities layer for normal declarations.
4. **No global styling by ARIA role or library attribute.** `[role="dialog"]`
   also matches reka's Popover. That one selector leaked modal sizing onto every
   popover and needed ~200 lines of CSS to claw back.
5. **No raw hex or `rgb()`** outside the token block. Use a token.
6. **`rem`, not `px`**, except media queries and the `9999px` pill idiom.
7. **No arbitrary z-index.** Use the scale. Overlays portal to `<body>`, so
   stacking is global and ordered.

A deliberate exception takes a trailing `/* style-guard-allow: <rule-id> */`
with a comment saying why.

## Verifying a change

```bash
pnpm type-check
pnpm check:styles
pnpm test
pnpm test:visual            # screenshot every route, both viewports
pnpm test:visual:update     # accept intended visual changes
pnpm start                  # then look at the page
```

Look at the result before calling a UI change done. Tokens fix colour and
`check:styles` catches CSS that does not exist, but neither can tell you whether
the spacing rhythm reads correctly. Only a screenshot can.

`pnpm test:visual` starts its own dev server on a dedicated port and never
reuses one already running. Another worktree's server was once picked up, and
the screenshots were wrong in a way nothing flagged.

Committed baselines are win32. `pnpm test:visual:ci` runs the same suite in the
official Playwright container for Linux baselines.
