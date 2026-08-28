<script setup lang="ts">
import { onMounted } from 'vue';
import { useLogto } from '@logto/vue';
import { useRouter } from 'vue-router';

const { signIn, isAuthenticated } = useLogto();
const router = useRouter();

// Logto has no embeddable sign-in form (unlike Clerk's <SignIn>) — it
// redirects to its own hosted sign-in page. This view's only job is to kick
// off that redirect; /callback (Callback.vue) picks the user back up.
//
// isAuthenticated only checks that tokens are present, not that they're
// unexpired — a stale session left here with nothing to do, stuck on
// "Redirecting to sign in..." forever. Send them home instead; anything
// that actually needs a fresh token refreshes it on use.
onMounted(() => {
    if (isAuthenticated.value) {
        router.push('/');
    } else {
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
