<script setup lang="ts">
import { computed } from 'vue';
import { ArrowDown, ArrowUp } from 'lucide-vue-next';
import { seasonLabel, type DailyEraGuess } from '@/utils/dailyEra';

const props = defineProps<{ guesses: DailyEraGuess[]; maxAttempts: number }>();

// Fill versus outline keeps close and near apart: --warning and --primary are
// 3° of hue from each other. The outlines are the AA pairs on --card.
const CHIPS = {
    hit: { label: 'Correct', class: 'border border-success text-success' },
    close: { label: 'Within 3 seasons', class: 'bg-warning text-warning-foreground' },
    near: { label: 'Within 10 seasons', class: 'border border-primary-strong text-primary-strong' },
    far: { label: 'More than 10 away', class: 'bg-muted text-muted-foreground' },
} as const;

const chipFor = (guess: DailyEraGuess) => CHIPS[guess.hit ? 'hit' : guess.band];
const emptySlots = computed(() => Math.max(0, props.maxAttempts - props.guesses.length));
</script>

<template>
    <ol class="flex flex-col gap-2" aria-label="Your guesses">
        <li
            v-for="guess in guesses"
            :key="guess.season"
            data-testid="guess-row"
            class="flex min-h-10 items-center gap-3 rounded-md border border-border px-3 py-2"
        >
            <span class="min-w-20 whitespace-nowrap font-bold tabular-nums">{{ seasonLabel(guess.season) }}</span>
            <span
                class="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                :class="chipFor(guess).class"
            >
                {{ chipFor(guess).label }}
            </span>
            <span
                v-if="!guess.hit"
                class="ml-auto flex items-center gap-1 text-sm text-foreground/70"
            >
                <ArrowUp v-if="guess.direction === 'later'" class="size-4" aria-hidden="true" />
                <ArrowDown v-else class="size-4" aria-hidden="true" />
                {{ guess.direction === 'later' ? 'Later' : 'Earlier' }}
            </span>
        </li>
        <li
            v-for="n in emptySlots"
            :key="`slot-${n}`"
            data-testid="guess-slot"
            class="min-h-10 rounded-md border border-dashed border-border"
            aria-hidden="true"
        />
    </ol>
</template>
