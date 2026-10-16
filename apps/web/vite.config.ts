import { fileURLToPath, URL } from "node:url";

import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

const isPreview = process.env.VITE_PREVIEW === "1";

// PR previews (.github/workflows/preview.yml) are throwaway copies on GitHub
// Pages: keep them out of search results and out of the production analytics.
// Only the built HTML changes; the committed index.html stays as production
// serves it, which getPublicTeamPage's tag stripping depends on.
const previewHtml = (): Plugin => ({
    name: "preview-html",
    apply: "build",
    transformIndexHtml(html) {
        return html
            .replace(/\s*<!-- Umami[^>]*-->\s*<script[^>]*analytics\.yusufaf\.dev[^>]*><\/script>/, "")
            .replace("</head>", '    <meta name="robots" content="noindex">\n  </head>');
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
    plugins: [vue(), tailwindcss(), ...(isPreview ? [previewHtml()] : [])],
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
