<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch } from "vue";
import {
    VIEW_OPTIONS,
    VIEWS,
    EASTERN_TEAMS,
    WESTERN_TEAMS
} from "@/constants/constants";
import type { CustomizationKey } from "@/models/types";
import type { ESPNScoreboardResponse, ESPNEvent } from "@/models/types";
import ScoreCard from "@/components/Scores/ScoreCard.vue";
import PageTitle from "@/components/PageTitle.vue";
import PageShell from "@/layouts/PageShell.vue";
import GameReplaysWarning from "@/components/Scores/GameReplaysWarning.vue";
import ScoresEmptyState from "@/components/Scores/ScoresEmptyState.vue";
import { getScoresEmptyReason } from "@/utils/scoresEmptyState";
import ManageNotifications from "@/components/Scores/ManageNotifications.vue";
import { useGameNotifications } from "@/composables/useGameNotifications";
import { useScoresPreferences } from "@/composables/useScoresPreferences";
import { useScoresRouteState } from "@/composables/useScoresRouteState";
import { useCalendarGameCounts } from "@/composables/useCalendarGameCounts";
import { useDateFormat } from "@/composables/useDateFormat";
import { useResolvedTheme } from "@/composables/useDisplayPreferences";
import { isSameDay } from "@/utils/date";
import { getScoreboard, LIVE_SCORES_POLL_MS } from "@/network/scores";
import { shouldPollScoreboard } from "@/utils/scoresPolling";
import { latestScheduleDate } from "@/utils/season";
import OptionsMenu from "@/components/Scores/OptionsMenu.vue";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar as CalendarIcon, BellRing } from "lucide-vue-next";
import { DatePicker } from "v-calendar";
/* v-calendar's stylesheet is imported in main.ts so it lands at a predictable
   point in the cascade rather than wherever this route's chunk loads. */

const numGames = ref<number>(0);
const scoreData = ref<ESPNScoreboardResponse | null>(null);
/* Only "ready" may claim a day is empty: while loading or after a failure, gameData belongs to another date. */
const fetchStatus = ref<"loading" | "ready" | "error">("loading");

/* ==== Dates === */
const today = new Date();
const minDate = new Date("2000/01/01");
const maxDate = latestScheduleDate(today);

const { selectedDate, conferenceFilter, selectedView } = useScoresRouteState({
    minDate,
    maxDate,
    defaultDate: today,
});

const { gameCounts, loadMonths } = useCalendarGameCounts();

const calendarAttributes = computed(() => {
    const attrs: any[] = [];
    for (const [dateStr, count] of gameCounts.value.entries()) {
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        
        if (count === 0) {
            attrs.push({
                key: dateStr,
                dates: new Date(year, month, day),
                content: {
                    class: "opacity-40"
                },
                popover: {
                    label: "0 Games",
                    visibility: "hover",
                    hideIndicator: true
                }
            });
        } else {
            attrs.push({
                key: dateStr,
                dates: new Date(year, month, day),
                popover: {
                    label: `${count} Game${count !== 1 ? 's' : ''}`,
                    visibility: "hover",
                    hideIndicator: true
                }
            });
        }
    }
    return attrs;
});

const { formatDate } = useDateFormat();
const theme = useResolvedTheme();
const primaryDateString = computed(() => formatDate(selectedDate.value, "long"));

// const gameStatus = ref([] as any[]);
const gameData = ref<ESPNEvent[]>([]);
const games = ref<any[]>([]);
const gameTeams = ref<any[]>([]);

const showReplayConfirm = ref<boolean>(false);

const { preferences: scoresPreferences } = useScoresPreferences();
const hideScores = computed({
    get: () => scoresPreferences.value.hideScores,
    set: (value) => { scoresPreferences.value.hideScores = value; },
});
const hideFinishedGames = computed({
    get: () => scoresPreferences.value.hideFinishedGames,
    set: (value) => { scoresPreferences.value.hideFinishedGames = value; },
});

const handleConferenceFilterChange = (value: string | undefined) => {
    // Prevent deselection - keep current value if user clicks the selected item
    if (value === undefined || value === "") {
        return;
    }
    conferenceFilter.value = value;
};

const useShortNames = computed({
    get: () => scoresPreferences.value.useShortNames,
    set: (value) => { scoresPreferences.value.useShortNames = value; },
});
const notificationsMenuOpen = ref<boolean>(false);

