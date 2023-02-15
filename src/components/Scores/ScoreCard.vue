<script setup lang="tsx">
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar';
import {
    HOME,
    HOME_C,
    AWAY,
    AWAY_C,
    GAME_STATUS,
    ZERO_CLOCK,
    NOTIFICATION_GRANTED,
    NOTIFICATION_DENIED
} from "@/constants/constants";
import LineScore from './LineScore.vue';
import TeamDetailsTooltip from './TeamDetailsTooltip.vue';

/* Resource: https://dmitripavlutin.com/props-destructure-vue-composition/ */
const props = defineProps<{
    game: any
    index: number,
    gameTeams: any,
    customizationMap: any,
}>();

const $q = useQuasar();

/* Refs */
const tooltipData = ref<any>(null);
const notificationPermission = ref<string>("");
const gameNotificationsMap = ref<any>(new Map());

/* Computed Refs */

const shortName = computed(() => props.game.shortName);
/*TODO: 
- Operating on the current date only until can figure out how to work with bkref to get previous games 
- Bkref doesn't do current scores, so might have to actually differentiate data betwene previous days and current day
    - ESPN/NBA.com - current day | bkref - previous days
*/
const gameDate = computed(() => props.game.date);
const gameTimeStart = computed(() => {
    const timeString = new Date(props.game.date).toLocaleTimeString(undefined,
        { hour: "2-digit", minute: "2-digit" }
    )
    return timeString;
});

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
    console.log({ currentTeams, linescores });
    if (linescores?.length > 4) {
        const index = 4;
        headerVals.splice(index, 0, "OT")
    }
    // console.log({ headerVals });
    return headerVals;
});

const gameStatusName = computed(() => props.game.status.type.name);
const gameNotStarted = computed(() => gameStatusName.value === GAME_STATUS.SCHEDULED);
const gameInProgress = computed(() => gameStatusName.value === GAME_STATUS.IN_PROGRESS)

const isGameDone = computed(() => {
    const statusInfo = props.game.status.type;
    return statusInfo.completed;
})

console.log({ isTheGameDone: isGameDone.value, thisGameData: props.game })


const gameClockString = computed(() => {
    const statusInfo = props.game.status;
    const { displayClock, period } = statusInfo;
    const clockString = `${displayClock} - ${period}Q`;

    if (period === 2 && displayClock === ZERO_CLOCK) {
        return "Halftime";
    }
    return clockString;
})

const namePropertyKey = computed(() => {
    const useShortNames: boolean = props.customizationMap.get("shortNames");
    // const keyToUse = useShortNames ? 
    // return keyToUse;
    return "";
})

