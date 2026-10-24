<script setup lang="ts">
import { computed } from 'vue';
import RatingChip from '@/components/RatingChip.vue';
import { CAP_FIVE_LINEUP_SIZE } from '@/constants/capFive';
import { capFiveShortName } from '@/utils/capFive';
import type { CapFiveCandidateView, CapFiveResult } from '@/models/api';

const props = defineProps<{
    candidates: CapFiveCandidateView[];
    picks: string[];
    cap: number;
    result?: CapFiveResult | null;
}>();

const nameOf = computed(() => new Map(props.candidates.map((c) => [c.id, c.name])));
const ratingOf = computed(() => new Map(props.result?.candidates.map((c) => [c.id, c.rating]) ?? []));
// Each slot's full name, and the "K. Towns" its narrow column shows. Two
// picks that would share a short name keep their full names instead.
const slots = computed(() => {
    const filled = Array.from({ length: CAP_FIVE_LINEUP_SIZE }, (_, i) => {
        const id = props.picks[i];
        return id ? { id, full: nameOf.value.get(id) ?? 'Unknown player' } : null;
    });
    const shorts = filled.map((slot) => slot && capFiveShortName(slot.full));
    return filled.map((slot, i) =>
        slot && {
            ...slot,
            short: shorts.filter((s) => s === shorts[i]).length > 1 ? slot.full : shorts[i]!,
        },
    );
});
</script>

<template>
    <!-- @container: the switch to five columns follows the Text size setting,
         which a media query's rem ignores. -->
    <section aria-label="Your lineup" class="@container flex flex-col gap-2">
        <div class="flex items-baseline justify-between text-sm">
            <span class="font-semibold">Your five</span>
            <span class="tabular-nums text-foreground/80">
                <template v-if="result">Total {{ result.total }} · </template>
                Cap {{ cap }} · Picked {{ picks.length }}/{{ CAP_FIVE_LINEUP_SIZE }}
            </span>
        </div>
        <ol class="grid grid-cols-1 gap-1 @min-[34rem]:grid-cols-5">
            <li
                v-for="(slot, i) in slots"
                :key="i"
                data-testid="cap-five-slot"
                class="flex min-h-[2.5rem] min-w-0 items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm @min-[34rem]:flex-col @min-[34rem]:justify-center @min-[34rem]:text-center"
                :class="slot ? 'border-primary/60' : 'border-dashed border-border text-muted-foreground'"
                :title="slot?.full"
            >
                <!-- A row each has room for the full name; five columns
                     don't, so they get "K. Towns". -->
                <template v-if="slot">
                    <span class="max-w-full truncate @min-[34rem]:hidden">{{ slot.full }}</span>
                    <span class="hidden max-w-full truncate @min-[34rem]:block">{{ slot.short }}</span>
                </template>
                <span v-else class="max-w-full truncate">Pick a player</span>
                <RatingChip v-if="slot && ratingOf.has(slot.id)" :rating="ratingOf.get(slot.id)!" />
            </li>
        </ol>
    </section>
</template>
