<script setup lang="tsx">
import { h, ref, computed } from 'vue'
import LineScore from './LineScore.vue';

/* Resource: https://dmitripavlutin.com/props-destructure-vue-composition/ */
const props = defineProps<{
    game: any
    index: number,
    gameTeams: any,
}>()

const shortName = computed(() => props.game.shortName);
const gameTeamsSorted = computed(() => {
    /* Ensure away team shows up on top */
    const currentTeams = [...props.gameTeams[props.index]];
    return currentTeams.sort((a: any, b: any) => {
        return (a.homeAway > b.homeAway) ? 1 : ((b.homeAway > a.homeAway) ? -1 : 0)
    })
});

const HOME = "home";
const HOME_C = "Home";
const AWAY = "away";
const AWAY_C = "Away";
const getRecordString = (teamRecords: any[], homeAway: string): string => {
    const [overallRecord, homeRecord, awayRecord] = teamRecords;
    let recordString = `(${overallRecord.summary}`;
    switch (homeAway) {
        case HOME: {
            recordString += `, ${homeRecord.summary} Home)`;
            break;
        }
        case AWAY: {
            recordString += `, ${awayRecord.summary} Away)`;
            break;
        }
    }
    return recordString;
}

const headerValues = computed(() => {
    const headerVals: any[] = [...Array(4).keys()].map(i => i + 1);
    headerVals.push("T");
    const currentTeams = props.gameTeams[props.index];
    const linescores = currentTeams[0].linescores;
    // console.log({ currentTeams, linescores });
    if (linescores.length > 4) {
        const index = 4;
        headerVals.splice(index, 0, "OT")
    }
    // console.log({ headerVals });
    return headerVals;
})

const isGameDone = computed(() => {
    const statusInfo = props.game.status.type;
    return statusInfo.completed;
})

const statusString = computed(() => {
    const statusInfo = props.game.status;
    const { clock, displayClock, period } = statusInfo;
    console.log({ clock, displayClock, period });
    return "";
})

const getRecordDetailsTooltip = (competitor: any) => {
    console.log(competitor, competitor.team)
    const {homeAway} = competitor;
    const { id } = competitor.team;
    const teamURL = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${id}`;

    let recordDetails = "";

    fetch(teamURL, {
        method: 'GET',
    })
    .then(response => {
        response.json().then(res => {
            console.log("Team Details response = ", {res})
            const {team} = res;
            const {record, standingSummary} = team;
            recordDetails += `${standingSummary}\n`;
            const [overallRecord, homeRecord, awayRecord] = record.items;
            
            /* Parse out the home/away win percentage from data, append to record details */
            const homeAwayPrefix = homeAway === HOME ? HOME_C : AWAY_C;
            const recordToCheck = homeAway === HOME ? homeRecord : awayRecord;
            const homeAwayWinPercent = +Number(recordToCheck.stats[3].value).toFixed(2) * 100;
            recordDetails += `${homeAwayPrefix} Win %: ${homeAwayWinPercent}%\n`;
            console.log("recordDetails is now = ", recordDetails);

        });
    })
    .catch(err => {
        console.error(err);
    });
    console.log({recordDetails})
    return recordDetails;
}


</script>

<template>
    <q-card dark class="score-card" bordered :key="game.uid">
        <q-card-section>
            <h6>{{ shortName }}</h6>
        </q-card-section>
        <q-separator dark />
        <q-card-section>
            <!-- TODO: Formatting / information to include when the game hasn't started -->
            <div class="card-heading">
                {{}}
            </div>
            <div class="line-score-heading">
                <template v-for="(heading, index) in headerValues" :key="index">
                    <div class="time-period" :class="{ total: index === headerValues.length - 1 }">{{ heading }}</div>
                </template>
            </div>

            <div class="team-row" :class="{ first: index === 0 }" v-for="(competitor, index) in gameTeamsSorted"
                :key="competitor.id">
                <!-- content -->
                <img class="team-logo" :src="competitor.team.logo" />
                <div class="team-info">
                    <div>{{ competitor.team.displayName }}</div>
                    <div>{{ getRecordString(competitor.records, competitor.homeAway) }}
                        <q-tooltip anchor="center right" self="bottom middle" :offset="[10, 10]">
                            {{ getRecordDetailsTooltip(competitor) }}
                        </q-tooltip>
                    </div>
                </div>
                <LineScore :team="competitor" />
                <!-- {{ getLineScore(competitor) }} -->
                <!-- <div>{{ [...Array(competitor.linescores.length).keys()].map( i => i+1) }}</div> -->
                <div class="score">{{ competitor.score }}</div>
            </div>
        </q-card-section>
        <q-separator dark />
        <q-card-actions>
        </q-card-actions>
    </q-card>
</template>

<style scoped>
.score-card {
    height: 15rem;
}

.scores-container {
    display: grid;
    grid-template-columns: repeat(3, 35rem);
    gap: 2rem;
}

.team-row {
    display: flex;
    flex-direction: row;
    align-items: center;
}

.team-row.first {
    margin-bottom: 0.5rem;
}

.team-logo {
    height: 2.5rem;
    width: 2.5rem;
}

.team-info {
    margin-left: 1rem;
}

.line-score-heading {
    display: flex;
    flex-direction: row;
    gap: 2rem;
    font-weight: 600;
    width: fit-content;
    margin-left: auto;
    margin-right: 8rem;
}

.time-period.total {
    display: flex;
    margin-left: auto;
}

.score {
    font-weight: 600;
    font-size: 1.5rem;
    margin-left: auto;
}

.score-column {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
</style>
