import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import { quasar, transformAssetUrls } from "@quasar/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: `src/network/api.ts`,
      name: "nba-api-client"
    },
    rollupOptions: {
      external: ['nba-api-client'],
      output: {
        globals: {
          'nba-api-client': `NBA`
        }
      }
    }
  },
  plugins: [
    vue({
      template: { transformAssetUrls },
    }),
    vueJsx(),
    quasar(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
