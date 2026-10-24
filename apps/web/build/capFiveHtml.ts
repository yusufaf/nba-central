// /cap-five's link-preview tags, so a pasted link unfurls as Cap Five rather
// than as the home page. gamePageHtml.ts builds the page from them.

import { CAP_FIVE_POOL_SIZE } from "../src/constants/capFive.ts";
import { gamePageHtml, type GamePageHead } from "./gamePageHtml.ts";

export const CAP_FIVE_HEAD = {
    title: "Cap Five",
    description: `A new pool of ${CAP_FIVE_POOL_SIZE} NBA players every day. Pick five and stay under the cap. Ratings stay hidden until you lock in.`,
    // Rendered from CapFivePreviewCard.vue by `pnpm --filter web render:og`.
    // The same every day, so it never shows a puzzle.
    image: "https://nba.yusufaf.dev/og-image-cap-five.png",
    url: "https://nba.yusufaf.dev/cap-five",
    imageAlt: "Cap Five: five empty lineup slots, a cap meter, and a row of rating tiles",
} as const satisfies GamePageHead;

export const capFiveHtml = (shell: string): string => gamePageHtml(shell, CAP_FIVE_HEAD);
