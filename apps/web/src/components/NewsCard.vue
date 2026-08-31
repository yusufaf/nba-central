<script setup lang="ts">
import { computed } from "vue";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ExternalLink, MessageSquare, Globe } from "lucide-vue-next";
import type { NewsArticle } from "@/models/api";

const props = defineProps<{
    article: NewsArticle;
}>();

const formatDateTime = (dateTimeStr: string) => {
    const dateTime = new Date(dateTimeStr);
    const now = new Date();
    const diffMs = now.getTime() - dateTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return dateTime.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

const sourceMeta = computed(() => {
    switch (props.article.source) {
        case "Reddit":
            return { color: "bg-[#ff4500] hover:bg-[#ff4500]/90", icon: MessageSquare };
        case "Bluesky":
            return { color: "bg-[#0560ff] hover:bg-[#0560ff]/90", icon: Globe };
        case "ESPN":
            return { color: "bg-[#cc0000] hover:bg-[#cc0000]/90", icon: ExternalLink };
        default:
            return { color: "bg-slate-600 hover:bg-slate-600/90", icon: ExternalLink };
    }
});
</script>

<template>
    <a :href="article.url" target="_blank" rel="noopener noreferrer" class="block w-full h-full no-underline">
        <Card class="news-card h-full overflow-hidden flex flex-col group cursor-pointer border-border/60 hover:border-primary/60 transition-colors duration-200">
            <div v-if="article.thumbnailUrl" class="thumbnail-wrap">
                <img
                    :src="article.thumbnailUrl"
                    class="thumbnail-img"
                    alt=""
                    loading="lazy"
                    @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
                />
            </div>

            <div class="card-body">
                <div class="meta-row">
                    <Badge :class="`text-white border-0 text-xs px-2 py-0.5 ${sourceMeta.color}`">
                        <component :is="sourceMeta.icon" class="w-3 h-3 mr-1" />
                        {{ article.source }}
                    </Badge>
                    <div class="meta-date">
                        <CalendarDays class="w-3 h-3 mr-1" />
                        {{ formatDateTime(article.publishedAt) }}
                    </div>
                </div>

                <div class="headline">{{ article.headline }}</div>

                <p v-if="article.summary" class="summary">{{ article.summary }}</p>

                <div class="footer-row">
                    <span class="author">{{ article.author }}</span>
                    <ExternalLink class="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
            </div>
        </Card>
    </a>
</template>

<style scoped>
.news-card {
    background-color: hsl(var(--card));
}

.thumbnail-wrap {
    width: 100%;
    height: 10rem;
    overflow: hidden;
    background-color: hsl(var(--muted));
    flex-shrink: 0;
}

.thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.4s ease;
}

.news-card:hover .thumbnail-img {
    transform: scale(1.04);
}

.card-body {
    padding: 1rem 1.125rem 1.125rem;
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 0.625rem;
}

.meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
}

.meta-date {
    display: inline-flex;
    align-items: center;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    white-space: nowrap;
}

.headline {
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.35;
    color: hsl(var(--foreground));
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    transition: color 0.15s ease;
}

.news-card:hover .headline {
    color: hsl(var(--primary));
}

.summary {
    font-size: 0.8125rem;
    line-height: 1.45;
    color: hsl(var(--muted-foreground));
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.footer-row {
    margin-top: auto;
    padding-top: 0.625rem;
    border-top: 0.0625rem solid hsl(var(--border) / 0.6);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
}

.author {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
