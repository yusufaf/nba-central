<script setup lang="ts">
import { computed } from 'vue';
import type { CapFiveStats } from '@/utils/capFive';

const props = defineProps<{ stats: CapFiveStats; archive: boolean }>();

const tiles = computed(() => [
    { label: 'Played', value: props.stats.played, testid: 'stat-played' },
    { label: 'Perfect', value: props.stats.perfect, testid: 'stat-perfect' },
    { label: 'Streak', value: props.stats.currentStreak, testid: 'stat-streak' },
    { label: 'Best', value: props.stats.bestStreak, testid: 'stat-best' },
]);
</script>

<template>
    <section aria-labelledby="cap-five-stats-heading" class="flex flex-col gap-4">
        <h2 id="cap-five-stats-heading" class="text-[1.125rem] font-semibold">Your stats</h2>
        <dl class="grid grid-cols-4 gap-2 text-center">
            <!-- Value first on screen, label first in the markup, as a dl wants. -->
            <div v-for="tile in tiles" :key="tile.testid" class="flex flex-col-reverse">
                <dt class="text-xs text-muted-foreground">{{ tile.label }}</dt>
                <dd class="text-[1.5rem] font-bold tabular-nums" :data-testid="tile.testid">{{ tile.value }}</dd>
            </div>
        </dl>
        <p v-if="archive" class="text-sm text-foreground/80">A lineup locked in after its day doesn't count toward your streak.</p>
    </section>
</template>
