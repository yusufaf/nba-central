<script setup lang="ts">
import { computed } from 'vue';
import { ArrowDown, ArrowUp, Flame } from 'lucide-vue-next';
import { DAILY_ERA_MAX_ATTEMPTS } from '@/utils/dailyEra';
import type { DailyEraShareResult, DailyEraShareTile } from '@/utils/dailyEraShare';

export interface DailyEraShareCardProps {
    result: DailyEraShareResult;
    /** The puzzle's crop as a data: URL, or null when it couldn't be fetched. */
    imageUrl: string | null;
}

const props = defineProps<DailyEraShareCardProps>();

const score = computed(
    () => `${props.result.solved ? props.result.attempts : 'X'}/${DAILY_ERA_MAX_ATTEMPTS}`,
);

// The same colours as GuessList's chips; fill versus outline keeps close and
// near apart.
const TILES = {
    hit: 'bg-success text-success-foreground',
    close: 'bg-warning text-warning-foreground',
    near: 'border-4 border-primary-strong text-primary-strong',
    far: 'bg-muted text-muted-foreground',
} as const;
const tileClass = (tile: DailyEraShareTile) => TILES[tile.hit ? 'hit' : tile.band];
</script>

<template>
    <div
        class="daily-share-card dark flex gap-12 overflow-hidden bg-background p-12 text-foreground"
        style="width: 1200px; height: 630px; font-size: 16px"><!-- style-guard-allow: px-unit -->
        <!-- Pinned in px like ShareCard.vue: it's exported as a fixed
             1200x630 PNG, and .dark keeps one look whatever the player's
             theme. Tiles are boxes and icons, not emoji: html-to-image draws
             with whatever emoji font the OS has. -->
        <div class="flex min-w-0 flex-1 flex-col justify-between">
            <div class="flex flex-col gap-2">
                <h1 class="text-6xl font-bold leading-tight">Which Era?</h1>
                <p class="text-3xl text-muted-foreground">Daily #{{ result.puzzleNumber }}</p>
            </div>

            <div class="flex items-end gap-8">
                <span class="text-8xl font-bold leading-none tabular-nums" data-testid="share-score">{{ score }}</span>
                <span
                    v-if="result.streak"
                    class="flex items-center gap-2 pb-2 text-5xl font-bold text-primary"
                    data-testid="share-streak"
                >
                    <Flame class="size-12" aria-hidden="true" />
                    {{ result.streak }}
                </span>
            </div>

            <ol class="flex gap-4" aria-label="Guesses">
                <li
                    v-for="(tile, i) in result.tiles"
                    :key="i"
                    data-testid="share-tile"
                    class="flex size-20 items-center justify-center rounded-lg"
                    :class="tileClass(tile)"
                >
                    <template v-if="!tile.hit">
                        <ArrowUp v-if="tile.direction === 'later'" class="size-10" aria-hidden="true" />
                        <ArrowDown v-else class="size-10" aria-hidden="true" />
                    </template>
                </li>
            </ol>

            <p class="text-xl text-muted-foreground">nba.yusufaf.dev/daily</p>
        </div>

        <div class="flex w-[520px] flex-col justify-between gap-3"><!-- style-guard-allow: px-unit -->
            <div class="aspect-[5/4] w-full overflow-hidden rounded-lg bg-foreground/5">
                <img v-if="imageUrl" :src="imageUrl" alt="" class="size-full object-contain" />
                <div v-else class="size-full" data-testid="share-card-image-fallback" />
            </div>
            <p class="text-right text-sm text-muted-foreground">Jersey art: Basketball Jersey Database</p>
        </div>
    </div>
</template>

<style scoped>
/* p-12, size-20, text-6xl and the rest resolve through these theme
   variables, which are rem: they'd follow the Text size setting and push
   the content out of the fixed 1200x630 frame. The same sizes, in px. */
.daily-share-card {
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
