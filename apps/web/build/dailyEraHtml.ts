// /daily's own copy of the SPA shell, so a pasted link unfurls as Which Era?
// rather than as the home page. Built from the deployed index.html (see
// vite.config.ts), and served for /daily by a CloudFront Function in
// apps/cdk's team-builder-web.ts. Crawlers don't run the app, so these tags
// are all they see.

import { DAILY_ERA_MAX_ATTEMPTS } from "../src/constants/dailyEra.ts";

export const DAILY_ERA_HEAD = {
    title: "Which Era?",
    description: `A new NBA jersey every day. Guess the season it was worn in ${DAILY_ERA_MAX_ATTEMPTS} tries.`,
    // Rendered from DailyEraPreviewCard.vue by `pnpm --filter web render:og`.
    // The same every day, so it never shows a puzzle.
    image: "https://nba.yusufaf.dev/og-image-daily.png",
    url: "https://nba.yusufaf.dev/daily",
    imageAlt: "Which Era?: a jersey outline with a question mark, and a row of guess tiles",
} as const;

// The shell's site-wide defaults, as apps/cdk/utilities/og-html.ts strips
// them for /t/*. og:site_name stays, and so does a preview build's robots
// tag: GitHub Pages serves daily.html as a file, and it must stay noindex.
const SHELL_DEFAULT_TAGS =
    /<(?:meta\s+(?:property="og:(?!site_name")[^"]*"|name="(?:twitter:[^"]*|description)")|link\s+rel="canonical")[^>]*>\s*/g;

export const dailyEraHtml = (shell: string): string => {
    if (!/<meta\s+property="og:title"/.test(shell) || !shell.includes("</head>")) {
        // A changed index.html must fail the build, not ship two sets of tags.
        throw new Error("dailyEraHtml: the shell has no og:title or </head> to rewrite");
    }
    const { title, description, image, imageAlt, url } = DAILY_ERA_HEAD;
    // The <title> stays the shell's: the app never sets one per route, so a
    // Which Era? title would stick in the tab after leaving the game. An
    // archive link (/daily?date=...) gets this page too: the canonical folds
    // every archive day into /daily for crawlers that don't run the app, but
    // there's no og:url, unlike og-html.ts's /t/* pages, because some
    // unfurlers would send the archive link to it instead.
    const tags = [
        `<link rel="canonical" href="${url}">`,
        `<meta name="description" content="${description}">`,
        `<meta property="og:type" content="website">`,
        `<meta property="og:title" content="${title}">`,
        `<meta property="og:description" content="${description}">`,
        `<meta property="og:image" content="${image}">`,
        `<meta property="og:image:width" content="1200">`,
        `<meta property="og:image:height" content="630">`,
        `<meta property="og:image:alt" content="${imageAlt}">`,
        `<meta name="twitter:card" content="summary_large_image">`,
        `<meta name="twitter:title" content="${title}">`,
        `<meta name="twitter:description" content="${description}">`,
        `<meta name="twitter:image" content="${image}">`,
    ];
    return shell
        .replace(SHELL_DEFAULT_TAGS, "")
        .replace(/\s*<\/head>/, () => `\n    ${tags.join("\n    ")}\n  </head>`);
};
