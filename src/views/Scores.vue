<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { ESPN_SCORES_URL, VIEW_OPTIONS, VIEWS } from "@/constants/constants";
import type { CustomizationKey } from "@/constants/constants";
import ScoreCard from "@/components/Scores/ScoreCard.vue";
import PageTitle from "@/components/PageTitle.vue";
import GameReplaysWarning from "@/components/Scores/GameReplaysWarning.vue";
import ManageNotifications from "@/components/Scores/ManageNotifications.vue";
import OptionsMenu from "@/components/Scores/OptionsMenu.vue";

/* Update scores every 5 mins */
const SCOREBOARD_INTERVAL = 300000;

const numGames = ref<number>(0);
const scoreData = ref<any>({});

const date = ref(new Date());
const primaryDateString = date.value.toLocaleDateString("en-us", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
});

// const gameStatus = ref([] as any[]);
const gameData = ref<any[]>([]);
const games = ref<any[]>([]);
const gameTeams = ref<any[]>([]);

const showReplayConfirm = ref<boolean>(false);
const hideScores = ref<boolean>(false);
const hideFinishedGames = ref<boolean>(false);

const selectedView = ref<string>("Default");

const useShortNames = ref<boolean>(true);
const notificationsMenuOpen = ref<boolean>(false);

/* TODO: Set in localStorage?  */
const gamesWithNotifications = ref<Map<any, any>>(new Map());

/* TODO/IDEA:
- Notifications for score updates like Google?
- Discord through javascript somehow?

*/

const fetchCurrentScores = async () => {
    try {
        const response = await fetch(ESPN_SCORES_URL, {
            method: "GET",
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch data. Status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Response JSON = ", data);
        const { day, events } = data;

        scoreData.value = data;
        date.value = new Date(day.date);
        numGames.value = events.length;
        gameData.value = events;

        const eventCompetitions = events.map(
            (event: any) => event.competitions,
        );
        const eventCompetitors = eventCompetitions.map(
            (competition: any) => competition[0].competitors,
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

/* Computed Refs
- Not recommended to have computed refs based on other computed refs
*/

// const eventComps = computed(() => {
//     return gameData.value.map((event) => event.competitions);
// })

const customizationState = computed(() => {
    const customizationMap: Map<CustomizationKey, any> = new Map();
    customizationMap.set("shortNames", useShortNames.value);
    customizationMap.set("hideScores", hideScores.value);
    customizationMap.set("hideFinishedGames", hideFinishedGames.value);
    return customizationMap;
});

onMounted(async () => {
    const scoresData = await fetchCurrentScores();

    const events: any[] = scoresData.events ?? [];

    /* Determine if at least one game is not done */
    const isAnyGameNotDone = events.some((value) => {
        return !value.status.type.completed;
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
            <PageTitle />
            <h2 class="date">{{ primaryDateString }}</h2>
            <h2>{{ numGames }} Games</h2>
        </div>
        <div class="buttons">
            <q-btn
                round
                icon="edit_notifications"
                title="Manage Notifications"
                @click="toggleNotificationsMenu"
            >
            </q-btn>
            <OptionsMenu
                v-model:hideScores="hideScores"
                v-model:useShortNames="useShortNames"
                v-model:hideFinishedGames="hideFinishedGames"
            />
            <q-btn-toggle
                v-model="selectedView"
                toggle-color="primary"
                :options="VIEW_OPTIONS"
            />
            <q-btn
                @click="showReplayWarning"
                outline
                color="primary"
                class="replay-link-btn"
                title="Secret Link"
            >
                Game Replays
            </q-btn>
        </div>
        <div
            class="scores-container"
            :class="{ list: selectedView === VIEWS.LIST }"
        >
            <ScoreCard
                v-for="(game, index) in gameData"
                :key="game.uid"
                :game="game"
                :index="index"
                :gameTeams="gameTeams"
                :customizationState="customizationState"
                :hideScores="hideScores"
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
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin-bottom: 2rem;
}

h2 {
    font-size: 2rem;
    font-weight: 600;
}

.date {
    color: var(--q-primary);
}

.scores-container {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2rem;
}

.scores-container.list {
    grid-template-columns: unset;
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
    justify-content: right;
}
</style>
