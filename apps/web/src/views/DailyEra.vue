<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import PageShell from '@/layouts/PageShell.vue';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import SeasonPicker from '@/components/DailyEra/SeasonPicker.vue';
import GuessList from '@/components/DailyEra/GuessList.vue';
import DailyEraReveal from '@/components/DailyEra/DailyEraReveal.vue';
import DailyEraCredit from '@/components/DailyEra/DailyEraCredit.vue';
import DailyEraStats from '@/components/DailyEra/DailyEraStats.vue';
import DailyEraArchive from '@/components/DailyEra/DailyEraArchive.vue';
import DailyEraShare from '@/components/DailyEra/DailyEraShare.vue';
import { useDailyEra } from '@/composables/useDailyEra';
import { useDateFormat } from '@/composables/useDateFormat';
import { parseIsoDate, toIsoDate } from '@/utils/date';
import { DAILY_ERA_MAX_ATTEMPTS, isArchiveDay, seasonLabel } from '@/utils/dailyEra';

// Destructured so the template sees top-level refs; it doesn't unwrap refs
// nested in a plain object.
const {
    status,
    puzzle,
    guesses,
    answer,
    submitting,
    attemptsLeft,
    date,
    today,
    archive,
    games,
    stats,
    load,
    guess,
} = useDailyEra();

const route = useRoute();
const router = useRouter();
const { formatDate } = useDateFormat();
const selected = ref<number | null>(null);
const heading = ref<HTMLHeadingElement | null>(null);

const start = (day: string) => {
    selected.value = null;
    load(day);
};

// For a switch of game after the first: picking a day from the archive below
// would otherwise leave the new game off-screen, and the control that was
// used may unmount and drop keyboard focus.
const showGame = () => {
    window.scrollTo({ top: 0 });
    heading.value?.focus({ preventScroll: true });
};

// The page is reused when only the query changes, so it watches the query
// rather than loading on mount. A date that isn't in the archive (today,
// the future, junk) is rewritten to plain /daily, which fires this again.
let firstRun = true;
watch(
    () => route.query.date,
    (raw) => {
        const now = toIsoDate(new Date());
        const day = raw === undefined ? now : typeof raw === 'string' && isArchiveDay(raw, now) ? raw : null;
        if (day === null) {
            router.replace({ name: 'dailyEra' });
            return;
        }
        start(day);
        // Cleared only once a game starts: the rewrite of an unplayable
        // first date is still the page's first load.
        if (!firstRun) showGame();
        firstRun = false;
    },
    { immediate: true },
);

const retry = () => start(date.value);
// On plain /daily (a game that ran past midnight) there is no route change to
// make, so this loads the new day itself.
const playToday = () => {
    if (route.query.date !== undefined) {
        router.push({ name: 'dailyEra' });
        return;
    }
    start(toIsoDate(new Date()));
    showGame();
};

const viewingArchive = computed(() => !!date.value && date.value !== today.value);
// Only today's daily game has a streak to brag about: the stored games don't
// keep what the streak was on an earlier day.
const shareStreak = computed(() =>
    !archive.value && date.value === today.value ? stats.value.currentStreak : null,
);
const dateLabel = computed(() => {
    const parsed = parseIsoDate(date.value);
    return parsed ? formatDate(parsed, 'medium') : '';
});

const submit = async () => {
    if (selected.value === null) return;
    // A failed guess keeps the pick, so "Try again" is one tap.
    if (await guess(selected.value)) selected.value = null;
};
</script>

<template>
    <PageShell width="narrow">
        <div class="flex flex-col gap-6">
            <!-- A narrow game column inside the narrow shell, as in NotFound.vue. -->
            <Card class="mx-auto flex w-full max-w-[40rem] flex-col gap-5 p-4 sm:p-8">
                <header class="flex flex-col gap-1">
                    <h1 ref="heading" tabindex="-1" class="text-[2rem] font-bold">Which Era?</h1>
                    <p class="text-sm text-foreground/60">
                        <template v-if="puzzle">Daily #{{ puzzle.puzzleNumber }} · </template>
                        <template v-if="viewingArchive && dateLabel">{{ dateLabel }} · </template>
                        Guess the season this jersey was worn
                    </p>
                    <!-- The archive list leaves today out, so this is the way back
                         mid-game. A link from an archive date; a button on plain
                         /daily after midnight, where a link to /daily would be a
                         same-route no-op. -->
                    <RouterLink
                        v-if="viewingArchive && route.query.date !== undefined"
                        :to="{ name: 'dailyEra' }"
                        data-testid="today-link"
                        class="self-start rounded-sm text-sm text-primary-strong underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        Back to today's puzzle
                    </RouterLink>
                    <button
                        v-else-if="viewingArchive"
                        type="button"
                        data-testid="today-link"
                        class="cursor-pointer self-start rounded-sm text-sm text-primary-strong underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        @click="playToday"
                    >
                        Back to today's puzzle
                    </button>
                </header>

                <p v-if="status === 'loading'" class="text-foreground/80">
                    {{ viewingArchive ? 'Loading the jersey…' : "Loading today's jersey…" }}
                </p>

                <p v-else-if="status === 'unavailable'">
                    {{ viewingArchive ? 'No puzzle for this day.' : 'No puzzle today. Check back tomorrow.' }}
                </p>

                <div v-else-if="status === 'error'" class="flex flex-col items-start gap-3">
                    <p>{{ viewingArchive ? "Couldn't load this puzzle." : "Couldn't load today's puzzle." }}</p>
                    <Button @click="retry">Try again</Button>
                </div>

                <template v-else-if="status === 'playing' && puzzle">
                    <div class="flex flex-col gap-2">
                        <div class="aspect-[5/4] overflow-hidden rounded-md bg-foreground/5">
                            <img
                                class="size-full object-contain"
                                :src="puzzle.imageUrl"
                                :alt="viewingArchive ? 'The mystery jersey' : `Today's mystery jersey`"
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
                        <p class="text-center text-sm text-foreground/80">
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
                        @next="playToday"
                    />
                    <DailyEraShare
                        :key="date"
                        :puzzle-number="puzzle.puzzleNumber"
                        :guesses="guesses"
                        :image-url="puzzle.imageUrl"
                        :date="date"
                        :archive="viewingArchive || archive"
                        :streak="shareStreak"
                    />
                    <DailyEraStats
                        :stats="stats"
                        :attempts="status === 'won' ? guesses.length : null"
                        :archive="archive"
                    />
                </template>

                <div v-else-if="status === 'expired'" class="flex flex-col items-start gap-3">
                    <GuessList v-if="guesses.length" :guesses="guesses" :max-attempts="DAILY_ERA_MAX_ATTEMPTS" />
                    <p>This puzzle is no longer playable.</p>
                    <Button @click="playToday">Play today's puzzle</Button>
                </div>
            </Card>

            <DailyEraArchive v-if="today" :games="games" :today="today" :current="date" />
        </div>
    </PageShell>
</template>
