<script setup lang="ts">
import { onMounted, ref } from 'vue'

// http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard

/* Update scores every 5 mins */
const SCORES_URL = "http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"
const SCOREBOARD_TIMEOUT = 300000;

const numGames = ref(0)
const scoreData = ref({});
const date = ref(new Date());
const dateString = date.value.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
const gameStatus = ref([]);

/* TODO/IDEA:
- Notifications for score updates like Google?
- Discord through javascript somehow?

*/

const fetchCurrentScores = () => {
    fetch(SCORES_URL, {
        method: 'GET',
    })
    .then(response => {
        response.json().then(res => {
            const { day, events} = res;
            scoreData.value = res;
            date.value = new Date(day.date);
            numGames.value = events.length;
            console.log("Response JSON = ", res);
        });
    })
    .catch(err => {
        console.error(err);
    });
}

onMounted(() => {
    // TODO: setInterval() here?
    fetchCurrentScores();
})

</script>

<template>
    <main class="scores-page">
        <div class="header">
            <h1 class="title">NBA Scoreboard</h1>
            <h2 class="date">{{ dateString }}</h2>
            <h2 class="">{{ numGames }} Games</h2>
        </div>
        <div class="scores-container">
            <q-card dark class="score-card" bordered :key="n" v-for="n in numGames">
                <q-card-section>
                    <h6>Player {{ n }}</h6>
                </q-card-section>
                <q-separator />
                <q-card-section>
                </q-card-section>

                <q-card-actions>
                </q-card-actions>
            </q-card>
        </div>
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
</style>
