import { createRouter, createWebHistory, START_LOCATION } from 'vue-router';
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
import { useLogto } from '@logto/vue';
import { requireSignedIn } from './guards';
import { syncIndexing } from './indexing';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
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
    ],
});

// Guards run inside the app's injection context, so useLogto() works here.
router.beforeEach((to) => (to.meta.requiresAuth ? requireSignedIn(useLogto()) : true));
// `indexable` routes are the public pages in public/sitemap.xml, plus
// published teams. On a first load of /t/:teamUUID, getPublicTeamPage has
// already written the right tags, including noindex for an unknown team, so
// only later in-app navigations touch them.
router.afterEach((to, from) => {
    if (from === START_LOCATION && to.meta.headFromServer) return;
    syncIndexing(to.path, to.meta.indexable === true);
});

export default router;