const getRecordDetailsTooltip = (competitor: any): void => {
    const { id } = competitor;
    const teamURL = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${id}`;

    fetch(teamURL, {
        method: 'GET',
    })
        .then(response => {
            response.json().then(res => {
                tooltipData.value = res.team;
            });
        })
        .catch(err => {
            console.error(err);
        });
}




/* TODO:
- Figure out if there's a better way instead of the sequence of computed refs
*/
const homeLeaderData = computed(() => {
    const currentTeams = props.gameTeams[props.index];
    const leaders = currentTeams[0].leaders;
    const lastIndex = leaders.length - 1;
    const ratingLeader = leaders[lastIndex];
    /* Assuming there's only one leader per team */
    return ratingLeader.leaders[0];
})

const homeLeaderPlayer = computed(() => {
    return homeLeaderData.value.athlete;
})

const homeLeaderName = computed(() => {
    return homeLeaderPlayer.value.shortName;
})

const homeLeaderStatline = computed(() => {
    return homeLeaderData.value.displayValue;
})

const homeLeaderPosition = computed(() => {
    return homeLeaderPlayer.value.position.abbreviation;
})

const homeLeaderPicture = computed(() => {
    return homeLeaderPlayer.value.headshot;
})

/* Away Player w/ best rating */
const awayLeaderData = computed(() => {
    const currentTeams = props.gameTeams[props.index];
    const leaders = currentTeams[1].leaders;
    const lastIndex = leaders.length - 1;
    const ratingLeader = leaders[lastIndex];
    /* Assuming there's only one leader per team */
    return ratingLeader.leaders[0];
})

const awayLeaderPlayer = computed(() => {
    return awayLeaderData.value.athlete;
})

const awayLeaderName = computed(() => {
    return awayLeaderPlayer.value.shortName;
})

const awayLeaderPosition = computed(() => {
    return awayLeaderPlayer.value.position.abbreviation;
})

const awayLeaderStatline = computed(() => {
    return awayLeaderData.value.displayValue;
})

const awayLeaderPicture = computed(() => {
    return awayLeaderPlayer.value.headshot;
})

const toggleGameNotification = (): void => {
    askNotificationPermission();
}

const checkNotificationPromise = (): boolean => {
    try {
        Notification.requestPermission().then();
    } catch (e) {
        return false;
    }
    return true;
}

const askNotificationPermission = (): void => {
    /* Early return if browser permission has already been granted */
    if (notificationPermission.value === NOTIFICATION_GRANTED) {
        // const notification = new Notification("Hi there!");
        return;
    }
    else if (notificationPermission.value === NOTIFICATION_DENIED) {
        /* Send toast instructing what user needs to change, return early because browser won't ask again */
        $q.notify({
            message: 'Please update your browser permissions to allow us to send you notifications',
            type: 'negative',
            position: "bottom-left"
        })
        return;
    }

    const handlePermission = (permission: string) => {
        notificationPermission.value = permission;
    }

    // Let's check if the browser supports notifications
    if (!('Notification' in window)) {
        console.error("This browser does not support notifications.");
    } else if (checkNotificationPromise()) {
        Notification.requestPermission().then((permission) => {
            handlePermission(permission);
        });
    } else {
        Notification.requestPermission((permission) => {
            handlePermission(permission);
        });
    }
}

/* TODO: Browser notifications link: https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API */

</script>

<template>
    <q-card dark class="score-card" bordered :key="game.uid">
        <q-card-section class="card-header">
            <h6>{{ shortName }}</h6>
            <!-- Toggled styling here ==> notifications vs notifications active -->
            <!-- v-if="!isGameDone" -->
            <div>


                <q-btn @click="toggleGameNotification" class="notification-bell" flat round icon="notifications"
                    title="Notify me about the game" />
            </div>

        </q-card-section>
        <q-separator dark />
        <q-card-section>
            <div class="card-heading">
                <div class="clock active" v-if="gameInProgress">
                    {{ gameClockString }}
                </div>
                <div class="clock" v-else-if="gameNotStarted">
                    {{ gameTimeStart }}
                </div>
                <div class="clock" v-else>
                    FINAL
                </div>
                <div class="line-score-heading">
                    <template v-for="(heading, index) in headerValues" :key="index">
                        <div class="time-period" :class="{ total: index === headerValues.length - 1 }">{{ heading }}
                        </div>
                    </template>
                </div>
            </div>

            <div class="team-row" :class="{ first: index === 0 }" v-for="(competitor, index) in gameTeamsSorted"
                :key="competitor.id">
                <!-- content -->
                <img class="team-logo" :src="competitor.team.logo" />
                <div class="team-info">
                    <div>{{ competitor.team.shortDisplayName }}</div>
                    <div v-on:mouseenter="getRecordDetailsTooltip(competitor)">
                        <span>{{ getRecordString(competitor.records, competitor.homeAway) }}</span>
                        <TeamDetailsTooltip v-if="tooltipData" :data="tooltipData" :homeAway="competitor.homeAway" />
                    </div>
                </div>
                <LineScore :team="competitor" />
                <!-- {{ getLineScore(competitor) }} -->
                <div class="score">{{ competitor.score }}</div>
            </div>
        </q-card-section>
        <q-separator dark />
        <q-card-section class="leaders-section">
            <div class="leaders-header">
                {{ gameNotStarted? "Players to Watch": "Top Performers" }}
            </div>
            <div class="leaders">
                <div class="leader">
                    <q-avatar class="headshot">
                        <img :src="awayLeaderPicture" />
                    </q-avatar>
                    <div class="leader-info">
                        <span>{{ `${awayLeaderName} - ${awayLeaderPosition}`}}</span>
                        <span>{{ awayLeaderStatline }}</span>
                    </div>
                </div>
                <!-- Home Leader -->
                <div class="leader">
                    <q-avatar class="headshot">
                        <img :src="homeLeaderPicture" />
                    </q-avatar>
                    <div class="leader-info">
                        <span>{{ `${homeLeaderName} - ${homeLeaderPosition}`}}</span>
                        <span>{{ homeLeaderStatline }}</span>
                    </div>
                </div>
            </div>
        </q-card-section>
        <q-card-actions>
        </q-card-actions>
    </q-card>
</template>

<style scoped>
.score-card {
    height: 21.5rem;
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

.card-heading {
    display: flex;
}

.line-score-heading {
    display: flex;
    gap: 2rem;
    font-weight: 600;
    flex: 1;
    justify-content: flex-end;
}


.clock {
    font-weight: 600;
}

.clock.active {
    color: var(--q-primary);
}

.time-period {
    display: flex;
    justify-content: center;
}

.time-period.total {

        
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
    margin-left: auto;
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

.leaders-header {
    display: flex;
    font-size: 0.9rem;
    font-weight: 500;
    margin-bottom: 0.5rem;
}

.leaders-section {
    display: flex;
    flex-direction: column;
    padding-top: 0rem;
}

.leaders {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
}

.headshot {
    height: 3rem;
    width: 3.5rem;
}

.leader {
    display: flex;
    flex-direction: row;
}

.leader-info {
    display: flex;
    flex-direction: column;
}
</style>
