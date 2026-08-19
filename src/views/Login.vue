<script setup lang="ts">
import { onMounted } from 'vue';
import { useLogto } from '@logto/vue';

const { signIn, isAuthenticated } = useLogto();

// Logto has no embeddable sign-in form (unlike Clerk's <SignIn>) — it
// redirects to its own hosted sign-in page. This view's only job is to kick
// off that redirect; /callback (Callback.vue) picks the user back up.
onMounted(() => {
    if (!isAuthenticated.value) {
        signIn({ redirectUri: `${window.location.origin}/callback` });
    }
});
</script>

<template>
    <div class="auth-container">
        <p>Redirecting to sign in...</p>
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
