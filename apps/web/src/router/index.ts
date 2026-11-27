import { createRouter, createWebHashHistory, createWebHistory, START_LOCATION } from 'vue-router';
import Home from '@/views/Home.vue';
import { useLogto } from '@logto/vue';
import { requireSignedIn } from './guards';
import { syncIndexing } from './indexing';
import { reloadOnStaleChunk } from './staleChunk';
import { IS_PREVIEW } from '@/utils/preview';

const router = createRouter({
    // GitHub Pages has no SPA fallback for a preview's subfolder, so a reload
    // of /teambuilder would 404 there; hash URLs never leave index.html.
    history: IS_PREVIEW
        ? createWebHashHistory(import.meta.env.BASE_URL)
        : createWebHistory(import.meta.env.BASE_URL),
    routes: [
        // Every view but this one is its own chunk, fetched on its route's
        // first visit. Home is the most common landing page and under 1 KB
        // gzipped, so it skips that round trip. check:bundle budgets what
        // loads with the page.
        {
            path: '/',
            name: 'home',
            meta: { indexable: true },
            component: Home,
        },
        {
            path: '/teambuilder',
            name: 'teamBuilder',
            meta: { indexable: true },
            component: () => import('@/views/TeamBuilder.vue'),
        },
        {
            path: '/scores',
            name: 'scores',
            meta: { indexable: true },
            component: () => import('@/views/Scores.vue'),
        },
        {
            path: '/standings',
            name: 'standings',
            meta: { indexable: true },
            component: () => import('@/views/Standings.vue'),
        },
        {
            path: '/game/:gameId',
            name: 'boxScore',
            component: () => import('@/views/BoxScore.vue'),
            props: true,
        },
        {
            path: '/news',
            name: 'news',
            meta: { indexable: true },
            component: () => import('@/views/News.vue'),
        },
        // The daily games, linked from the header's Daily menu.
        {
            path: '/daily',
            name: 'dailyEra',
            meta: { indexable: true },
            component: () => import('@/views/DailyEra.vue'),
        },
        {
            path: '/cap-five',
            name: 'capFive',
            meta: { indexable: true },
            component: () => import('@/views/CapFive.vue'),
        },
        {
            path: '/teams',
            name: 'teams',
            component: () => import('@/views/Teams.vue'),
        },
        {
            path: '/t/:teamUUID',
            name: 'publicTeam',
            meta: { indexable: true, headFromServer: true },
            component: () => import('@/views/PublicTeam.vue'),
            props: true,
        },
        {
            path: '/login',
            name: 'login',
            component: () => import('@/views/Login.vue'),
        },
        {
            path: '/sign-up',
            name: 'sign-up',
            component: () => import('@/views/SignUp.vue'),
        },
        {
            path: '/settings',
            name: 'settings',
            component: () => import('@/views/Settings.vue'),
            meta: { requiresAuth: true },
        },
        // Where a successful "Delete my data" lands, after the sign-out.
        {
            path: '/data-deleted',
            name: 'data-deleted',
            component: () => import('@/views/DataDeleted.vue'),
        },
        {
            path: '/callback',
            name: 'callback',
            component: () => import('@/views/Callback.vue'),
        },
        ...(IS_PREVIEW ? [{ path: '/sign-in-off', name: 'sign-in-off', component: () => import('@/views/SignInOff.vue') }] : []),
        // Anything no route above matches. Rendered in place, not redirected,
        // so the URL stays what was asked for. No `indexable`, so noindex.
        {
            path: '/:pathMatch(.*)*',
            name: 'not-found',
            component: () => import('@/views/NotFound.vue'),
        },
    ],
});

// A preview's /callback isn't a registered Logto redirect URI, and a session
// there would share yusufaf.dev's storage with other sites, so every way into
// sign-in (links, the save dialog, guarded routes) ends on one page saying so.
const SIGN_IN_ROUTES = new Set(['login', 'sign-up', 'callback']);

// Guards run inside the app's injection context, so useLogto() works here.
router.beforeEach((to) => {
    if (IS_PREVIEW && (SIGN_IN_ROUTES.has(String(to.name)) || to.meta.requiresAuth)) {
        return { name: 'sign-in-off' };
    }
    return to.meta.requiresAuth ? requireSignedIn(useLogto()) : true;
});
// `indexable` routes are the public pages in public/sitemap.xml, plus
// published teams. On a first load of /t/:teamUUID, getPublicTeamPage has
// already written the right tags, including noindex for an unknown team, so
// only later in-app navigations touch them. A preview has no server, so it
// always syncs.
router.afterEach((to, from) => {
    if (!IS_PREVIEW && from === START_LOCATION && to.meta.headFromServer) return;
    syncIndexing(to.path, to.meta.indexable === true);
});
reloadOnStaleChunk(router);

export default router;
