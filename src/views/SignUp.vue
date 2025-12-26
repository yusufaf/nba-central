<script setup lang="ts">
import { SignUp } from '@clerk/vue';
import type { SignUpProps } from '@clerk/types';

const appearance: SignUpProps['appearance'] = {
    layout: {
        socialButtonsPlacement: 'bottom',
        socialButtonsVariant: 'iconButton',
    },
    variables: {
        colorPrimary: '#e08210',
        colorText: '#1d1d1d',
    },
    elements: {
        card: {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
            backgroundColor: '#ffffff',
        },
        headerTitle: {
            fontSize: '24px',
            textAlign: 'center',
        },
        socialButtons: {
            justifyContent: 'center',
        },
    },
};
</script>

<template>
    <div class="auth-container">
        <SignUp 
            :appearance="appearance" 
            signInUrl="/login" 
        
        />
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