const { notifyScoreChanges } = useGameNotifications();

/* Loads and polls finish after an await, which can be after the viewer has
   left the page. */
let isUnmounted = false;

/* A background poll leaves fetchStatus alone, so the empty state doesn't
   flicker on every refresh and a failed poll keeps the last good scores.
   Resolves to null when the viewer has picked another day or left the page
   meanwhile: a late answer must not replace the day now on screen. */
const fetchCurrentScores = async (forDate: Date, { background = false }: { background?: boolean } = {}) => {
    if (!background) fetchStatus.value = "loading";
    try {
        const data = await getScoreboard(forDate);
        if (isUnmounted || !isSameDay(forDate, selectedDate.value)) return null;
        const { events } = data;

        notifyScoreChanges(events ?? []);

        scoreData.value = data;
        numGames.value = events?.length || 0;
        gameData.value = events || [];

        const eventCompetitions = events?.map(
            (event) => event.competitions,
        ) || [];
        const eventCompetitors = eventCompetitions.map(
            (competition) => competition[0]?.competitors,
        );

        games.value = eventCompetitions;
        gameTeams.value = eventCompetitors;
        fetchStatus.value = "ready";

        return data;
    } catch (err) {
        if (!background && isSameDay(forDate, selectedDate.value)) fetchStatus.value = "error";
        console.error(err);
        throw err; // Rethrow the error to be caught by the caller
    }
};

/* ==== Actions Bar ==== */
const showReplayWarning = () => {
    showReplayConfirm.value = true;
};

const toggleNotificationsMenu = () => {
    notificationsMenuOpen.value = !notificationsMenuOpen.value;
};

const customizationState = computed(() => {
    const customizationMap: Map<CustomizationKey, any> = new Map();
    customizationMap.set("shortNames", useShortNames.value);
    customizationMap.set("hideScores", hideScores.value);
    return customizationMap;
});

/* ==== Conference Filter ==== */
const conferenceFilterOptions = [
    { label: "ALL", value: "ALL" },
    { label: "EAST", value: "EAST" },
    { label: "WEST", value: "WEST" },
    { label: "E v W", value: "CROSS" }
];

const getTeamConference = (teamDisplayName: string): "EAST" | "WEST" | null => {
    if (EASTERN_TEAMS.includes(teamDisplayName)) return "EAST";
    if (WESTERN_TEAMS.includes(teamDisplayName)) return "WEST";
    return null;
};

const getGameConferenceType = (game: ESPNEvent): "EAST" | "WEST" | "CROSS" | null => {
    const competitors = game.competitions[0]?.competitors;
    if (!competitors || competitors.length < 2) return null;

    const team1Conference = getTeamConference(competitors[0].team.displayName);
    const team2Conference = getTeamConference(competitors[1].team.displayName);

    if (!team1Conference || !team2Conference) return null;

    if (team1Conference === team2Conference) {
        return team1Conference;
    } else {
        return "CROSS";
    }
};

const filteredGameData = computed(() => {
    if (conferenceFilter.value === "ALL") {
        return gameData.value;
    }

    return gameData.value.filter((game) => {
        const gameType = getGameConferenceType(game);
        return gameType === conferenceFilter.value;
    });
});

const sortedGameData = computed(() => {
    // Flatten the game structure to make it compatible with ScoreCard expectations
    const gamesWithData = filteredGameData.value.map((game) => {
        const competition = game.competitions[0];
        // Create a flattened game object with competition data at the top level
        const flattenedGame = {
            ...game,
            status: competition?.status,
            competitors: competition?.competitors || [],
        };

        return {
            game: flattenedGame,
            competitors: competition?.competitors || [],
            conferenceType: getGameConferenceType(game),
        };
    });

    // Sort by game status: in-progress first, then scheduled, then finished
    return gamesWithData.sort((a, b) => {
        const aCompleted = a.game.status?.type.completed;
        const bCompleted = b.game.status?.type.completed;
        const aScheduled = a.game.status?.type.name === "STATUS_SCHEDULED";
        const bScheduled = b.game.status?.type.name === "STATUS_SCHEDULED";

        // In progress = started but not completed
        const aInProgress = !aScheduled && !aCompleted;
        const bInProgress = !bScheduled && !bCompleted;

        // In progress games first
        if (aInProgress && !bInProgress) return -1;
        if (!aInProgress && bInProgress) return 1;

        // Then scheduled games
        if (aScheduled && !bScheduled) return -1;
        if (!aScheduled && bScheduled) return 1;

        // Finally finished games (maintain original order)
        return 0;
    });
});

