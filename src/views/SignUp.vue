<script setup lang="ts">
import { onMounted } from 'vue';
import { useLogtoSignIn } from '@/composables/useLogtoSignIn';
import { Button } from '@/components/ui/button';

// Same redirect as Login.vue, just landing on Logto's registration screen
// first instead of sign-in — Logto's hosted sign-in/register pages cross-link
// to each other from there, same as the sign-in-vs-create-account link on
// Logto's own demo app.
const { error, isSigningIn, startSignIn } = useLogtoSignIn(() => ({
    redirectUri: `${window.location.origin}/callback`,
    firstScreen: 'register',
}));

onMounted(startSignIn);
</script>

<template>
    <div class="auth-container">
        <template v-if="error">
            <p class="text-destructive">Couldn't sign up. {{ error }}</p>
            <Button variant="outline" :disabled="isSigningIn" @click="startSignIn">
                Try again
            </Button>
        </template>
        <p v-else>Redirecting to sign up...</p>
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
