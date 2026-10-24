// /daily's link-preview tags, so a pasted link unfurls as Which Era? rather
// than as the home page. gamePageHtml.ts builds the page from them.

import { DAILY_ERA_MAX_ATTEMPTS } from "../src/constants/dailyEra.ts";
import { gamePageHtml, type GamePageHead } from "./gamePageHtml.ts";

export const DAILY_ERA_HEAD = {
    title: "Which Era?",
    description: `A new NBA jersey every day. Guess the season it was worn in ${DAILY_ERA_MAX_ATTEMPTS} tries.`,
    // Rendered from DailyEraPreviewCard.vue by `pnpm --filter web render:og`.
    // The same every day, so it never shows a puzzle.
    image: "https://nba.yusufaf.dev/og-image-daily.png",
    url: "https://nba.yusufaf.dev/daily",
    imageAlt: "Which Era?: a jersey outline with a question mark, and a row of guess tiles",
} as const satisfies GamePageHead;

export const dailyEraHtml = (shell: string): string => gamePageHtml(shell, DAILY_ERA_HEAD);
