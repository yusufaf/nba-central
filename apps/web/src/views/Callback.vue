<script setup lang="ts">
import { useHandleSignInCallback } from '@logto/vue';
import { useRouter } from 'vue-router';
import { signInReturnRoute } from '@/composables/usePendingSave';

const router = useRouter();

// Completes the OIDC authorization-code exchange, then sends the user home,
// or back to the builder to finish a Save they started signed out.
const { isLoading } = useHandleSignInCallback(() => {
    router.push(signInReturnRoute());
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
