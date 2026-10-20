// /daily's own copy of the SPA shell, so a pasted link unfurls as Which Era?
// rather than as the home page. Built from the deployed index.html (see
// vite.config.ts), and served for /daily by a CloudFront Function in
// apps/cdk's team-builder-web.ts. Crawlers don't run the app, so these tags
// are all they see.

import { DAILY_ERA_MAX_ATTEMPTS } from "../src/constants/dailyEra.ts";

export const DAILY_ERA_HEAD = {
    title: "Which Era?",
    description: `A new NBA jersey every day. Guess the season it was worn in ${DAILY_ERA_MAX_ATTEMPTS} tries.`,
    // The site's own preview image until the game has one.
    image: "https://nba.yusufaf.dev/og-image.jpg",
    imageAlt: "nba-central home page: Build the GOAT team",
} as const;

// The shell's site-wide defaults, as apps/cdk/utilities/og-html.ts strips
// them for /t/*, plus a preview build's robots tag. og:site_name stays.
const SHELL_DEFAULT_TAGS =
    /<(?:meta\s+(?:property="og:(?!site_name")[^"]*"|name="(?:twitter:[^"]*|description|robots)")|link\s+rel="canonical")[^>]*>\s*/g;

export const dailyEraHtml = (shell: string): string => {
    if (!/<meta\s+property="og:title"/.test(shell) || !shell.includes("</head>")) {
        // A changed index.html must fail the build, not ship two sets of tags.
        throw new Error("dailyEraHtml: the shell has no og:title or </head> to rewrite");
    }
    const { title, description, image, imageAlt } = DAILY_ERA_HEAD;
    // The <title> stays the shell's: the app never sets one per route, so a
    // Which Era? title would stick in the tab after leaving the game. No
    // og:url either, unlike og-html.ts's /t/* pages: an archive link
    // (/daily?date=...) gets this page too, and some unfurlers would send it
    // to the og:url instead.
    const tags = [
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
        // Until launch (#172): drop this, and add the route's `indexable` and
        // a sitemap entry, together.
        `<meta name="robots" content="noindex">`,
    ];
    return shell
        .replace(SHELL_DEFAULT_TAGS, "")
        .replace(/\s*<\/head>/, () => `\n    ${tags.join("\n    ")}\n  </head>`);
};
