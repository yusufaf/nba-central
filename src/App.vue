<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import AppHeader from "./views/Header.vue";
</script>

<template>
    <q-layout view="hhh lpR fff">
        <AppHeader />
        <q-page-container>
            <RouterView />
        </q-page-container>
        <q-footer elevated class="bg-primary text-black">
            <q-toolbar>
                <a
                    class="github-logo"
                    href="https://github.com/yusufaf/nba-central"
                >
                    <img
                        alt="Github logo"
                        src="@/assets/github.png"
                        width="32"
                        height="32"
                        title="Team Builder GitHub"
                    />
                </a>
            </q-toolbar>
        </q-footer>
    </q-layout>
</template>

<style scoped>
.github-logo {
    margin-left: auto;
    margin-right: 0.75rem;
}
</style>
