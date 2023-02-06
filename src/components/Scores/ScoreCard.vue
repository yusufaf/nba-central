<script setup lang="tsx">
import { h, ref, computed } from 'vue'
import { useQuasar } from 'quasar';
import {
    HOME,
    HOME_C,
    AWAY,
    AWAY_C
} from "@/constants/constants";
import LineScore from './LineScore.vue';
import TeamDetailsTooltip from './TeamDetailsTooltip.vue';

/* Resource: https://dmitripavlutin.com/props-destructure-vue-composition/ */
const props = defineProps<{
    game: any
    index: number,
    gameTeams: any,
}>()

const tooltipInfo = ref("");
const tooltipData = ref<any>(null);

const shortName = computed(() => props.game.shortName);
const gameTeamsSorted = computed(() => {
    /* Ensure away team shows up on top */
    const currentTeams = [...props.gameTeams[props.index]];
    return currentTeams.sort((a: any, b: any) => {
        return (a.homeAway > b.homeAway) ? 1 : ((b.homeAway > a.homeAway) ? -1 : 0)
    })
});

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
});

const isGameDone = computed(() => {
    const statusInfo = props.game.status.type;
    return statusInfo.completed;
})

console.log(isGameDone.value)

const statusString = computed(() => {
    const statusInfo = props.game.status;
    const { clock, displayClock, period } = statusInfo;
    console.log({ clock, displayClock, period });
    return "";
})

