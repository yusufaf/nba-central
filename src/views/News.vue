<script setup lang="ts">
import { ref, onMounted } from "vue";
import PageTitle from "@/components/PageTitle.vue";
import { ESPN_NEWS_URL } from "@/constants/constants";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CalendarDays } from "lucide-vue-next";
import { useMediaQuery } from "@vueuse/core";

const isMobile = useMediaQuery('(max-width: 768px)');
const linkProperty = isMobile.value ? "mobile" : "web";

const espnArticles = ref<any[]>([]);

const fetchNews = async () => {
    const response = await axios.get(ESPN_NEWS_URL);
    const { articles } = response.data;
    espnArticles.value = articles;
};

const formatDateTime = (dateTimeStr: string) => {
    const dateTime = new Date(dateTimeStr);
    const date = dateTime.toLocaleDateString();
    const time = dateTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
    return `${date} ${time}`;
};

onMounted(() => {
    fetchNews();
});
</script>

<template>
    <main class="news-page">
        <PageTitle />
        <div class="news-container">
            <template
                v-for="{
                    links,
                    headline,
                    byline,
                    published,
                    dataSourceIdentifier,
                } in espnArticles"
                :key="dataSourceIdentifier"
            >
                <Card class="dark:bg-slate-800">
                    <CardContent class="main-card-section pt-6">
                        <div>
                            <a
                                class="link"
                                :href="links[linkProperty].href"
                                target="_blank"
                            >
                                {{ headline ?? "" }}
                            </a>
                            <div v-if="byline" class="text-sm text-muted-foreground mt-1">
                                by {{ byline }}
                            </div>
                        </div>
                        <div class="date-container">
                            <CalendarDays class="w-4 h-4" />
                            <span class="text-sm">
                                {{ formatDateTime(published) ?? "" }}
                            </span>
                        </div>
                    </CardContent>
                    <Separator />
                </Card>
            </template>
        </div>
    </main>
</template>

<style scoped>
.news-page {
    display: grid;
    justify-items: center;
    padding: 0 4rem;
}

.main-card-section {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
}

.date-container {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.link {
    color: hsl(var(--primary));
}

.link:visited {
    color: hsl(var(--muted-foreground));
}
</style>
