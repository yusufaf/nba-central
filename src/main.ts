import { createApp } from "vue";
import { createPinia } from "pinia";
import { Quasar, Notify } from "quasar";

/* Import icon libraries */
import "@quasar/extras/roboto-font/roboto-font.css";
import "@quasar/extras/material-icons/material-icons.css";
import '@quasar/extras/fontawesome-v6/fontawesome-v6.css'

/* Import Quasar css */
import "quasar/dist/quasar.css";

import App from "./App.vue";
import router from "./router";

import "./assets/main.css";

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(Quasar, {
  plugins: {
    Notify,
  }, 
  config: {
    brand: {
      primary: '#e08210',
      secondary: '#ab8c79',
      accent: '#f78a05',

      dark: '#1d1d1d',
      'dark-page': '#121212',

      positive: '#21BA45',
      negative: '#C10015',
      info: '#1084e0',
      warning: '#F2C037'
    }
  }
});

app.mount("#app");
