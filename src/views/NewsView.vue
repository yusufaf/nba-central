<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { ESPN_NEWS_URL } from "@/constants/constants";

/* TODO: Dropdown for asking for frequency of when to retrieve more news */

const fetchNews = async () => {
    
}


onMounted(() => {
    fetchNews();
})


</script>

<template>
    <main class="news-page">
        <h1 class="title">News</h1>
        <div class="builder-container">
            <div class="header" />
        </div>
    </main>
</template>

<style scoped>
.news-page {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    padding: 0 4rem;
}

.title {
    font-size: 3rem;
    margin: 2rem 0;
    font-weight: 600;
}

.header {
    display: flex;
    align-items: center;
    border-bottom: 0.125rem solid var(--vt-c-divider-dark-1);
}
</style>
