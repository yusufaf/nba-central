<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Button } from '@/components/ui/button';
import RatingChip from '@/components/RatingChip.vue';
import CapFiveCredit from '@/components/CapFive/CapFiveCredit.vue';
import { averageRating } from '@/constants/ratings';
import { capFiveGrade, type CapFiveGrade } from '@/utils/capFive';
import { formatCountdown, nextPuzzleAt } from '@/utils/dailyEra';
import type { CapFiveResult } from '@/models/api';

const props = defineProps<{ result: CapFiveResult }>();
const emit = defineEmits<{ next: [] }>();

const GRADE_LABEL = {
    perfect: 'Perfect',
    close: 'Close',
    near: 'Near',
    far: 'Far',
    bust: 'Bust',
} satisfies Record<CapFiveGrade, string>;

const grade = computed(() => capFiveGrade(props.result));
const byId = computed(() => new Map(props.result.candidates.map((c) => [c.id, c])));
const optimalPlayers = computed(() => props.result.optimal.lineup.map((id) => byId.value.get(id)!).filter(Boolean));
const teamAverage = computed(() => averageRating(props.result.picks.map((id) => byId.value.get(id)?.rating)));

const target = computed(() => nextPuzzleAt(props.result.date).getTime());
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
</script>

<template>
    <section class="flex flex-col gap-4">
        <!-- Only the score is live: the countdown below ticks every second. -->
        <div class="flex flex-col gap-1" aria-live="polite" data-testid="cap-five-score">
            <p class="text-sm font-semibold uppercase tracking-wide" :class="grade === 'bust' ? 'text-destructive' : 'text-primary-strong'">
                {{ GRADE_LABEL[grade] }}
            </p>
            <p class="text-[2.5rem] font-bold leading-none tabular-nums">{{ result.total }} / {{ result.optimal.total }}</p>
            <p class="text-sm text-foreground/80">
                <template v-if="result.busted">{{ result.total }} is over the {{ result.cap }} cap</template>
                <template v-else>Perfect is {{ result.optimal.total }}</template>
                <template v-if="teamAverage !== null"> · Your average {{ teamAverage }}</template>
            </p>
        </div>
        <div class="flex flex-col gap-2">
            <h2 class="text-sm font-semibold">
                {{ result.optimal.count === 1 ? 'The one lineup' : `${result.optimal.count} lineups` }} hit {{ result.optimal.total }}, like this one
            </h2>
            <ul class="flex flex-col gap-1" data-testid="cap-five-optimal">
                <li v-for="player in optimalPlayers" :key="player.id" class="flex items-center justify-between gap-2 text-sm">
                    <span class="truncate">{{ player.name }}</span>
                    <RatingChip :rating="player.rating" />
                </li>
            </ul>
        </div>
        <CapFiveCredit :game-version="result.gameVersion" />
        <p v-if="msLeft > 0" class="text-sm text-foreground/80">
            Next puzzle in
            <span class="font-bold tabular-nums">{{ formatCountdown(msLeft) }}</span>
        </p>
        <Button v-else variant="outline" class="self-start" @click="emit('next')">
            Play today's puzzle
        </Button>
    </section>
</template>
