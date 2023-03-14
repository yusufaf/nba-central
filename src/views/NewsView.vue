<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import PageTitle from "@/components/PageTitle.vue"
import { ESPN_NEWS_URL } from "@/constants/constants";
import axios from "axios";

const espnArticles = ref<any[]>([]);


const fetchNews = async () => {
    const response = await axios.get(ESPN_NEWS_URL);
    console.log(response.data);
    const { articles } = response.data;
    espnArticles.value = articles;
}


onMounted(() => {
    fetchNews();
})


</script>

<template>
    <main class="news-page">
        <PageTitle />
        <div class="builder-container">
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

.header {
    display: flex;
    align-items: center;
    border-bottom: 0.125rem solid var(--vt-c-divider-dark-1);
}
</style>
