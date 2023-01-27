<script setup lang="ts">
import { onMounted, ref, computed, reactive } from 'vue'

// http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard

/* Update scores every 5 mins */
const SCORES_URL = "http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"
const SCOREBOARD_TIMEOUT = 300000;

const numGames = ref(0)
const scoreData = ref({});

const date = ref(new Date());
const primaryDateString = date.value.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
const shortDateString = date.value.toLocaleDateString("en-us", { year: 'numeric', month: 'short', day: 'numeric' })

const gameStatus = ref([] as any[]);
const gameData = ref([] as any[]);
const games = ref([] as any[]);
const gameTeams = ref([] as any[]);

/* TODO/IDEA:
- Notifications for score updates like Google?
- Discord through javascript somehow?

*/

const getRecordString = (teamRecords: any[], homeAway: string) => {
    let recordString = `(${teamRecords[0].summary}`;
    if (homeAway === "home") {
        recordString += `, ${teamRecords[1].summary} Home)`;
    }
    else if (homeAway === "away") {
        recordString += `, ${teamRecords[2].summary} Away)`;
    }
    return recordString;
}

const fetchCurrentScores = () => {
    fetch(SCORES_URL, {
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

const testLink = () => {
    const search = encodeURI(shortDateString);
    console.log({ search, shortDateString });
    const testReplayLink = `https://watchreplay.net/?s=${search}`
    window.open(testReplayLink, '_blank');
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
            <!-- TODO: Can probably and should probably create ScoreCard component -->
            <q-card dark class="score-card" bordered :key="game.uid" v-for="(game, index) in gameData">
                <q-card-section>
                    <h6>{{ game.shortName }}</h6>
                </q-card-section>
                <q-separator />
                <q-card-section>
                    <!-- TODO: Subsection component where you pass in gameTeams[index] 
                    - Sort the data to make sure its Away team on top
                        
                    -->
                    <div class="team-row" v-for="competitor in [...gameTeams[index]].reverse()" :key="competitor.id">
                        <!-- content -->
                        <img class="team-logo" :src="competitor.team.logo" />
                        <div class="team-info">
                            <div>{{ competitor.team.displayName }}</div>
                            <div>{{ getRecordString(competitor.records, competitor.homeAway) }}</div>
                        </div>
                        <div>{{ competitor.linescores.map((line: any) => line.value).join(" ") }}</div>
                        <div class="score">{{ competitor.score }}</div>
                    </div>
                </q-card-section>

                <q-card-actions>
                </q-card-actions>
            </q-card>
        </div>
        <q-btn @click="testLink" outline color="primary" class="test-btn" title="Secret Link"> GAME REPLAYS </q-btn>
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

.test-btn {
    position: absolute;
    top: 2rem;
}
</style>