const displayedGamesCount = computed(() => filteredGameData.value.length);

const visibleGameData = computed(() =>
    hideFinishedGames.value
        ? sortedGameData.value.filter(({ game }) => !game.status?.type.completed)
        : sortedGameData.value,
);

const emptyReason = computed(() =>
    fetchStatus.value !== "ready"
        ? "none"
        : getScoresEmptyReason({
              totalGames: gameData.value.length,
              filteredGames: filteredGameData.value.length,
              visibleGames: visibleGameData.value.length,
          }),
);

let pollIntervalId: ReturnType<typeof setInterval> | null = null;

const stopScorePolling = () => {
    if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
    }
};

const refreshScores = async () => {
    const date = selectedDate.value;
    try {
        const data = await fetchCurrentScores(date, { background: true });
        if (data && !shouldPollScoreboard(data.events ?? [], date, new Date())) stopScorePolling();
    } catch {
        // fetchCurrentScores logged it; the next poll tries again.
    }
};

const startScorePolling = (events: ESPNEvent[], forDate: Date) => {
    stopScorePolling();
    if (isUnmounted || !shouldPollScoreboard(events, forDate, new Date())) return;
    pollIntervalId = setInterval(refreshScores, LIVE_SCORES_POLL_MS);
};

/* Stops the previous day's polling first, so a failed load can't leave it
   running against the new day. */
const loadDay = async (date: Date) => {
    stopScorePolling();
    try {
        const scoresData = await fetchCurrentScores(date);
        if (scoresData) startScorePolling(scoresData.events ?? [], date);
    } catch {
        // fetchCurrentScores logged it and set the error state.
    }
};

watch(selectedDate, (newDate, oldDate) => {
    // useScoresRouteState writes a default ?date= into the URL on mount,
    // which re-derives selectedDate as a new Date instance for the same
    // calendar day - skip the refetch when nothing actually changed.
    if (oldDate && isSameDay(newDate, oldDate)) return;
    loadDay(newDate);
});

onMounted(() => loadDay(selectedDate.value));

onUnmounted(() => {
    isUnmounted = true;
    stopScorePolling();
});
</script>

<template>
    <PageShell as="main" class="scores-page" flush>
        <div class="header">
            <div class="header-center">
                <PageTitle />
                <div class="gameday-container">
                    <h2 class="date">{{ primaryDateString }}</h2>
                    <Popover>
                        <PopoverTrigger as-child>
                            <Button variant="outline" size="icon" class="rounded-full">
                                <CalendarIcon class="h-5 w-5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent class="date-picker-popover w-auto p-0">
                            <DatePicker
                                v-model="selectedDate"
                                :max-date="maxDate"
                                :min-date="minDate"
                                mode="date"
                                color="orange"
                                :is-dark="theme === 'dark'"
                                borderless
                                :attributes="calendarAttributes"
                                @update:pages="loadMonths"
                            />
                        </PopoverContent>
                    </Popover>
                </div>
                <h2>{{ displayedGamesCount }} Games</h2>
            </div>
        </div>
        <div class="buttons">
            <ToggleGroup
                :model-value="conferenceFilter"
                @update:modelValue="(v) => handleConferenceFilterChange(v as string | undefined)"
                type="single"
                class="conference-toggle"
            >
                <ToggleGroupItem
                    v-for="option in conferenceFilterOptions"
                    :key="option.value"
                    :value="option.value"
                    class="conference-toggle-item"
                >
                    {{ option.label }}
                </ToggleGroupItem>
            </ToggleGroup>
            <div class="right-buttons">
                <Button
                    variant="outline"
                    size="icon"
                    class="rounded-full"
                    title="Manage Notifications"
                    @click="toggleNotificationsMenu"
                >
                    <BellRing class="h-5 w-5" />
                </Button>
                <OptionsMenu
                    v-model:hideScores="hideScores"
                    v-model:useShortNames="useShortNames"
                    v-model:hideFinishedGames="hideFinishedGames"
                />
                <ToggleGroup v-model="selectedView" type="single" class="view-toggle">
                    <ToggleGroupItem
                        v-for="option in VIEW_OPTIONS"
                        :key="option.value"
                        :value="option.value"
                        class="view-toggle-item"
                    >
                        {{ option.label }}
                    </ToggleGroupItem>
                </ToggleGroup>
                <Button
                    @click="showReplayWarning"
                    variant="outline"
                    class="replay-link-btn"
                    title="Secret Link"
                >
                    GAME REPLAYS
                </Button>
            </div>
        </div>
        <ScoresEmptyState
            v-if="emptyReason !== 'none'"
            :reason="emptyReason"
            :conference-filter="conferenceFilter"
            :date-label="primaryDateString"
            @show-finished="hideFinishedGames = false"
            @show-all-conferences="conferenceFilter = 'ALL'"
        />
        <div
            v-else
            class="scores-container"
            :class="{ list: selectedView === VIEWS.LIST }"
        >
            <ScoreCard
                v-for="{ game, competitors, conferenceType } in visibleGameData"
                :key="game.uid"
                :game="game"
                :index="0"
                :gameTeams="[competitors]"
                :customizationState="customizationState"
                :conference-type="conferenceType"
            />
        </div>
        <GameReplaysWarning v-model:showReplayConfirm="showReplayConfirm" />
        <ManageNotifications
            v-model:notificationsMenuOpen="notificationsMenuOpen"
        />
    </PageShell>
