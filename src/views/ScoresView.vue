<script setup lang="ts">
import { onMounted, ref, computed, reactive } from 'vue'
import { ESPN_SCORES_URL } from "@/constants/constants";
import ScoreCard from '@/components/Scores/ScoreCard.vue';

/* Update scores every 5 mins */
const SCOREBOARD_TIMEOUT = 300000;

const numGames = ref(0)
const scoreData = ref({});

const date = ref(new Date());
const primaryDateString = date.value.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
const shortDateString = date.value.toLocaleDateString("en-us", { year: 'numeric', month: 'short', day: 'numeric' })

// const gameStatus = ref([] as any[]);
const gameData = ref<any[]>([]);
const games = ref<any[]>([]);
const gameTeams = ref<any[]>([]);

const showReplayConfirm = ref<boolean>(false);

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
                console.log({ eventCompetitors })
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

onMounted(() => {
    // TODO: setInterval() here?
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
        <div class="scores-container">
            <ScoreCard 
                v-for="(game, index) in gameData" 
                :key="game.uid" 
                :game="game" 
                :index="index"
                :gameTeams="gameTeams" 
            />
        </div>
        <q-btn @click="showReplayConfirm = true" outline color="primary" class="replay-link-btn" title="Secret Link">Game Replays</q-btn>
        <q-dialog v-model="showReplayConfirm">
            <q-card dark>
                <q-card-section class="row items-center">
                    <div>This will take you to an external website to access full game replays for today's slate of games, view at your own risk 🙂</div>
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

.score-card {
    height: 15rem;
}

.scores-container {
    display: grid;
    grid-template-columns: repeat(3, 35rem);
    gap: 2rem;
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

.replay-link-btn {
    position: absolute;
    top: 2rem;
}
</style>
