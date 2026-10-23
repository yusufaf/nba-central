<script setup lang="ts">
import { computed } from 'vue';
import { Flame } from 'lucide-vue-next';
import type { RatingTier } from '@/constants/ratings';
import { capFiveTiers } from '@/utils/capFive';
import type { CapFiveResult } from '@/models/api';

const props = defineProps<{
    result: CapFiveResult;
    /** Null leaves the streak out. */
    streak: number | null;
}>();

const score = computed(() =>
    props.result.busted ? `${props.result.total}` : `${props.result.total}/${props.result.optimal.total}`,
);

// The rating chip's colours, filled. Boxes, not emoji: html-to-image draws
// with whatever emoji font the OS has.
const TILE_CLASS = {
    elite: 'bg-rating-elite',
    great: 'bg-rating-great',
    good: 'bg-rating-good',
    average: 'bg-muted-foreground/40',
} satisfies Record<RatingTier, string>;
const tiles = computed(() => capFiveTiers(props.result).map((tier) => TILE_CLASS[tier]));
</script>

<template>
    <div
        class="cap-five-share-card dark flex flex-col justify-between overflow-hidden bg-background p-12 text-foreground"
        style="width: 1200px; height: 630px; font-size: 16px"><!-- style-guard-allow: px-unit -->
        <!-- Pinned in px like DailyEraShareCard: it's exported as a fixed
             1200x630 PNG, and .dark keeps one look whatever the player's
             theme. Never a name: the card is shared before friends play. -->
        <div class="flex flex-col gap-2">
            <h1 class="text-6xl font-bold leading-tight">Cap Five</h1>
            <p class="text-3xl text-muted-foreground">Daily #{{ result.puzzleNumber }}</p>
        </div>

        <div class="flex items-end gap-8">
            <span class="text-8xl font-bold leading-none tabular-nums" data-testid="share-score">{{ score }}</span>
            <span v-if="result.busted" class="pb-2 text-5xl font-bold text-destructive">Bust</span>
            <span
                v-if="streak"
                class="flex items-center gap-2 pb-2 text-5xl font-bold text-primary"
                data-testid="share-streak"
            >
                <Flame class="size-12" aria-hidden="true" />
                {{ streak }}
            </span>
        </div>

        <ol class="flex gap-4" aria-label="Picks by rating tier">
            <li
                v-for="(tile, i) in tiles"
                :key="i"
                data-testid="share-tile"
                class="size-20 rounded-lg"
                :class="tile"
            />
        </ol>

        <div class="flex items-end justify-between">
            <p class="text-xl text-muted-foreground">nba.yusufaf.dev/cap-five</p>
            <p class="text-sm text-muted-foreground">Ratings: NBA {{ result.gameVersion }} via 2kratings.com</p>
        </div>
    </div>
</template>

<style scoped>
/* p-12, size-20, text-6xl and the rest resolve through these theme
   variables, which are rem: they'd follow the Text size setting and push
   the content out of the fixed 1200x630 frame. The same sizes, in px. */
.cap-five-share-card {
    --spacing: 4px; /* style-guard-allow: px-unit */
    --radius: 8px; /* style-guard-allow: px-unit */
    --text-sm: 14px; /* style-guard-allow: px-unit */
    --text-xl: 20px; /* style-guard-allow: px-unit */
    --text-3xl: 30px; /* style-guard-allow: px-unit */
    --text-5xl: 48px; /* style-guard-allow: px-unit */
    --text-6xl: 60px; /* style-guard-allow: px-unit */
    --text-8xl: 96px; /* style-guard-allow: px-unit */
}
</style>