</template>

<style scoped>
/* Horizontal gutters come from PageShell. */
.scores-page {
    padding-bottom: 2rem;
}

.header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 2rem;
}

.gameday-container {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.header-center {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

h2 {
    font-size: 2rem;
    font-weight: 600;
}

.date {
    color: hsl(var(--primary-strong));
    font-weight: 600;
    /* A fixed-width slot, centered text: the calendar button (and the popover
       anchored to it) stays put as the date changes. 16.2em fits the widest
       long date ("Wednesday, September 30, 2026" = 16.15em). The viewport cap (button +
       gap + margin) lets it wrap on a phone instead of overflowing. */
    width: min(16.2em, calc(100vw - 4rem));
    text-align: center;
}

.scores-container {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2rem;
}

.scores-container.list {
    grid-template-columns: unset;
}

/* Responsive breakpoints */
@media (max-width: 1400px) {
    .scores-container {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1.5rem;
    }
}

@media (max-width: 900px) {
    .scores-container {
        grid-template-columns: 1fr;
        gap: 1rem;
    }

    h2 {
        font-size: 1.5rem;
    }

    .buttons {
        flex-direction: column;
        align-items: stretch;
        gap: 0.75rem;
    }

    .right-buttons {
        justify-content: space-between;
    }

    .conference-toggle {
        width: 100%;
    }

    .conference-toggle-item {
        flex: 1;
    }
}

@media (max-width: 640px) {
    .header-center {
        gap: 0.5rem;
    }

    h2 {
        font-size: 1.25rem;
    }

    .date {
        font-size: 1.25rem;
    }

    .gameday-container {
        gap: 0.5rem;
    }

    .view-toggle {
        display: none;
    }

    .replay-link-btn {
        display: none;
    }
}

::-webkit-scrollbar {
    display: none;
}

.team-row {
    display: flex;
    flex-direction: row;
    align-items: center;
}

.team-logo {
    height: 2.5rem;
    width: 2.5rem;
}

.score {
    font-weight: 600;
    font-size: 1.5rem;
    margin-left: auto;
}

.buttons {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    justify-content: space-between;
}

.right-buttons {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.conference-toggle {
    background-color: transparent;
    border: 0.0625rem solid hsl(var(--border));
    padding: 0;
    border-radius: 0.375rem;
}

.conference-toggle-item {
    min-width: 3.75rem;
    font-weight: 600;
    font-size: 0.875rem;
}

.conference-toggle-item[data-state="on"] {
    background-color: hsl(var(--accent));
    color: hsl(var(--accent-foreground));
    box-shadow: 0 0.0625rem 0.1875rem 0 hsl(var(--shadow-color) / 0.3);
}

.view-toggle {
    background-color: transparent;
    border: 0.0625rem solid hsl(var(--border));
    padding: 0;
    border-radius: 0.375rem;
}

.view-toggle-item {
    min-width: 5rem;
    font-weight: 600;
}

.view-toggle-item[data-state="on"] {
    background-color: hsl(var(--accent));
    color: hsl(var(--accent-foreground));
    box-shadow: 0 0.0625rem 0.1875rem 0 hsl(var(--shadow-color) / 0.3);
}

.replay-link-btn {
    font-weight: 600;
}

</style>
