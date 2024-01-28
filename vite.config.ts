import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { quasar, transformAssetUrls } from "@quasar/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
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
    plugins: [
        vue({
            template: { transformAssetUrls },
        }),
        quasar(),
    ],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    server: {
        proxy: {
            "/api": {
                /* Doesn't work with localhost instead of actual address */
                target: "http://127.0.0.1:8000/",
                changeOrigin: true,
                secure: false,
                ws: true,
            },
        },
        port: 3000,
    },
});
