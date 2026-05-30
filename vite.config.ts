import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

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
    plugins: [vue(), tailwindcss()],
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
