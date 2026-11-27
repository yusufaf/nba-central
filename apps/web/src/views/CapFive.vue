<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import PageShell from '@/layouts/PageShell.vue';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import CapFiveCandidates from '@/components/CapFive/CapFiveCandidates.vue';
import CapFiveLineup from '@/components/CapFive/CapFiveLineup.vue';
import CapFiveResult from '@/components/CapFive/CapFiveResult.vue';
import CapFiveCredit from '@/components/CapFive/CapFiveCredit.vue';
import CapFiveShare from '@/components/CapFive/CapFiveShare.vue';
import CapFiveStats from '@/components/CapFive/CapFiveStats.vue';
import CapFiveArchive from '@/components/CapFive/CapFiveArchive.vue';
import { useCapFive } from '@/composables/useCapFive';
import { useDateFormat } from '@/composables/useDateFormat';
import { CAP_FIVE_LINEUP_SIZE } from '@/constants/capFive';
import { parseIsoDate, toIsoDate } from '@/utils/date';
import type { CapFiveCandidateView } from '@/models/api';

// Destructured so the template sees top-level refs.
const { status, puzzle, picks, result, archive, submitting, date, today, games, stats, load, toggle, submit } =
    useCapFive();

const route = useRoute();
const router = useRouter();
const { formatDate } = useDateFormat();
const heading = ref<HTMLHeadingElement | null>(null);

// For a switch of game after the first, as in DailyEra.vue: picking a day
// from the archive below would otherwise leave the new game off-screen, and
// the control that was used may unmount and drop keyboard focus.
const showGame = () => {
    window.scrollTo({ top: 0 });
    heading.value?.focus({ preventScroll: true });
};

// The page is reused when only the query changes, so it watches the query
// rather than loading on mount. Any earlier date goes to the server, which
// judges the window (a 410 shows "no longer playable"). Today, the future and
// junk are rewritten to plain /cap-five, which fires this again.
let firstRun = true;
watch(
    () => route.query.date,
    (raw) => {
        // The route changes a moment before a navigation away unmounts this
        // view; another page's ?date= is not a Cap Five day.
        if (route.name !== 'capFive') return;
        const now = toIsoDate(new Date());
        const day =
            raw === undefined ? now : typeof raw === 'string' && parseIsoDate(raw) && raw < now ? raw : null;
        if (day === null) {
            router.replace({ name: 'capFive' });
            return;
        }
        load(day);
        // Cleared only once a game starts: the rewrite of an unplayable
        // first date is still the page's first load.
        if (!firstRun) showGame();
        firstRun = false;
    },
    { immediate: true },
);

const retry = () => load(date.value);
// On plain /cap-five (a lineup locked in past midnight) there is no route
// change to make, so this loads the new day itself.
const playToday = () => {
    if (route.query.date !== undefined) {
        router.push({ name: 'capFive' });
        return;
    }
    load(toIsoDate(new Date()));
    showGame();
};

const viewingArchive = computed(() => !!date.value && date.value !== today.value);
const dateLabel = computed(() => {
    const parsed = parseIsoDate(date.value);
    return parsed ? formatDate(parsed, 'medium') : '';
});

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
        <div class="flex flex-col gap-6">
            <!-- A narrow game column inside the narrow shell, as in DailyEra.vue. -->
            <Card class="mx-auto flex w-full max-w-[40rem] flex-col gap-5 p-4 sm:p-8">
                <header class="flex flex-col gap-1">
                    <h1 ref="heading" tabindex="-1" class="text-[2rem] font-bold">Cap Five</h1>
                    <p class="text-sm text-foreground/60">
                        <template v-if="puzzleNumber">Daily #{{ puzzleNumber }} · </template>
                        <template v-if="viewingArchive && dateLabel">{{ dateLabel }} · </template>
                        Pick five. Stay under the cap. Ratings stay hidden until you lock in.
                    </p>
                    <!-- The archive list leaves today out, so this is the way back
                         mid-game. A link from an archive date; a button on plain
                         /cap-five after midnight, where a link to /cap-five would be
                         a same-route no-op. -->
                    <RouterLink
                        v-if="viewingArchive && route.query.date !== undefined"
                        :to="{ name: 'capFive' }"
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
                    {{ viewingArchive ? 'Loading the pool…' : "Loading today's pool…" }}
                </p>

                <p v-else-if="status === 'unavailable'">
                    {{ viewingArchive ? 'No puzzle for this day.' : 'No puzzle today. Check back tomorrow.' }}
                </p>

                <div v-else-if="status === 'error'" class="flex flex-col items-start gap-3">
                    <p>{{ viewingArchive ? "Couldn't load this puzzle." : "Couldn't load today's puzzle." }}</p>
                    <Button @click="retry">Try again</Button>
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
            <CapFiveArchive v-if="today" :games="games" :today="today" :current="date" />
        </div>
    </PageShell>
</template>
