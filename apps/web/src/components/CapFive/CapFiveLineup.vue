<script setup lang="ts">
import { computed } from 'vue';
import RatingChip from '@/components/RatingChip.vue';
import { CAP_FIVE_LINEUP_SIZE } from '@/constants/capFive';
import type { CapFiveCandidateView, CapFiveResult } from '@/models/api';

const props = defineProps<{
    candidates: CapFiveCandidateView[];
    picks: string[];
    cap: number;
    result?: CapFiveResult | null;
}>();

const nameOf = computed(() => new Map(props.candidates.map((c) => [c.id, c.name])));
const ratingOf = computed(() => new Map(props.result?.candidates.map((c) => [c.id, c.rating]) ?? []));
const slots = computed(() =>
    Array.from({ length: CAP_FIVE_LINEUP_SIZE }, (_, i) => props.picks[i] ?? null),
);
</script>

<template>
    <section aria-label="Your lineup" class="flex flex-col gap-2">
        <div class="flex items-baseline justify-between text-sm">
            <span class="font-semibold">Your five</span>
            <span class="tabular-nums text-foreground/80">
                <template v-if="result">Total {{ result.total }} · </template>
                Cap {{ cap }} · Picked {{ picks.length }}/{{ CAP_FIVE_LINEUP_SIZE }}
            </span>
        </div>
        <ol class="grid grid-cols-1 gap-1 sm:grid-cols-5">
            <li
                v-for="(id, i) in slots"
                :key="i"
                data-testid="cap-five-slot"
                class="flex min-h-[2.5rem] items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm sm:flex-col sm:justify-center sm:text-center"
                :class="id ? 'border-primary/60' : 'border-dashed border-border text-muted-foreground'"
            >
                <span class="truncate">{{ id ? nameOf.get(id) : 'Pick a player' }}</span>
                <RatingChip v-if="id && ratingOf.has(id)" :rating="ratingOf.get(id)!" />
            </li>
        </ol>
    </section>
</template>
