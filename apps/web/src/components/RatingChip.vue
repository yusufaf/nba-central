<script setup lang="ts">
import { computed } from 'vue';
import { ratingTier, type RatingTier } from '@/constants/ratings';

const props = defineProps<{ rating: number }>();

// The same bands and colours as AddPlayerDialog's rating chip.
const TIER_CLASS = {
    elite: 'text-rating-elite border-rating-elite/50 bg-rating-elite/12',
    great: 'text-rating-great border-rating-great/50 bg-rating-great/12',
    good: 'text-rating-good border-rating-good/50 bg-rating-good/12',
    average: 'text-muted-foreground border-muted-foreground/40 bg-muted-foreground/10',
} satisfies Record<RatingTier, string>;

const tierClass = computed(() => TIER_CLASS[ratingTier(props.rating)]);
</script>

<template>
    <span
        class="inline-flex min-w-[1.75rem] items-center justify-center rounded-sm border px-[0.3125rem] py-[0.0625rem] text-xs font-extrabold tabular-nums"
        :class="tierClass"
        data-testid="rating-chip"
    >{{ rating }}</span>
</template>
