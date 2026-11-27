import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createLogto, type LogtoConfig } from '@logto/vue';

/* Self-hosted Inter. base.css asked for Inter by name but nothing ever loaded
   it, so the app rendered in the system fallback on every machine. */
import '@fontsource-variable/inter';

/* Vendor stylesheets first, so our own rules win without needing !important. */
import 'vue-sonner/style.css';
import 'v-calendar/style.css';

import App from './App.vue';
import router from './router';
import { captureLandingSource } from './lib/attribution';
import { consumeDataDeletedFlag } from './composables/useAccountData';

import './assets/main.css';
import './assets/vendor-overrides.css';

// Before the router can redirect, so the true landing URL and referrer are read.
captureLandingSource();

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

// Signing out after a delete can only return to the site root, the one
// post-sign-out URL Logto is known to accept; this finishes the trip. Here,
// after app.use(router) has started the first navigation, rather than in
// App.vue, so Home never renders first: the replace cancels the navigation
// to /, and isReady() then waits for the replace.
if (consumeDataDeletedFlag()) void router.replace({ name: 'data-deleted' }).catch(() => {});

// The theme class is already on <html>: index.html sets it before the first
// paint, and applyDisplayPreferences (App.vue) keeps it in step from there.
// The first view is its own chunk, so mounting before it loads would paint
// the footer under the header and then shove it down. A failed first
// navigation still mounts, and one that hangs (a guard waiting on Logto with
// site data blocked, a stalled chunk) shows the layout after 3 s.
const firstRoute = router.isReady().catch(() => {});
const stalled = new Promise<void>((resolve) => setTimeout(resolve, 3000));
void Promise.race([firstRoute, stalled]).then(() => app.mount('#app'));
