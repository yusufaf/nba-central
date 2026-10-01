<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { ROUTES } from "@/constants/constants";

// useRouter() only works during setup, so not inside the computeds: they
// re-run on every route change.
const router = useRouter();

const title = computed(() => {
    const currentPath = router.currentRoute.value.path;
    return ROUTES.find((route) => route.path === currentPath)?.title;
});

const isScorePage = computed(() => router.currentRoute.value.path === "/scores");
</script>

<template>
    <h1 class="title" :class="{ scores: isScorePage }">{{ title }}</h1>
</template>

<style scoped>
.title {
    font-size: 3rem;
    margin: 2rem 0;
    font-weight: 600;
    text-align: center;
}
.title.scores {
    margin: 2rem 0 0 0;
}
</style>
