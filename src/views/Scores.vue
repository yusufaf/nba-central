<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import {
    ESPN_SCORES_URL,
    VIEW_OPTIONS,
    VIEWS,
    EASTERN_TEAMS,
    WESTERN_TEAMS
} from "@/constants/constants";
import type { CustomizationKey } from "@/constants/constants";
import type { ESPNScoreboardResponse, ESPNEvent } from "@/models/types";
import ScoreCard from "@/components/Scores/ScoreCard.vue";
import PageTitle from "@/components/PageTitle.vue";
import GameReplaysWarning from "@/components/Scores/GameReplaysWarning.vue";
import ManageNotifications from "@/components/Scores/ManageNotifications.vue";
import OptionsMenu from "@/components/Scores/OptionsMenu.vue";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar as CalendarIcon, BellRing } from "lucide-vue-next";
import { DatePicker } from "v-calendar";
import "v-calendar/style.css";

const numGames = ref<number>(0);
const scoreData = ref<ESPNScoreboardResponse | null>(null);

/* ==== Dates === */
const originalDate = ref(new Date());
const startDate = new Date().toISOString().split("T")[0].replace(/-/g, "/");

const restrictOptions = (date: string) => {
    // TODO: Update to be earliest that data is available for
    return date >= "2000/01/01" && date <= startDate;
};

const date = ref(startDate);
const proxyDate = ref(startDate);

const primaryDateString = originalDate.value.toLocaleDateString("en-us", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
});

// const gameStatus = ref([] as any[]);
const gameData = ref<ESPNEvent[]>([]);
const games = ref<any[]>([]);
const gameTeams = ref<any[]>([]);

const showReplayConfirm = ref<boolean>(false);
const hideScores = ref<boolean>(false);
const hideFinishedGames = ref<boolean>(false);

const selectedView = ref<string>("Default");
const conferenceFilter = ref<string>("ALL");

const handleConferenceFilterChange = (value: string | undefined) => {
    // Prevent deselection - keep current value if user clicks the selected item
    if (value === undefined || value === "") {
        return;
    }
    conferenceFilter.value = value;
};

const useShortNames = ref<boolean>(true);
const notificationsMenuOpen = ref<boolean>(false);

/* TODO: Set in localStorage?  */
const gamesWithNotifications = ref<Map<any, any>>(new Map());

/* TODO/IDEA:
- Notifications for score updates like Google?
- Discord through javascript somehow?

*/

/* ==== Date Picker ==== */
const updateProxyDate = () => {
    proxyDate.value = date.value;
};

const saveDate = () => {
    date.value = proxyDate.value;
};

const fetchCurrentScores = async () => {
    try {
        const response = await fetch(ESPN_SCORES_URL, {
            method: "GET",
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch data. Status: ${response.status}`);
        }

        const data: ESPNScoreboardResponse = await response.json();
        console.log("Response JSON = ", data);
        const { day, events } = data;

        scoreData.value = data;
        originalDate.value = new Date(day?.date || new Date().toISOString());
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

        return data;
    } catch (err) {
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
    customizationMap.set("hideFinishedGames", hideFinishedGames.value);
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

onMounted(async () => {
    /* Update scores every 5 mins */
    const SCOREBOARD_INTERVAL = 300000;

    const scoresData = await fetchCurrentScores();

    const events: ESPNEvent[] = scoresData.events ?? [];

    /* Determine if at least one game is not done */
    const isAnyGameNotDone = events.some((event) => {
        return !event.competitions[0]?.status.type.completed;
    });

    if (isAnyGameNotDone) {
        setInterval(() => {
            fetchCurrentScores();
        }, SCOREBOARD_INTERVAL);
    }
});
</script>

<template>
    <main class="scores-page">
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
                        <PopoverContent class="w-auto p-0">
                            <DatePicker
                                v-model="date"
                                :max-date="new Date(startDate)"
                                :min-date="new Date('2000/01/01')"
                                mode="date"
                                @update:modelValue="saveDate"
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
                @update:modelValue="handleConferenceFilterChange"
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
        <div
            class="scores-container"
            :class="{ list: selectedView === VIEWS.LIST }"
        >
            <ScoreCard
                v-for="{ game, competitors, conferenceType } in sortedGameData"
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
    </main>
</template>

<style scoped>
.scores-page {
    padding: 0 4rem 2rem 4rem;
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
    color: hsl(var(--primary));
    font-weight: 600;
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

    .scores-page {
        padding: 0 2rem 2rem 2rem;
    }
}

@media (max-width: 900px) {
    .scores-container {
        grid-template-columns: 1fr;
        gap: 1rem;
    }

    .scores-page {
        padding: 0 1rem 1rem 1rem;
    }

    h2 {
        font-size: 1.5rem;
    }

    .buttons {
        flex-direction: column;
        align-items: stretch !important;
        gap: 0.75rem !important;
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
    border: 1px solid hsl(var(--border));
    padding: 0;
    border-radius: 0.375rem;
}

.conference-toggle-item {
    min-width: 60px;
    font-weight: 600;
    font-size: 0.875rem;
}

.conference-toggle-item[data-state="on"] {
    background-color: hsl(var(--accent));
    color: hsl(var(--accent-foreground));
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.3);
}

.view-toggle {
    background-color: transparent;
    border: 1px solid hsl(var(--border));
    padding: 0;
    border-radius: 0.375rem;
}

.view-toggle-item {
    min-width: 80px;
    font-weight: 600;
}

.view-toggle-item[data-state="on"] {
    background-color: hsl(var(--accent));
    color: hsl(var(--accent-foreground));
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.3);
}

.replay-link-btn {
    font-weight: 600;
}

/* Override button outlines to match theme */
:deep(button[variant="outline"]) {
    border-color: hsl(var(--border));
}

:deep(button[variant="outline"]:hover) {
    background-color: hsl(var(--accent) / 0.1);
}
</style>
