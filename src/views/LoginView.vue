<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import PageTitle from "@/components/PageTitle.vue"

</script>

<template>
    <main class="login-page">
        <PageTitle />
        <div class="login-container">
            
        </div>
    </main>
</template>

<style scoped>
.login-page {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    padding: 0 4rem;
}


</style>
