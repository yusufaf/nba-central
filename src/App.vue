<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import { onMounted } from 'vue';
import AppHeader from "./views/Header.vue";
import { useTeamsStore } from '@/stores/teams';
import { Sonner } from "@/components/ui/sonner";

const teamsStore = useTeamsStore();

onMounted(async () => {
    await teamsStore.fetchTeamLogos();
});
</script>

<template>
    <Sonner position="bottom-right" theme="dark" rich-colors />
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
