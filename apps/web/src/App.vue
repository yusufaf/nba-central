<script setup lang="ts">
import { RouterView } from "vue-router";
import { onMounted } from 'vue';
import { toast } from 'vue-sonner';
import AppHeader from "./views/Header.vue";
import { useTeamsStore } from '@/stores/teams';
import { Sonner } from "@/components/ui/sonner";
import { setAccessTokenGetter, setSessionExpiredHandler } from '@/network/api';
import {
    useSessionExpiry,
    consumeSessionExpiredFlag,
    SESSION_EXPIRED_MESSAGE,
} from '@/composables/useSessionExpiry';

const teamsStore = useTeamsStore();

// useLogto() only works inside a component's setup context, so the api.ts
// module can't call it directly — wire the real getter in here instead.
const { expireSession, getApiAccessToken } = useSessionExpiry();
setAccessTokenGetter(getApiAccessToken);
setSessionExpiredHandler(expireSession);

onMounted(async () => {
    if (consumeSessionExpiredFlag()) {
        toast.error(SESSION_EXPIRED_MESSAGE);
    }
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
    color: hsl(var(--primary-foreground));
}

.github-logo {
    margin-left: auto;
    margin-right: 0.75rem;
    display: inline-flex;
}
</style>
