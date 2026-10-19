<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { Button } from '@/components/ui/button';
import DailyEraCredit from '@/components/DailyEra/DailyEraCredit.vue';
import { track } from '@/lib/analytics';
import { findHistoricalJersey } from '@/utils/historicalJersey';
import { DAILY_ERA_MAX_ATTEMPTS, formatCountdown, nextPuzzleAt } from '@/utils/dailyEra';
import type { DailyEraReveal } from '@/models/api';

const props = defineProps<{
    answer: DailyEraReveal | null;
    solved: boolean;
    attempts: number;
    fallbackImageUrl: string;
    puzzleNumber: number;
    /** The puzzle's local YYYY-MM-DD. */
    date: string;
}>();
const emit = defineEmits<{ next: [] }>();

// The bundled row gives the full, uncropped art and the builder link. Only a
// home/road jersey can be a puzzle, so anything else means a stale bundle.
const jersey = computed(() => {
    const row = props.answer && findHistoricalJersey(props.answer.shownIdentity.mediaId);
    return row && row.slot === 'home-road' ? row : undefined;
});

const target = computed(() => nextPuzzleAt(props.date).getTime());
const now = ref(Date.now());
const msLeft = computed(() => target.value - now.value);
let timer: ReturnType<typeof setInterval> | undefined;

const stopTimer = () => {
    clearInterval(timer);
    timer = undefined;
};

onMounted(() => {
    if (msLeft.value <= 0) return;
    timer = setInterval(() => {
        now.value = Date.now();
        if (msLeft.value <= 0) stopTimer();
    }, 1000);
});
onUnmounted(stopTimer);

const onBuilderClick = () => track('daily_era_builder_clicked', { puzzleNumber: props.puzzleNumber });
</script>

<template>
    <section class="flex flex-col gap-4">
        <!-- Only the result is live: the countdown below ticks every second. -->
        <div class="flex flex-col gap-4" aria-live="polite" data-testid="reveal-result">
            <h2 class="text-[1.125rem] font-semibold">
                {{ solved ? `Got it in ${attempts}/${DAILY_ERA_MAX_ATTEMPTS}` : 'Out of guesses' }}
            </h2>
            <div v-if="answer" class="flex flex-col gap-1">
                <p class="text-[1.5rem] font-bold tabular-nums">{{ answer.runLabel }}</p>
                <p class="text-foreground/80">{{ answer.teamName }}</p>
            </div>
        </div>
        <div class="overflow-hidden rounded-md bg-foreground/5">
            <img
                class="mx-auto max-h-[24rem] w-full object-contain"
                :src="jersey?.jersey ?? fallbackImageUrl"
                :alt="answer ? `${answer.teamName} jersey` : 'The puzzle\'s jersey'"
            />
        </div>
        <DailyEraCredit />
        <Button v-if="answer && jersey" as-child class="w-full sm:w-auto sm:self-start">
            <RouterLink
                :to="{ path: '/teambuilder', query: { jersey: answer.shownIdentity.mediaId } }"
                data-testid="builder-link"
                @click="onBuilderClick"
            >
                Build a team in this jersey
            </RouterLink>
        </Button>
        <p v-if="msLeft > 0" class="text-sm text-foreground/80">
            Next puzzle in
            <span class="font-bold tabular-nums">{{ formatCountdown(msLeft) }}</span>
        </p>
        <Button v-else variant="outline" class="self-start" @click="emit('next')">
            Play today's puzzle
        </Button>
    </section>
</template>
