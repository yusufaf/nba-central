<script setup lang="ts">
import { ref, watch, computed, onMounted } from "vue";
import PageTitle from "@/components/PageTitle.vue";
</script>

<template>
    <main class="teams-page">
        <PageTitle />
        <div class="teams-container"></div>
    </main>
</template>

<style scoped>
.teams-page {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    padding: 0 4rem;
}
</style>
