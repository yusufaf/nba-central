<script setup lang="ts">
import { onMounted, ref, computed, reactive } from 'vue'
import { ESPN_SCORES_URL, VIEW_OPTIONS, VIEWS } from "@/constants/constants";
import type { CustomizationKey } from "@/constants/constants";
import ScoreCard from '@/components/Scores/ScoreCard.vue';

/* Update scores every 5 mins */
const SCOREBOARD_TIMEOUT = 300000;

const numGames = ref<number>(0)
const scoreData = ref<any>({});

const date = ref(new Date());
const primaryDateString = date.value.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
const shortDateString = date.value.toLocaleDateString("en-us", { year: 'numeric', month: 'short', day: 'numeric' })

// const gameStatus = ref([] as any[]);
const gameData = ref<any[]>([]);
const games = ref<any[]>([]);
const gameTeams = ref<any[]>([]);

const showReplayConfirm = ref<boolean>(false);
const hideScores = ref<boolean>(false);
const selectedView = ref<string>("Default");

// const customizationState = ref<any>(new Map());
const useShortNames = ref<boolean>(true);

/* TODO/IDEA:
- Notifications for score updates like Google?
- Discord through javascript somehow?

*/

const fetchCurrentScores = () => {
    fetch(ESPN_SCORES_URL, {
        method: 'GET',
    })
        .then(response => {
            response.json().then(res => {
                const { day, events } = res;
                scoreData.value = res;
                /* Date and # of Games for Easy Access */
                date.value = new Date(day.date);
                numGames.value = events.length;
                gameData.value = events;
                const eventCompetitions = events.map((event: any) => event.competitions);
                const eventCompetitors = eventCompetitions.map((competition: any) => competition[0].competitors);
                games.value = eventCompetitions;
                gameTeams.value = eventCompetitors;
                console.log("Response JSON = ", res);
            });
        })
        .catch(err => {
            console.error(err);
        });
}

const navigateToReplays = () => {
    const search = encodeURI(shortDateString);
    const fullGameReplaysLink = `https://watchreplay.net/?s=${search}`
    window.open(fullGameReplaysLink, '_blank');
}

/* Computed Refs
- Not recommended to have computed refs based on other computed refs
*/

// const eventComps = computed(() => {
//     return gameData.value.map((event) => event.competitions);
// })

const customizationState = computed(() => {
    const customizationMap: Map<CustomizationKey, any> = new Map()
    customizationMap.set("shortNames", useShortNames.value);
    customizationMap.set("hideScores", hideScores.value);
    return customizationMap;
})


onMounted(() => {
    fetchCurrentScores();
    setInterval(() => {
        fetchCurrentScores();
    }, SCOREBOARD_TIMEOUT)
})

</script>

<template>
    <main class="scores-page">
        <div class="header">
            <h1 class="title">NBA Scoreboard</h1>
            <h2 class="date">{{ primaryDateString }}</h2>
            <h2 class="">{{ numGames }} Games</h2>
        </div>
        <div class="buttons">
            <q-btn round icon="more_vert" title="More">
                <q-menu dark transition-show="jump-down" transition-hide="jump-up">
                    <q-list>
                        <q-item>
                            <q-item-section>
                                <q-toggle v-model="hideScores" label="Hide Scores" />
                            </q-item-section>
                        </q-item>
                        <q-item>
                            <q-item-section>
                                <q-toggle v-model="useShortNames" label="Use Short Names" />
                            </q-item-section>
                        </q-item>
                        <q-separator />
                    </q-list>
                </q-menu>
            </q-btn>
            <q-btn-toggle v-model="selectedView" toggle-color="primary" :options="VIEW_OPTIONS" />
            <q-btn @click="showReplayConfirm = true" outline color="primary" class="replay-link-btn"
                title="Secret Link">Game Replays</q-btn>
        </div>
        <div class="scores-container" :class="{ list: selectedView === VIEWS.LIST }">
            <ScoreCard 
                v-for="(game, index) in gameData" 
                :key="game.uid" 
                :game="game" 
                :index="index"
                :gameTeams="gameTeams" 
                :customizationMap="customizationState"
            />
        </div>
        <q-dialog v-model="showReplayConfirm">
            <q-card dark>
                <q-card-section class="row items-center">
                    <div>This will take you to an external website to access full game replays for today's slate of
                        games, view at your own risk 🙂</div>
                </q-card-section>
                <q-card-actions align="right">
                    <q-btn flat label="Cancel" color="primary" v-close-popup />
                    <q-btn @click="navigateToReplays" flat label="Confirm" color="primary" v-close-popup />
                </q-card-actions>
            </q-card>
        </q-dialog>
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

.title {
    font-size: 3rem;
    margin-top: 2rem;
    font-weight: 600;
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
