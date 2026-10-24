// A daily game's own copy of the SPA shell, so a pasted link unfurls as the
// game rather than as the home page. Built from the deployed index.html (see
// vite.config.ts), and served for the game's path by a CloudFront Function in
// apps/cdk's team-builder-web.ts. Crawlers don't run the app, so these tags
// are all they see.

export interface GamePageHead {
    readonly title: string;
    readonly description: string;
    readonly image: string;
    readonly imageAlt: string;
    readonly url: string;
}

// The shell's site-wide defaults, as apps/cdk/utilities/og-html.ts strips
// them for /t/*. og:site_name stays, and so does a preview build's robots
// tag: GitHub Pages serves these pages as files, and they must stay noindex.
const SHELL_DEFAULT_TAGS =
    /<(?:meta\s+(?:property="og:(?!site_name")[^"]*"|name="(?:twitter:[^"]*|description)")|link\s+rel="canonical")[^>]*>\s*/g;

export const gamePageHtml = (shell: string, head: GamePageHead): string => {
    if (!/<meta\s+property="og:title"/.test(shell) || !shell.includes("</head>")) {
        // A changed index.html must fail the build, not ship two sets of tags.
        throw new Error(`gamePageHtml(${head.url}): the shell has no og:title or </head> to rewrite`);
    }
    const { title, description, image, imageAlt, url } = head;
    // The <title> stays the shell's: the app never sets one per route, so a
    // game's title would stick in the tab after leaving the game. A link with
    // a query string (/daily?date=...) gets this page too: the canonical folds
    // it into the game's path for crawlers that don't run the app, but
    // there's no og:url, unlike og-html.ts's /t/* pages, because some
    // unfurlers would send the link to it instead.
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
