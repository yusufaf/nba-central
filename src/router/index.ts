import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import TeamBuilder from "@/views/TeamBuilderView.vue";
import Scores from "@/views/ScoresView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // {
    //   path: "/",
    //   name: "home",
    //   component: HomeView,
    // },
    {
      path: "/",
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
      component: Scores,
    },
    {
      path: "/about",
      name: "about",
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import("../views/AboutView.vue"),
    },

  ],
});

export default router;
