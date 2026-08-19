import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createLogto, type LogtoConfig } from '@logto/vue';

/* Import vue-sonner styles */
import 'vue-sonner/style.css';

import App from './App.vue';
import router from './router';

import './assets/main.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);

const logtoConfig: LogtoConfig = {
    endpoint: import.meta.env.VITE_LOGTO_ENDPOINT,
    appId: import.meta.env.VITE_LOGTO_APP_ID,
    // Requesting the API resource here means every access token issued to
    // this app carries an `aud` scoped to NBA Central's API — never a token
    // usable against another project's API (see apiAuthorizer.ts).
    resources: [import.meta.env.VITE_LOGTO_API_RESOURCE],
};

app.use(createLogto, logtoConfig);

// Add dark mode class to html element
document.documentElement.classList.add('dark');

app.mount('#app');
