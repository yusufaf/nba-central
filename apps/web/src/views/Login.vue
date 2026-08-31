<script setup lang="ts">
import { onMounted } from 'vue';
import { useLogtoSignIn } from '@/composables/useLogtoSignIn';
import { Button } from '@/components/ui/button';

// Logto has no embeddable sign-in form (unlike Clerk's <SignIn>) — it
// redirects to its own hosted sign-in page. This view's only job is to kick
// off that redirect; /callback (Callback.vue) picks the user back up.
//
// isAuthenticated only checks that tokens are present, not that they're
// unexpired — a stale session left here with nothing to do, stuck on
// "Redirecting to sign in..." forever. useLogtoSignIn sends them home
// instead; anything that actually needs a fresh token refreshes it on use.
const { error, isSigningIn, startSignIn } = useLogtoSignIn(() => ({
    redirectUri: `${window.location.origin}/callback`,
}));

onMounted(startSignIn);
</script>

<template>
    <div class="auth-container">
        <template v-if="error">
            <p class="text-destructive">Couldn't sign in. {{ error }}</p>
            <Button variant="outline" :disabled="isSigningIn" @click="startSignIn">
                Try again
            </Button>
        </template>
        <p v-else>Redirecting to sign in...</p>
    </div>
</template>

<style scoped>
.auth-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    min-height: 80vh;
    padding: 2rem;
    background-color: hsl(var(--background));
}
</style>
