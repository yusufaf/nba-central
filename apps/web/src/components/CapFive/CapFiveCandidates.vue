<script setup lang="ts">
import { computed } from 'vue';
import { Check, Star } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import RatingChip from '@/components/RatingChip.vue';
import { CAP_FIVE_LINEUP_SIZE } from '@/constants/capFive';
import { nbaPositions } from '@/constants/positions';
import type { CapFiveCandidateView, CapFiveResult } from '@/models/api';

const props = defineProps<{
    candidates: CapFiveCandidateView[];
    picks: string[];
    disabled?: boolean;
    /** Once locked in: every rating, the picks and the optimal lineup. */
    result?: CapFiveResult | null;
}>();

const emit = defineEmits<{ toggle: [id: string] }>();

const full = computed(() => props.picks.length >= CAP_FIVE_LINEUP_SIZE);
const ratingOf = computed(() => new Map(props.result?.candidates.map((c) => [c.id, c.rating]) ?? []));
const inOptimal = computed(() => new Set(props.result?.optimal.lineup ?? []));
const isPicked = (id: string) => props.picks.includes(id);
</script>

<template>
    <ul class="grid grid-cols-1 gap-2 sm:grid-cols-2" :aria-label="result ? 'Today\'s pool, rated' : 'Pick five players'">
        <li v-for="candidate in candidates" :key="candidate.id">
            <!-- Picking: toggle buttons. Revealed: the same rows, read-only. -->
            <component
                :is="result ? 'div' : 'button'"
                :type="result ? undefined : 'button'"
                :aria-pressed="result ? undefined : isPicked(candidate.id)"
                :disabled="result ? undefined : disabled || (full && !isPicked(candidate.id))"
                data-testid="cap-five-candidate"
                class="flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors"
                :class="[
                    isPicked(candidate.id) ? 'border-primary bg-primary/10' : 'border-border',
                    result
                        ? ''
                        : 'cursor-pointer hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                ]"
                @click="result ? undefined : emit('toggle', candidate.id)"
            >
                <span class="flex min-w-0 flex-1 flex-col gap-1">
                    <span class="flex items-center gap-1 truncate font-semibold">
                        {{ candidate.name }}
                        <Check v-if="isPicked(candidate.id)" class="size-4 shrink-0 text-primary" aria-label="Picked" />
                        <Star
                            v-if="result && inOptimal.has(candidate.id)"
                            class="size-4 shrink-0 text-rating-elite"
                            aria-label="In the perfect lineup"
                        />
                    </span>
                    <span class="flex flex-wrap gap-1">
                        <Badge v-for="position in nbaPositions(candidate.positions)" :key="position" variant="secondary">{{ position }}</Badge>
                        <!-- "legend" on the wire is a 2K All-Time or Classic team rating:
                             "Classic" is 2K's own word, and unlike "Retired" it's
                             still true of an active player missing from 2K's rosters. -->
                        <Badge variant="outline">{{ candidate.era === 'current' ? 'Current' : 'Classic' }}</Badge>
                    </span>
                </span>
                <RatingChip v-if="result && ratingOf.has(candidate.id)" :rating="ratingOf.get(candidate.id)!" />
            </component>
        </li>
    </ul>
</template>
