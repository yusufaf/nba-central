import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";
import TeamBuilder from "@/views/TeamBuilder.vue";
import Scores from "@/views/Scores.vue";
import News from "@/views/News.vue";
import Login from "@/views/Login.vue";
import Teams from "@/views/Teams.vue";

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: "/",
            name: "home",
            component: Home,
        },
        {
            path: "/teambuilder",
            name: "teamBuilder",
            component: TeamBuilder,
        },
        {
            path: "/scores",
            name: "scores",
            component: Scores,
        },
        {
            path: "/news",
            name: "news",
            component: News,
        },
        {
            path: "/login",
            name: "login",
            component: Login,
        },
        {
            path: "/teams",
            name: "teams",
            component: Teams,
        },
    ],
});

export default router;
