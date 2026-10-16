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
import { IS_PREVIEW } from '@/utils/preview';

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
        <p v-if="IS_PREVIEW" class="preview-banner" role="status">
            PR preview build: uses the development API, and sign-in is turned off.
        </p>
        <AppHeader />
        <main class="app-main">
            <RouterView />
        </main>
        <footer class="app-footer">
            <div class="footer-text">
                <button type="button" class="footer-link" @click="feedbackOpen = true">
                    Report a bug or suggest an idea
                </button>
                <p class="footer-note">
                    Fan-made project. Not affiliated with or endorsed by the NBA.
                </p>
            </div>
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
                    title="nba-central on GitHub"
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

.preview-banner {
    padding: 0.375rem 1rem;
    text-align: center;
    font-size: 0.875rem;
    background-color: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
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

.footer-text {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 1rem;
}

.footer-note {
    font-size: 0.8125rem;
    color: hsl(var(--primary-foreground) / 0.85);
    text-wrap: balance;
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
