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
const AWAY = "away";
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

const getLineScore = (team: any) => {
    /* One div for => 1 2 3 4 (OT) T */
    const { linescores, score } = team;

    return () => [
        h('div'),
        h('div'),
        h('div')
    ]
}

</script>

<template>
    <q-card dark class="score-card" bordered :key="game.uid">
        <q-card-section>
            <h6>{{ shortName }}</h6>
        </q-card-section>
        <q-separator />
        <q-card-section>
            <!-- TODO: Subsection component where you pass in gameTeams[index] 
                    - Sort the data to make sure its Away team on top
                        
                    -->
            <div class="team-row" v-for="competitor in gameTeamsSorted" :key="competitor.id">
                <!-- content -->
                <img class="team-logo" :src="competitor.team.logo" />
                <div class="team-info">
                    <div>{{ competitor.team.displayName }}</div>
                    <div>{{ getRecordString(competitor.records, competitor.homeAway) }}</div>
                </div>
                <LineScore :team="competitor"/>
                <!-- {{ getLineScore(competitor) }} -->
                <!-- <div>{{ [...Array(competitor.linescores.length).keys()].map( i => i+1) }}</div> -->
                <div class="score">{{ competitor.score }}</div>
            </div>
        </q-card-section>

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

.team-logo {
    height: 2.5rem;
    width: 2.5rem;
}

.score {
    font-weight: 600;
    font-size: 1.5rem;
    margin-left: auto;
}
</style>
