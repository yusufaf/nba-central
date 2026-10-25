import { createRouter, createWebHashHistory, createWebHistory, START_LOCATION } from 'vue-router';
import Home from '../views/Home.vue';
import TeamBuilder from '@/views/TeamBuilder.vue';
import Scores from '@/views/Scores.vue';
import BoxScore from '@/views/BoxScore.vue';
import News from '@/views/News.vue';
import Teams from '@/views/Teams.vue';
import PublicTeam from '@/views/PublicTeam.vue';
import Login from '@/views/Login.vue';
import SignUp from '@/views/SignUp.vue';
import Callback from '@/views/Callback.vue';
import Settings from '@/views/Settings.vue';
import DataDeleted from '@/views/DataDeleted.vue';
import NotFound from '@/views/NotFound.vue';
import SignInOff from '@/views/SignInOff.vue';
import { useLogto } from '@logto/vue';
import { requireSignedIn } from './guards';
import { syncIndexing } from './indexing';
import { IS_PREVIEW } from '@/utils/preview';

const router = createRouter({
    // GitHub Pages has no SPA fallback for a preview's subfolder, so a reload
    // of /teambuilder would 404 there; hash URLs never leave index.html.
    history: IS_PREVIEW
        ? createWebHashHistory(import.meta.env.BASE_URL)
        : createWebHistory(import.meta.env.BASE_URL),
    routes: [
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
            component: TeamBuilder,
        },
        {
            path: '/scores',
            name: 'scores',
            meta: { indexable: true },
            component: Scores,
        },
        // Lazy: it shares nothing with the other pages, so it stays out of the
        // entry chunk.
        {
            path: '/standings',
            name: 'standings',
            meta: { indexable: true },
            component: () => import('@/views/Standings.vue'),
        },
        {
            path: '/game/:gameId',
            name: 'boxScore',
            component: BoxScore,
            props: true,
        },
        {
            path: '/news',
            name: 'news',
            meta: { indexable: true },
            component: News,
        },
        // The daily games, linked from the header's Daily menu. Lazy, unlike
        // the rest: a standalone game shares nothing with the other pages, so
        // it stays out of the entry chunk and out of every router import.
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
            component: Teams,
        },
        {
            path: '/t/:teamUUID',
            name: 'publicTeam',
            meta: { indexable: true, headFromServer: true },
            component: PublicTeam,
            props: true,
        },
        {
            path: '/login',
            name: 'login',
            component: Login,
        },
        {
            path: '/sign-up',
            name: 'sign-up',
            component: SignUp,
        },
        {
            path: '/settings',
            name: 'settings',
            component: Settings,
            meta: { requiresAuth: true },
        },
        // Where a successful "Delete my data" lands, after the sign-out.
        {
            path: '/data-deleted',
            name: 'data-deleted',
            component: DataDeleted,
        },
        {
            path: '/callback',
            name: 'callback',
            component: Callback,
        },
        ...(IS_PREVIEW ? [{ path: '/sign-in-off', name: 'sign-in-off', component: SignInOff }] : []),
        // Anything no route above matches. Rendered in place, not redirected,
        // so the URL stays what was asked for. No `indexable`, so noindex.
        {
            path: '/:pathMatch(.*)*',
            name: 'not-found',
            component: NotFound,
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

export default router;
