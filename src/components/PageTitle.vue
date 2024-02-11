<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { ROUTES } from "@/constants/constants";

const title = computed(() => {
    const currentPath = useRouter().currentRoute.value.path;
    return ROUTES.find((route) => route.path === currentPath)?.title;
});

const isScorePage = computed(() => {
    const currentPath = useRouter().currentRoute.value.path;
    return currentPath === "/scores";
});
</script>

<template>
    <h1 class="title" :class="{ scores: isScorePage }">{{ title }}</h1>
</template>

<style scoped>
.title {
    font-size: 3rem;
    margin: 2rem 0;
    font-weight: 600;
}
.title.scores {
    margin: 2rem 0 0 0;
}
</style>
