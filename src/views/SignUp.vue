<script setup lang="ts">
import { onMounted } from 'vue';
import { useLogto } from '@logto/vue';

const { signIn, isAuthenticated } = useLogto();

// Same redirect as Login.vue, just landing on Logto's registration screen
// first instead of sign-in — Logto's hosted sign-in/register pages cross-link
// to each other from there, same as the sign-in-vs-create-account link on
// Logto's own demo app.
onMounted(() => {
    if (!isAuthenticated.value) {
        signIn({
            redirectUri: `${window.location.origin}/callback`,
            firstScreen: 'register',
        });
    }
});
</script>

<template>
    <div class="auth-container">
        <p>Redirecting to sign up...</p>
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
