<script setup lang="ts">
import { useHandleSignInCallback } from '@logto/vue';
import { useRouter } from 'vue-router';

const router = useRouter();

// Completes the OIDC authorization-code exchange, then returns the user to
// where they started (or home, on first sign-in).
const { isLoading } = useHandleSignInCallback(() => {
    router.push('/');
});
</script>

<template>
    <div class="callback-container">
        <p v-if="isLoading">Signing in...</p>
    </div>
</template>

<style scoped>
.callback-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 80vh;
    color: hsl(var(--muted-foreground));
}
</style>
