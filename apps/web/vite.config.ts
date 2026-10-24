import { fileURLToPath, URL } from "node:url";

import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { capFiveHtml } from "./build/capFiveHtml.ts";
import { dailyEraHtml } from "./build/dailyEraHtml.ts";

const isPreview = process.env.VITE_PREVIEW === "1";

// PR previews (.github/workflows/preview.yml) are throwaway copies on GitHub
// Pages: keep them out of search results and out of the production analytics.
// Only the built HTML changes; the committed index.html stays as production
// serves it, which getPublicTeamPage's tag stripping depends on.
const previewHtml = (): Plugin => ({
    name: "preview-html",
    apply: "build",
    transformIndexHtml(html) {
        // Fail the build rather than ship a preview that counts as production traffic.
        const withoutUmami = html.replace(/<script[^>]*analytics\.yusufaf\.dev[^>]*><\/script>/, "");
        if (withoutUmami.includes("analytics.yusufaf.dev/")) {
            throw new Error("preview-html: couldn't remove the Umami script from index.html");
        }
        return withoutUmami.replace("</head>", '    <meta name="robots" content="noindex">\n  </head>');
    },
});

// Each daily game's copy of the shell, with its own link-preview tags.
const GAME_PAGES: Record<string, (shell: string) => string> = {
    "daily.html": dailyEraHtml,
    "cap-five.html": capFiveHtml,
};

// Writes GAME_PAGES into dist/. enforce: "post" runs it after Vite has
// emitted the final index.html, so they can't drift: same hashed assets,
// same theme script, same preview noindex.
const gamePages = (): Plugin => ({
    name: "game-pages",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
        const shell = bundle["index.html"];
        if (shell?.type !== "asset") this.error("game-pages: no index.html in the bundle");
        const html = typeof shell.source === "string" ? shell.source : new TextDecoder().decode(shell.source);
        for (const [fileName, build] of Object.entries(GAME_PAGES)) {
            this.emitFile({ type: "asset", fileName, source: build(html) });
        }
    },
});

// https://vitejs.dev/config/
export default defineConfig({
    base: process.env.VITE_BASE ?? "/",
    build: {
        // lib: {
        //   entry: `src/network/api.ts`,
        //   name: "nba-api-client"
        // },
        // rollupOptions: {
        //   external: ['nba-api-client'],
        //   output: {
        //     globals: {
        //       'nba-api-client': `NBA`
        //     }
        //   }
        // }
    },
    plugins: [vue(), tailwindcss(), ...(isPreview ? [previewHtml()] : []), gamePages()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    server: {
        proxy: {
            "/api": {
                target:
                    process.env.VITE_API_BASE_URL ||
                    "https://sdqs628gwf.execute-api.us-west-2.amazonaws.com",
                changeOrigin: true,
                secure: true,
            },
        },
        port: 3000,
    },
});
