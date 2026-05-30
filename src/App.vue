<script setup lang="ts">
import { RouterView } from "vue-router";
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
    <div class="app-shell">
        <AppHeader />
        <main class="app-main">
            <RouterView />
        </main>
        <footer class="app-footer">
            <a
                class="github-logo"
                href="https://github.com/yusufaf/nba-central"
                target="_blank"
                rel="noopener noreferrer"
            >
                <img
                    alt="Github logo"
                    src="@/assets/github.png"
                    width="32"
                    height="32"
                    title="Team Builder GitHub"
                />
            </a>
        </footer>
    </div>
</template>

<style scoped>
.app-shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}

.app-main {
    flex: 1;
}

.app-footer {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    background-color: hsl(var(--primary));
    color: #000;
}

.github-logo {
    margin-left: auto;
    margin-right: 0.75rem;
    display: inline-flex;
}
</style>
