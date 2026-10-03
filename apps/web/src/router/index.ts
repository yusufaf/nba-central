import { createRouter, createWebHistory } from 'vue-router';
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

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: Home,
        },
        {
            path: '/teambuilder',
            name: 'teamBuilder',
            component: TeamBuilder,
        },
        {
            path: '/scores',
            name: 'scores',
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

export default router;
