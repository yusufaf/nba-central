<script setup lang="ts">
import { onMounted } from 'vue';
import { useLogto } from '@logto/vue';
import { Button } from '@/components/ui/button';

const { signIn, isAuthenticated, error } = useLogto();

// Same redirect as Login.vue, just landing on Logto's registration screen
// first instead of sign-in — Logto's hosted sign-in/register pages cross-link
// to each other from there, same as the sign-in-vs-create-account link on
// Logto's own demo app.
function startSignIn() {
    signIn({
        redirectUri: `${window.location.origin}/callback`,
        firstScreen: 'register',
    });
}

onMounted(() => {
    if (!isAuthenticated.value) {
        startSignIn();
    }
});
</script>

<template>
    <div class="auth-container">
        <template v-if="error">
            <p>Couldn't reach sign-up. {{ error.message }}</p>
            <Button @click="startSignIn">Try again</Button>
        </template>
        <p v-else>Redirecting to sign up...</p>
    </div>
</template>

<style scoped>
.auth-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 80vh;
    padding: 2rem;
    background-color: var(--vt-c-black-soft);
}
</style>
