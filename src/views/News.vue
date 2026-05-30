<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import PageTitle from "@/components/PageTitle.vue";
import { newsApi } from "@/network/api";
import NewsCard from "@/components/NewsCard.vue";
import { Input } from "@/components/ui/input";
import { Search, X, RefreshCw } from "lucide-vue-next";
import type { NewsArticle, NewsSource } from "@/models/api";

type Filter = "All" | NewsSource;

const articles = ref<NewsArticle[]>([]);
const activeFilter = ref<Filter>("All");
const filters: Filter[] = ["All", "ESPN", "Reddit", "Bluesky"];
const searchQuery = ref("");
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);

const fetchNews = async () => {
    try {
        isLoading.value = true;
        errorMessage.value = null;
        articles.value = await newsApi.getNews();
    } catch (e) {
        console.error("Failed to fetch news", e);
        errorMessage.value = "Unable to load news right now. Please try again.";
    } finally {
        isLoading.value = false;
    }
};

const sourceCounts = computed(() => {
    const counts: Record<Filter, number> = {
        All: articles.value.length,
        ESPN: 0,
        Reddit: 0,
        Bluesky: 0,
    };
    for (const a of articles.value) {
        counts[a.source]++;
    }
    return counts;
});

const filteredArticles = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    return articles.value.filter((a) => {
        if (activeFilter.value !== "All" && a.source !== activeFilter.value) return false;
        if (!q) return true;
        return (
            a.headline.toLowerCase().includes(q) ||
            (a.summary?.toLowerCase().includes(q) ?? false) ||
            a.author.toLowerCase().includes(q)
        );
    });
});

const clearSearch = () => {
    searchQuery.value = "";
};

onMounted(() => {
    fetchNews();
});
</script>

<template>
    <main class="news-page pb-12">
        <PageTitle />

        <div class="news-container">
            <!-- Controls row: search + refresh -->
            <div class="controls-row">
                <div class="search-wrap">
                    <Search class="search-icon" />
                    <Input
                        v-model="searchQuery"
                        type="search"
                        placeholder="Search headlines, summaries, authors..."
                        class="search-input"
                    />
                    <button
                        v-if="searchQuery"
                        @click="clearSearch"
                        class="clear-btn"
                        aria-label="Clear search"
                    >
                        <X class="w-4 h-4" />
                    </button>
                </div>
                <button
                    @click="fetchNews"
                    :disabled="isLoading"
                    class="refresh-btn"
                    aria-label="Refresh news"
                >
                    <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
                    <span>Refresh</span>
                </button>
            </div>

            <!-- Filter pills -->
            <div class="filter-row">
                <button
                    v-for="filter in filters"
                    :key="filter"
                    @click="activeFilter = filter"
                    class="filter-pill"
                    :class="{ active: activeFilter === filter }"
                >
                    <span>{{ filter }}</span>
                    <span class="count">{{ sourceCounts[filter] }}</span>
                </button>
            </div>

            <!-- Result summary -->
            <div v-if="!isLoading && !errorMessage" class="result-summary">
                Showing {{ filteredArticles.length }}
                {{ filteredArticles.length === 1 ? "article" : "articles" }}
                <span v-if="searchQuery">for "{{ searchQuery }}"</span>
            </div>

            <!-- States -->
            <div v-if="isLoading" class="state-wrap">
                <div class="spinner" />
            </div>

            <div v-else-if="errorMessage" class="state-wrap state-error">
                <p>{{ errorMessage }}</p>
                <button @click="fetchNews" class="retry-btn">Retry</button>
            </div>

            <div v-else-if="filteredArticles.length === 0" class="state-wrap state-empty">
                <p v-if="searchQuery">No results for "{{ searchQuery }}"</p>
                <p v-else>No news found for {{ activeFilter }}</p>
            </div>

            <!-- Grid -->
            <div v-else class="news-grid">
                <NewsCard
                    v-for="article in filteredArticles"
                    :key="article.id"
                    :article="article"
                />
            </div>
        </div>
    </main>
</template>

<style scoped>
.news-page {
    width: 100%;
}

.news-container {
    width: 100%;
    max-width: 80rem;
    margin: 0 auto;
    padding: 0 2rem;
}

@media (min-width: 768px) {
    .news-container {
        padding: 0 4rem;
    }
}

/* Controls */
.controls-row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    margin-bottom: 1rem;
    flex-wrap: wrap;
}

.search-wrap {
    position: relative;
    flex: 1;
    min-width: 16rem;
    display: flex;
    align-items: center;
}

.search-icon {
    position: absolute;
    left: 0.875rem;
    width: 1rem;
    height: 1rem;
    color: hsl(var(--muted-foreground));
    pointer-events: none;
}

.search-input {
    padding-left: 2.5rem;
    padding-right: 2.5rem;
    height: 2.5rem;
    background-color: hsl(var(--card));
    border-color: hsl(var(--border));
}

.clear-btn {
    position: absolute;
    right: 0.5rem;
    width: 1.75rem;
    height: 1.75rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: hsl(var(--muted-foreground));
    border-radius: 0.375rem;
    cursor: pointer;
    background: transparent;
    border: none;
}

.clear-btn:hover {
    background-color: hsl(var(--muted));
    color: hsl(var(--foreground));
}

.refresh-btn {
    height: 2.5rem;
    padding: 0 1rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 0.5rem;
    background-color: hsl(var(--card));
    border: 0.0625rem solid hsl(var(--border));
    color: hsl(var(--foreground));
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s ease;
}

.refresh-btn:hover:not(:disabled) {
    border-color: hsl(var(--primary));
    color: hsl(var(--primary));
}

.refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* Filter pills */
.filter-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
    scrollbar-width: none;
}

.filter-row::-webkit-scrollbar {
    display: none;
}

.filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4375rem 0.875rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 500;
    background-color: hsl(var(--card));
    border: 0.0625rem solid hsl(var(--border));
    color: hsl(var(--foreground));
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
}

.filter-pill:hover {
    border-color: hsl(var(--primary) / 0.5);
}

.filter-pill.active {
    background-color: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    border-color: hsl(var(--primary));
}

.filter-pill .count {
    font-size: 0.6875rem;
    padding: 0.0625rem 0.4375rem;
    border-radius: 9999px;
    background-color: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
    font-weight: 600;
}

.filter-pill.active .count {
    background-color: hsl(var(--primary-foreground) / 0.2);
    color: hsl(var(--primary-foreground));
}

/* Result summary */
.result-summary {
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
    margin-bottom: 1rem;
}

/* States */
.state-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 5rem 1rem;
}

.spinner {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    border: 0.1875rem solid hsl(var(--border));
    border-bottom-color: hsl(var(--primary));
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.state-error p {
    color: hsl(var(--destructive));
    font-size: 1rem;
}

.state-empty p {
    color: hsl(var(--muted-foreground));
    font-size: 1rem;
}

.retry-btn {
    padding: 0.5rem 1.25rem;
    border-radius: 9999px;
    background-color: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    font-weight: 600;
    font-size: 0.875rem;
    border: none;
    cursor: pointer;
    transition: opacity 0.15s ease;
}

.retry-btn:hover {
    opacity: 0.9;
}

/* Grid */
.news-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.25rem;
}

@media (min-width: 640px) {
    .news-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
    .news-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 1280px) {
    .news-grid { grid-template-columns: repeat(4, 1fr); }
}
</style>