const getRecordDetailsTooltip = (competitor: any) => {
    console.log(competitor, competitor.team)
    const { homeAway, id } = competitor;
    const teamURL = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${id}`;

    let recordDetails = "";

    fetch(teamURL, {
        method: 'GET',
    })
        .then(response => {
            response.json().then(res => {
                tooltipData.value = res.team;

                console.log("Team Details response = ", { res });
                /* TODO: Could maybe do find() or filter() for these properties and ensure that you're accessing the right value */
                const { team } = res;
                const { record, standingSummary } = team;
                recordDetails += `${standingSummary}\n`;
                const [overallRecord, homeRecord, awayRecord] = record.items;

                const { stats: overallRecordStats } = overallRecord

                /* Streak */
                const streak = overallRecordStats[14].value;
                recordDetails += streak >= 0 ? `Streak: W${streak}\n` : `Streak: L${streak.toString().replace("-", "")}\n`;

                /* Playoff Seed */
                const playoffSeed = overallRecordStats[10].value;
                recordDetails += `Seed: ${playoffSeed}\n`;

                /* Overall and Home/Away Win % */
                const overallWinPercent = +Number(overallRecordStats[16].value * 100).toFixed(1);
                recordDetails += `Overall Win Pct: ${overallWinPercent}%\n`;

                /* Parse out the home/away win percentage from data, append to record details */
                const homeAwayPrefix = homeAway === HOME ? HOME_C : AWAY_C;
                const recordToCheck = homeAway === HOME ? homeRecord : awayRecord;
                const homeAwayWinPercent = +Number(recordToCheck.stats[3].value * 100).toFixed(1);
                recordDetails += `${homeAwayPrefix} Win Pct: ${homeAwayWinPercent}%\n`;

                /* Games Behind 1st */
                const gamesBehind = overallRecordStats[6].value;
                recordDetails += `Games Behind 1st: ${gamesBehind} \n`;

                /* Point Differential */
                const pointDifferential = +Number(overallRecordStats[4].value).toFixed(2);
                recordDetails += `Point Differential: ${pointDifferential}\n`

                tooltipInfo.value = recordDetails;
            });
        })
        .catch(err => {
            console.error(err);
        });
}

const $q = useQuasar();

const toggleGameNotification = () => {

    $q.notify({
        message: 'Jim pinged you.',
        caption: '5 minutes ago',
        color: 'secondary'
    })
}

const homeLeaderData = computed(() => {
    const currentTeams = props.gameTeams[props.index];
    const leaders = currentTeams[0].leaders;
    const ratingLeader = leaders[3];
    return ratingLeader;
})

const homeLeaderPlayer = computed(() => {
    return homeLeaderData.value.athlete;
})

const homeLeaderName = computed(() => {
    return homeLeaderData.value.shortName;
})

const homeLeaderStatline = computed(() => {
    return homeLeaderData.value.displayValue;
})

/* Away Player w/ best rating */
const awayLeaderData = computed(() => {
    const currentTeams = props.gameTeams[props.index];
    const leaders = currentTeams[1].leaders;
    const ratingLeader = leaders[3];
    return ratingLeader;
})

const awayLeaderPlayer = computed(() => {
    return awayLeaderData.value.athlete;
})

const awayLeaderName = computed(() => {
    return homeLeaderData.value.shortName;
})

const awayLeaderStatline = computed(() => {
    return awayLeaderData.value.displayValue;
})


</script>

<template>
    <q-card dark class="score-card" bordered :key="game.uid">
        <q-card-section class="card-header">
            <h6>{{ shortName }}</h6>
            <!-- Toggled styling here ==> notifications vs notifications active -->
            <!-- v-if="!isGameDone" -->
            <q-btn @click="toggleGameNotification" class="notification-bell" flat round icon="notifications"
                title="Notify me about the game" />
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
                    <div v-on:mouseenter="getRecordDetailsTooltip(competitor)">
                        <span>{{ getRecordString(competitor.records, competitor.homeAway) }}</span>
                        <TeamDetailsTooltip
                            :data="tooltipData"
                            v-if="tooltipData"
                        />
                        <!-- <q-tooltip anchor="center right" self="bottom middle" :offset="[10, 10]">
                            <div class="tooltip-info">
                                {{ tooltipInfo }}
                            </div>
                        </q-tooltip> -->
                    </div>
                </div>
                <LineScore :team="competitor" />
                <!-- {{ getLineScore(competitor) }} -->
                <!-- <div>{{ [...Array(competitor.linescores.length).keys()].map( i => i+1) }}</div> -->
                <div class="score">{{ competitor.score }}</div>
            </div>
        </q-card-section>
        <q-separator dark />
        <q-card-section class="leaders">
            <!-- Leader 1 -->
            <div>
                {{ homeLeaderStatline }}
            </div>
            <!-- Leader 2 -->
            <div>
                {{ awayLeaderStatline }}
            </div>
        </q-card-section>
        <q-card-actions>
        </q-card-actions>
    </q-card>
</template>

<style scoped>
.score-card {
    height: 20rem;
}

.card-header {
    display: flex;
    align-items: center;
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

.tooltip-info {
    white-space: pre-line;
    font-size: 0.7rem;
}

.notification-bell {
    animation: ring 4s .7s ease-in-out;
    transform-origin: 50% 1px;
}

@keyframes ring {
    0% {
        transform: rotate(0);
    }

    1% {
        transform: rotate(30deg);
    }

    3% {
        transform: rotate(-28deg);
    }

    5% {
        transform: rotate(34deg);
    }

    7% {
        transform: rotate(-32deg);
    }

    9% {
        transform: rotate(30deg);
    }

    11% {
        transform: rotate(-28deg);
    }

    13% {
        transform: rotate(26deg);
    }

    15% {
        transform: rotate(-24deg);
    }

    17% {
        transform: rotate(22deg);
    }

    19% {
        transform: rotate(-20deg);
    }

    21% {
        transform: rotate(18deg);
    }

    23% {
        transform: rotate(-16deg);
    }

    25% {
        transform: rotate(14deg);
    }

    27% {
        transform: rotate(-12deg);
    }

    29% {
        transform: rotate(10deg);
    }

    31% {
        transform: rotate(-8deg);
    }

    33% {
        transform: rotate(6deg);
    }

    35% {
        transform: rotate(-4deg);
    }

    37% {
        transform: rotate(2deg);
    }

    39% {
        transform: rotate(-1deg);
    }

    41% {
        transform: rotate(1deg);
    }

    43% {
        transform: rotate(0);
    }

    100% {
        transform: rotate(0);
    }
}

.leaders {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
}

</style>
