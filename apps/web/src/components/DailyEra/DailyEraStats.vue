<script setup lang="ts">
import { computed } from 'vue';
import type { DailyEraStats } from '@/utils/dailyEra';

const props = defineProps<{
    stats: DailyEraStats;
    /** This game's guess count on a win, to highlight its row; null otherwise. */
    attempts: number | null;
    archive: boolean;
}>();

const winRate = computed(() =>
    props.stats.played ? Math.round((props.stats.wins / props.stats.played) * 100) : 0,
);

const tiles = computed(() => [
    { label: 'Played', value: props.stats.played, testid: 'stat-played' },
    { label: 'Win %', value: winRate.value, testid: 'stat-win-rate' },
    { label: 'Streak', value: props.stats.currentStreak, testid: 'stat-streak' },
    { label: 'Best', value: props.stats.bestStreak, testid: 'stat-best' },
]);

const maxCount = computed(() => Math.max(1, ...props.stats.distribution));
</script>

<template>
    <section aria-labelledby="daily-era-stats-heading" class="flex flex-col gap-4">
        <h2 id="daily-era-stats-heading" class="text-[1.125rem] font-semibold">Your stats</h2>
        <dl class="grid grid-cols-4 gap-2 text-center">
            <!-- Value first on screen, label first in the markup, as a dl wants. -->
            <div v-for="tile in tiles" :key="tile.testid" class="flex flex-col-reverse">
                <dt class="text-xs text-muted-foreground">{{ tile.label }}</dt>
                <dd class="text-[1.5rem] font-bold tabular-nums" :data-testid="tile.testid">{{ tile.value }}</dd>
            </div>
        </dl>
        <div class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold">Guess distribution</h3>
            <ol class="flex flex-col gap-1">
                <li
                    v-for="(count, i) in stats.distribution"
                    :key="i"
                    class="flex items-center gap-2 text-sm tabular-nums"
                >
                    <span class="w-3 text-center">{{ i + 1 }}</span>
                    <div
                        data-testid="distribution-bar"
                        class="rounded-sm px-2 text-right text-xs font-semibold tabular-nums"
                        :class="i + 1 === attempts ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
                        :style="{ width: `${Math.max(8, (count / maxCount) * 100)}%` }"
                    >
                        {{ count }}
                    </div>
                </li>
            </ol>
        </div>
        <p v-if="archive" class="text-sm text-foreground/80">Archive games don't count toward your streak.</p>
    </section>
</template>
