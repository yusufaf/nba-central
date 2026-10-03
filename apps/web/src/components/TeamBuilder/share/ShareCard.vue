<script setup lang="ts">
import { computed, ref } from 'vue';
import { averageRating, ratingTier } from '@/constants/ratings';

export interface ShareCardPlayer {
    fullName: string;
    position?: string;
    rating?: number;
}

export interface ShareCardProps {
    title: string;
    city: string;
    country: string;
    logoUrl: string;
    jerseyUrl: string;
    username: string;
    starters: ShareCardPlayer[];
}

const props = defineProps<ShareCardProps>();

// html-to-image re-fetches every <img>; a cross-origin image without CORS
// headers taints the canvas and the whole export fails. Images that error
// are replaced rather than left broken.
const logoFailed = ref(false);
const jerseyFailed = ref(false);

const monogram = computed(() => (props.title.trim()[0] || '?').toUpperCase());
const average = computed(() => averageRating(props.starters.map((p) => p.rating)));
const tier = computed(() => (average.value === null ? 'average' : ratingTier(average.value)));
const location = computed(() => [props.city, props.country].filter(Boolean).join(', '));
</script>

<template>
    <div
        class="share-card dark flex flex-col justify-between overflow-hidden bg-background p-12 text-foreground"
        style="width: 1200px; height: 630px; font-size: 16px"><!-- style-guard-allow: px-unit -->
        <!-- .dark: the card is a published image other people see, so it
             keeps one brand look whatever theme its author happens to use. -->
        <!-- This card is exported as a fixed 1200x630 PNG via html-to-image,
             not laid out for a variable viewport - a user font-size
             preference other than the browser default would scale
             75rem/39.375rem away from 1200x630 and crop the export, so it
             is pinned in px instead. The Tailwind classes inside are rem
             too; the scoped style below pins the theme values they read. -->
        <header class="flex items-center gap-8">
            <img
                v-if="logoUrl && !logoFailed"
                :src="logoUrl"
                crossorigin="anonymous"
                alt=""
                class="h-32 w-32 object-contain"
                @error="logoFailed = true"
            />
            <div
                v-else
                class="flex h-32 w-32 items-center justify-center rounded-full bg-primary text-6xl font-bold text-primary-foreground"
            >
                {{ monogram }}
            </div>
            <div class="min-w-0 flex-1">
                <h1 class="truncate text-6xl font-bold leading-tight">{{ title || 'Untitled team' }}</h1>
                <p v-if="location" class="mt-2 text-3xl text-muted-foreground">{{ location }}</p>
            </div>
            <img
                v-if="jerseyUrl && !jerseyFailed"
                :src="jerseyUrl"
                crossorigin="anonymous"
                alt=""
                class="h-40 w-40 object-contain"
                @error="jerseyFailed = true"
            />
        </header>

        <ul class="grid grid-cols-5 gap-4">
            <li
                v-for="(player, i) in starters.slice(0, 5)"
                :key="i"
                class="flex flex-col justify-between rounded-lg border border-border bg-card p-4"
            >
                <span class="text-sm uppercase tracking-wide text-muted-foreground">{{ player.position || '—' }}</span>
                <span class="mt-2 line-clamp-2 text-2xl font-semibold leading-snug">{{ player.fullName }}</span>
                <span v-if="player.rating !== undefined" class="mt-3 text-3xl font-bold" :data-tier="ratingTier(player.rating)">
                    {{ player.rating }}
                </span>
            </li>
        </ul>

        <footer class="flex items-end justify-between">
            <div>
                <span class="text-xl text-muted-foreground">Starting five</span>
                <div v-if="average !== null" class="mt-1 text-5xl font-bold" :data-tier="tier">{{ average }}</div>
            </div>
            <div class="text-right">
                <div class="text-2xl">by {{ username }}</div>
                <div class="text-xl text-muted-foreground">nba.yusufaf.dev</div>
            </div>
        </footer>
    </div>
</template>

<style scoped>
/* p-12, h-32, text-6xl and the rest resolve through these theme variables,
   which are rem: they'd follow the Text size setting and push the content
   out of the fixed 1200x630 frame. The same sizes, in px, for this card only. */
.share-card {
    --spacing: 4px; /* style-guard-allow: px-unit */
    --radius: 8px; /* style-guard-allow: px-unit */
    --text-sm: 14px; /* style-guard-allow: px-unit */
    --text-xl: 20px; /* style-guard-allow: px-unit */
    --text-2xl: 24px; /* style-guard-allow: px-unit */
    --text-3xl: 30px; /* style-guard-allow: px-unit */
    --text-5xl: 48px; /* style-guard-allow: px-unit */
    --text-6xl: 60px; /* style-guard-allow: px-unit */
}

/* Rating colours follow the builder's tiers; tokens come from main.css. */
[data-tier='elite'] { color: hsl(var(--primary)); }
[data-tier='great'] { color: hsl(var(--foreground)); }
[data-tier='good'],
[data-tier='average'] { color: hsl(var(--muted-foreground)); }
</style>
