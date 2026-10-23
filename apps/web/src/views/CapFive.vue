<script setup lang="ts">
import { computed, onMounted } from 'vue';
import PageShell from '@/layouts/PageShell.vue';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import CapFiveCandidates from '@/components/CapFive/CapFiveCandidates.vue';
import CapFiveLineup from '@/components/CapFive/CapFiveLineup.vue';
import CapFiveResult from '@/components/CapFive/CapFiveResult.vue';
import CapFiveCredit from '@/components/CapFive/CapFiveCredit.vue';
import CapFiveShare from '@/components/CapFive/CapFiveShare.vue';
import CapFiveStats from '@/components/CapFive/CapFiveStats.vue';
import { useCapFive } from '@/composables/useCapFive';
import { CAP_FIVE_LINEUP_SIZE } from '@/constants/capFive';
import { toIsoDate } from '@/utils/date';
import type { CapFiveCandidateView } from '@/models/api';

// Destructured so the template sees top-level refs.
const { status, puzzle, picks, result, archive, submitting, date, today, stats, load, toggle, submit } =
    useCapFive();

const playToday = () => load(toIsoDate(new Date()));
onMounted(playToday);

// A stored day is shown without the GET, so its candidates come from the result.
const candidates = computed<CapFiveCandidateView[]>(
    () =>
        puzzle.value?.candidates ??
        result.value?.candidates.map(({ id, name, positions, ratingSource }) => ({
            id,
            name,
            positions,
            era: ratingSource === 'current' ? 'current' : 'legend',
        })) ??
        [],
);
const puzzleNumber = computed(() => puzzle.value?.puzzleNumber ?? result.value?.puzzleNumber);
const cap = computed(() => puzzle.value?.cap ?? result.value?.cap ?? 0);
const gameVersion = computed(() => puzzle.value?.gameVersion ?? result.value?.gameVersion ?? '');
const left = computed(() => CAP_FIVE_LINEUP_SIZE - picks.value.length);
// Only today's daily game has a streak to brag about.
const shareStreak = computed(() =>
    !archive.value && date.value === today.value ? stats.value.currentStreak : null,
);
</script>

<template>
    <PageShell width="narrow">
        <!-- A narrow game column inside the narrow shell, as in DailyEra.vue. -->
        <Card class="mx-auto flex w-full max-w-[40rem] flex-col gap-5 p-4 sm:p-8">
            <header class="flex flex-col gap-1">
                <h1 class="text-[2rem] font-bold">Cap Five</h1>
                <p class="text-sm text-foreground/60">
                    <template v-if="puzzleNumber">Daily #{{ puzzleNumber }} · </template>
                    Pick five. Stay under the cap. Ratings stay hidden until you lock in.
                </p>
            </header>

            <p v-if="status === 'loading'" class="text-foreground/80">Loading today's pool…</p>

            <p v-else-if="status === 'unavailable'">No puzzle today. Check back tomorrow.</p>

            <div v-else-if="status === 'error'" class="flex flex-col items-start gap-3">
                <p>Couldn't load today's puzzle.</p>
                <Button @click="load(date)">Try again</Button>
            </div>

            <template v-else-if="status === 'picking' && puzzle">
                <CapFiveLineup :candidates="candidates" :picks="picks" :cap="cap" />
                <CapFiveCandidates :candidates="candidates" :picks="picks" :disabled="submitting" @toggle="toggle" />
                <div class="flex flex-col gap-2">
                    <Button
                        class="w-full"
                        :disabled="left > 0 || submitting"
                        data-testid="lock-in-button"
                        @click="submit"
                    >
                        {{ left > 0 ? `Pick ${left} more` : 'Lock in lineup' }}
                    </Button>
                    <CapFiveCredit :game-version="gameVersion" />
                </div>
            </template>

            <template v-else-if="status === 'submitted' && result">
                <CapFiveLineup :candidates="candidates" :picks="picks" :cap="cap" :result="result" />
                <CapFiveResult :result="result" @next="playToday" />
                <!-- Keyed by streak too: the card is rendered once. -->
                <CapFiveShare :key="`${date}:${shareStreak}`" :result="result" :streak="shareStreak" />
                <CapFiveStats :stats="stats" :archive="archive" />
                <CapFiveCandidates :candidates="candidates" :picks="picks" :result="result" />
            </template>

            <div v-else-if="status === 'expired'" class="flex flex-col items-start gap-3">
                <p>This puzzle is no longer playable.</p>
                <Button @click="playToday">Play today's puzzle</Button>
            </div>
        </Card>
    </PageShell>
</template>
