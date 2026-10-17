<script setup lang="ts">
import { onMounted, ref } from 'vue';
import PageShell from '@/layouts/PageShell.vue';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import SeasonPicker from '@/components/DailyEra/SeasonPicker.vue';
import GuessList from '@/components/DailyEra/GuessList.vue';
import DailyEraReveal from '@/components/DailyEra/DailyEraReveal.vue';
import DailyEraCredit from '@/components/DailyEra/DailyEraCredit.vue';
import { useDailyEra } from '@/composables/useDailyEra';
import { toIsoDate } from '@/utils/date';
import { DAILY_ERA_MAX_ATTEMPTS, seasonLabel } from '@/utils/dailyEra';

// Destructured so the template sees top-level refs; it doesn't unwrap refs
// nested in a plain object.
const { status, puzzle, guesses, answer, submitting, attemptsLeft, date, load, guess } = useDailyEra();

const today = () => toIsoDate(new Date());
const selected = ref<number | null>(null);

const reload = () => {
    selected.value = null;
    load(today());
};

const submit = async () => {
    if (selected.value === null) return;
    // A failed guess keeps the pick, so "Try again" is one tap.
    if (await guess(selected.value)) selected.value = null;
};

onMounted(reload);
</script>

<template>
    <PageShell width="narrow">
        <!-- A narrow game column inside the narrow shell, as in NotFound.vue. -->
        <Card class="mx-auto flex w-full max-w-[40rem] flex-col gap-5 p-4 sm:p-8">
            <header class="flex flex-col gap-1">
                <h1 class="text-[2rem] font-bold">Which Era?</h1>
                <p class="text-sm text-foreground/60">
                    <template v-if="puzzle">Daily #{{ puzzle.puzzleNumber }} · </template>
                    Guess the season this jersey was worn
                </p>
            </header>

            <p v-if="status === 'loading'" class="text-foreground/70">Loading today's jersey…</p>

            <p v-else-if="status === 'unavailable'">No puzzle today. Check back tomorrow.</p>

            <div v-else-if="status === 'error'" class="flex flex-col items-start gap-3">
                <p>Couldn't load today's puzzle.</p>
                <Button @click="reload">Try again</Button>
            </div>

            <template v-else-if="status === 'playing' && puzzle">
                <div class="flex flex-col gap-2">
                    <div class="aspect-[5/4] overflow-hidden rounded-md bg-foreground/5">
                        <img
                            class="size-full object-contain"
                            :src="puzzle.imageUrl"
                            alt="Today's mystery jersey"
                        />
                    </div>
                    <DailyEraCredit />
                </div>
                <GuessList :guesses="guesses" :max-attempts="DAILY_ERA_MAX_ATTEMPTS" />
                <SeasonPicker v-model:season="selected" :guessed="guesses" :disabled="submitting" />
                <div class="flex flex-col gap-2">
                    <Button
                        class="w-full"
                        :disabled="selected === null || submitting"
                        data-testid="guess-button"
                        @click="submit"
                    >
                        {{ selected === null ? 'Pick a season' : `Guess ${seasonLabel(selected)}` }}
                    </Button>
                    <p class="text-center text-sm text-foreground/70">
                        {{ attemptsLeft }} of {{ DAILY_ERA_MAX_ATTEMPTS }} guesses left
                    </p>
                </div>
            </template>

            <template v-else-if="(status === 'won' || status === 'lost') && puzzle">
                <GuessList :guesses="guesses" :max-attempts="DAILY_ERA_MAX_ATTEMPTS" />
                <DailyEraReveal
                    :answer="answer"
                    :solved="status === 'won'"
                    :attempts="guesses.length"
                    :fallback-image-url="puzzle.imageUrl"
                    :puzzle-number="puzzle.puzzleNumber"
                    :date="date"
                    @next="reload"
                />
            </template>

            <div v-else-if="status === 'expired'" class="flex flex-col items-start gap-3">
                <GuessList v-if="guesses.length" :guesses="guesses" :max-attempts="DAILY_ERA_MAX_ATTEMPTS" />
                <p>This puzzle is no longer playable.</p>
                <Button @click="reload">Play today's puzzle</Button>
            </div>
        </Card>
    </PageShell>
</template>
