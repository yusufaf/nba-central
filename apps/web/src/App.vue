<script setup lang="ts">
import { RouterView, useRouter } from "vue-router";
import { onMounted, ref } from 'vue';
import { toast } from 'vue-sonner';
import AppHeader from "./views/Header.vue";
import FeedbackDialog from "@/components/FeedbackDialog.vue";
import { Sonner } from "@/components/ui/sonner";
import { setAccessTokenGetter } from '@/network/api';
import {
    useSessionExpiry,
    consumeSessionExpiredFlag,
    SESSION_EXPIRED_MESSAGE,
} from '@/composables/useSessionExpiry';
import { useAccountSession } from '@/composables/useCurrentUser';
import { consumeDataDeletedFlag } from '@/composables/useAccountData';
import { discardAbandonedPendingSave } from '@/composables/usePendingSave';
import { applyDisplayPreferences, useResolvedTheme } from '@/composables/useDisplayPreferences';

const feedbackOpen = ref(false);

// useLogto() only works inside a component's setup context, so the api.ts
// module can't call it directly — wire the real getter in here instead.
const { getApiAccessToken } = useSessionExpiry();
setAccessTokenGetter(getApiAccessToken);
useAccountSession();
discardAbandonedPendingSave(window.location);
applyDisplayPreferences();
const theme = useResolvedTheme();

// Signing out after a delete can only return to the site root, the one
// post-sign-out URL Logto is known to accept; this finishes the trip.
const router = useRouter();
if (consumeDataDeletedFlag()) {
    void router.replace({ name: 'data-deleted' });
}

onMounted(() => {
    if (consumeSessionExpiredFlag()) {
        toast.error(SESSION_EXPIRED_MESSAGE);
    }
});
</script>

<template>
    <Sonner position="bottom-right" :theme="theme" rich-colors />
    <div class="app-shell">
        <AppHeader />
        <main class="app-main">
            <RouterView />
        </main>
        <footer class="app-footer">
            <button type="button" class="footer-link" @click="feedbackOpen = true">
                Send feedback
            </button>
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
    <FeedbackDialog v-model:open="feedbackOpen" />
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

.footer-link {
    font-size: 0.8125rem;
    color: hsl(var(--primary-foreground) / 0.85);
    text-decoration: underline;
    text-underline-offset: 0.2em;
}

.footer-link:hover,
.footer-link:focus-visible {
    color: hsl(var(--primary-foreground));
}

.github-logo {
    margin-left: auto;
    margin-right: 0.75rem;
    display: inline-flex;
}
</style>
